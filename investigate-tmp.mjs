import { chromium } from 'playwright';

const EXEC = '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';

async function walk(page, selector, label) {
  const data = await page.evaluate((sel) => {
    function styleOf(el) {
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        width: cs.width,
        maxWidth: cs.maxWidth,
        minWidth: cs.minWidth,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        marginLeft: cs.marginLeft,
        marginRight: cs.marginRight,
        gridTemplateColumns: cs.gridTemplateColumns,
        columnGap: cs.columnGap,
        rowGap: cs.rowGap,
        boxSizing: cs.boxSizing,
        flex: cs.flex,
      };
    }
    let el = document.querySelector(sel);
    if (!el) return { error: 'not found: ' + sel };
    const chain = [];
    let depth = 0;
    while (el && depth < 12) {
      const rect = el.getBoundingClientRect();
      chain.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: typeof el.className === 'string' ? el.className : String(el.className),
        rect: { x: Math.round(rect.x * 100) / 100, width: Math.round(rect.width * 100) / 100, y: Math.round(rect.y*100)/100, height: Math.round(rect.height*100)/100 },
        style: styleOf(el),
      });
      el = el.parentElement;
      depth++;
    }
    return chain;
  }, selector);
  return { label, selector, data };
}

async function main() {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });

  const targets = [
    { url: 'http://127.0.0.1:8777/fd-lp.html', label: 'REF', sels: ['.PBFCM-PDP-frequency-selector', '.PBFCM-PDP-quantity-selector__grid'] },
    { url: 'http://127.0.0.1:8777/v2-live.html', label: 'OURS', sels: ['.lp-buy-box__delivery', '.lp-buy-box__quantity-grid'] },
  ];

  for (const vp of [{width:1440,height:1000}, {width:390,height:1000}]) {
    console.log(`\n\n================ VIEWPORT ${vp.width}x${vp.height} ================`);
    for (const t of targets) {
      const page = await browser.newPage({ viewport: vp });
      await page.goto(t.url, { waitUntil: 'networkidle' });
      for (const sel of t.sels) {
        const result = await walk(page, sel, t.label);
        console.log(`\n--- ${t.label} ${sel} @ ${vp.width}px ---`);
        if (result.data.error) {
          console.log(result.data.error);
          continue;
        }
        for (const node of result.data) {
          console.log(JSON.stringify(node));
        }
      }
      await page.close();
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
