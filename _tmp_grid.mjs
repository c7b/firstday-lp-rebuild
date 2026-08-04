import { chromium } from 'playwright';
const EXE = '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-web-security', '--disable-site-isolation-trials'] });

async function dump(url, containerSel, label, viewport) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(300);
  const data = await page.evaluate((containerSel) => {
    const container = document.querySelector(containerSel);
    if (!container) return { error: 'not found: ' + containerSel };
    const cs = getComputedStyle(container);
    const rect = container.getBoundingClientRect();
    const children = Array.from(container.children).map(ch => {
      const ccs = getComputedStyle(ch);
      const crect = ch.getBoundingClientRect();
      return {
        tag: ch.tagName, class: ch.className,
        display: ccs.display, gridColumn: ccs.gridColumn, gridRow: ccs.gridRow,
        rect: { x: Math.round(crect.x), y: Math.round(crect.y), w: Math.round(crect.width), h: Math.round(crect.height) },
      };
    });
    return {
      containerDisplay: cs.display,
      gridTemplateColumns: cs.gridTemplateColumns,
      gridTemplateRows: cs.gridTemplateRows,
      gap: cs.gap,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      children,
    };
  }, containerSel);
  console.log('\n----', label, '----');
  console.log(JSON.stringify(data, null, 2));
  await context.close();
}

const vp1440 = { width: 1440, height: 1000 };

await dump('http://127.0.0.1:8777/fd-lp.html', '.accordion-block__grid', 'REF accordion-block__grid children @1440', vp1440);

await browser.close();
