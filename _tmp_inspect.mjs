import { chromium } from 'playwright';

const EXE = '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';

const targets = [
  { label: 'REF hero heading', url: 'http://127.0.0.1:8777/fd-lp.html', sel: '.v1-hero-headline' },
  { label: 'OURS hero heading', url: 'http://127.0.0.1:8777/v2-live.html', sel: '.lp-hero__heading' },
  { label: 'REF accordion heading', url: 'http://127.0.0.1:8777/fd-lp.html', sel: '.title-font-size' },
  { label: 'OURS accordion heading', url: 'http://127.0.0.1:8777/v2-live.html', sel: '.lp-media-accordion__heading' },
  { label: 'REF cta block', url: 'http://127.0.0.1:8777/fd-lp.html', sel: '.accordion-block__cta-block' },
  { label: 'OURS cta block', url: 'http://127.0.0.1:8777/v2-live.html', sel: '.lp-media-accordion__cta-block' },
];

async function getWinningRules(page, sel) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { error: 'not found' };

    function specificity(selectorText) {
      // rough specificity calc: [a(id), b(class/attr/pseudo-class), c(type/pseudo-element)]
      // strip pseudo-elements first
      let s = selectorText;
      let a = 0, b = 0, c = 0;
      // ids
      a += (s.match(/#[-\w]+/g) || []).length;
      // classes, attribute selectors, pseudo-classes (not pseudo-elements)
      b += (s.match(/\.[-\w]+/g) || []).length;
      b += (s.match(/\[[^\]]+\]/g) || []).length;
      b += (s.match(/:(?!:)[-\w]+(\([^)]*\))?/g) || []).length;
      // remove ids/classes/attrs/pseudo to count remaining bare type selectors
      let stripped = s
        .replace(/#[-\w]+/g, '')
        .replace(/\.[-\w]+/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/::?[-\w]+(\([^)]*\))?/g, '')
        .replace(/[>+~,]/g, ' ')
        .trim();
      if (stripped.length) {
        c += (stripped.match(/[a-zA-Z][-\w]*/g) || []).length;
      }
      return [a, b, c];
    }

    const results = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      const href = sheet.href || '(inline)';
      function walk(ruleList, mediaText) {
        for (const rule of ruleList) {
          if (rule.type === CSSRule.MEDIA_RULE) {
            walk(rule.cssRules, rule.conditionText || rule.media.mediaText);
            continue;
          }
          if (rule.selectorText) {
            // split multi-selectors and test each
            const parts = rule.selectorText.split(',').map(x => x.trim());
            for (const part of parts) {
              try {
                if (el.matches(part)) {
                  results.push({
                    href,
                    media: mediaText || null,
                    selector: part,
                    fullSelector: rule.selectorText,
                    specificity: specificity(part),
                    cssText: rule.style.cssText,
                  });
                }
              } catch (e) { /* invalid selector, skip */ }
            }
          }
        }
      }
      walk(rules, null);
    }

    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      computed: {
        width: cs.width, maxWidth: cs.maxWidth, display: cs.display,
        flexDirection: cs.flexDirection, alignItems: cs.alignItems,
        fontSize: cs.fontSize, lineHeight: cs.lineHeight, textAlign: cs.textAlign,
        marginInline: cs.marginLeft + ' / ' + cs.marginRight,
      },
      matchingRules: results,
      outerHTMLsnippet: el.outerHTML.slice(0, 200),
      parentInfo: (() => {
        const p = el.parentElement;
        const pcs = getComputedStyle(p);
        const prect = p.getBoundingClientRect();
        return { class: p.className, display: pcs.display, gridTemplateColumns: pcs.gridTemplateColumns, width: prect.width };
      })(),
    };
  }, sel);
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 1000 }]) {
  console.log('\n\n=========== VIEWPORT', JSON.stringify(viewport), '===========');
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const t of targets) {
    await page.goto(t.url, { waitUntil: 'networkidle' });
    const data = await getWinningRules(page, t.sel);
    console.log('\n----', t.label, t.sel, '----');
    console.log(JSON.stringify(data, null, 2));
  }
  await context.close();
}

await browser.close();
