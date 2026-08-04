import { chromium } from 'playwright';

const EXE = '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';

const targets = [
  { label: 'REF cta block', url: 'http://127.0.0.1:8777/fd-lp.html', sel: '.accordion-block__cta-block' },
  { label: 'OURS cta block', url: 'http://127.0.0.1:8777/v2-live.html', sel: '.lp-media-accordion__cta-block' },
];

function ancestorChain(el) {
  const chain = [];
  let node = el;
  let depth = 0;
  while (node && node.tagName && depth < 8) {
    const cs = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    chain.push({
      tag: node.tagName,
      class: node.className,
      display: cs.display,
      flexDirection: cs.flexDirection,
      gridTemplateColumns: cs.gridTemplateColumns,
      maxWidth: cs.maxWidth,
      width: rect.width,
    });
    node = node.parentElement;
    depth++;
  }
  return chain;
}

async function getWinningRules(page, sel) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { error: 'not found' };

    function specificity(selectorText) {
      let s = selectorText;
      let a = 0, b = 0, c = 0;
      a += (s.match(/#[-\w]+/g) || []).length;
      b += (s.match(/\.[-\w]+/g) || []).length;
      b += (s.match(/\[[^\]]+\]/g) || []).length;
      b += (s.match(/:(?!:)[-\w]+(\([^)]*\))?/g) || []).length;
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
            const parts = rule.selectorText.split(',').map(x => x.trim());
            for (const part of parts) {
              try {
                if (el.matches(part)) {
                  results.push({
                    href, media: mediaText || null, selector: part,
                    fullSelector: rule.selectorText,
                    specificity: specificity(part),
                    cssText: rule.style.cssText,
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
      walk(rules, null);
    }

    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    function ancestorChain(el) {
      const chain = [];
      let node = el;
      let depth = 0;
      while (node && node.tagName && depth < 8) {
        const cs2 = getComputedStyle(node);
        const r2 = node.getBoundingClientRect();
        chain.push({
          tag: node.tagName, class: node.className, display: cs2.display,
          flexDirection: cs2.flexDirection, gridTemplateColumns: cs2.gridTemplateColumns,
          maxWidth: cs2.maxWidth, width: r2.width,
        });
        node = node.parentElement;
        depth++;
      }
      return chain;
    }

    return {
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      computed: {
        width: cs.width, maxWidth: cs.maxWidth, display: cs.display,
        flexDirection: cs.flexDirection, alignItems: cs.alignItems,
        textAlign: cs.textAlign, marginLeft: cs.marginLeft, marginRight: cs.marginRight,
      },
      matchingRules: results,
      outerHTMLsnippet: el.outerHTML.slice(0, 300),
      ancestors: ancestorChain(el),
    };
  }, sel);
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 1000 }]) {
  console.log('\n\n=========== VIEWPORT', JSON.stringify(viewport), '===========');
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const t of targets) {
    await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(500);
    const data = await getWinningRules(page, t.sel);
    console.log('\n----', t.label, t.sel, '----');
    console.log(JSON.stringify(data, null, 2));
  }
  await context.close();
}

await browser.close();
