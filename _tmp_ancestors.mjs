import { chromium } from 'playwright';
const EXE = '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-web-security', '--disable-site-isolation-trials'] });

async function ancestors(url, sel, label, viewport, depth = 8) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(300);
  const data = await page.evaluate(({ sel, depth }) => {
    const el = document.querySelector(sel);
    if (!el) return { error: 'not found' };
    const chain = [];
    let node = el;
    let d = 0;
    while (node && node.tagName && d < depth) {
      const cs = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      chain.push({
        tag: node.tagName, class: node.className,
        display: cs.display, gridTemplateColumns: cs.gridTemplateColumns,
        gap: cs.gap, padding: cs.padding, maxWidth: cs.maxWidth,
        marginLeft: cs.marginLeft, marginRight: cs.marginRight,
        rect: { x: Math.round(r.x), w: Math.round(r.width) },
      });
      node = node.parentElement;
      d++;
    }
    return chain;
  }, { sel, depth });
  console.log('\n----', label, '----');
  console.log(JSON.stringify(data, null, 2));
  await context.close();
}

const vp1440 = { width: 1440, height: 1000 };
const vp390 = { width: 390, height: 1000 };

await ancestors('http://127.0.0.1:8777/fd-lp.html', '.v1-hero-headline', 'REF hero heading ancestors @1440', vp1440, 6);
await ancestors('http://127.0.0.1:8777/v2-live.html', '.lp-hero__heading', 'OURS hero heading ancestors @1440', vp1440, 6);
await ancestors('http://127.0.0.1:8777/fd-lp.html', '.title-font-size', 'REF accordion heading ancestors @1440', vp1440, 6);
await ancestors('http://127.0.0.1:8777/v2-live.html', '.lp-media-accordion__heading', 'OURS accordion heading ancestors @1440', vp1440, 6);

await browser.close();
