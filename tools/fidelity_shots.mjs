/**
 * Side-by-side evidence for the fidelity pass: reference | delivered | corrected.
 *
 * The numbers in fidelity-audit.json are the argument; these are what makes the argument
 * legible to someone who is not going to read a JSON file. Three columns per section, at both
 * viewports, so "closed" can be checked by eye against the same reference the numbers used.
 *
 * Run: node tools/fidelity_shots.mjs  →  docs/receipts/fidelity/<section>-<width>-<which>.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const STORE = process.env.SHOPIFY_FLAG_STORE || 'firstday-lp-rebuild';
const PASSWORD = process.env.STOREFRONT_PASSWORD || '1234';
const OUT = path.join('docs', 'receipts', 'fidelity');
const VIEWPORTS = (process.env.VIEWPORTS || '1440,390').split(',').map(Number);

const TARGETS = [
  ['hero', '.v1-hero-headline', '.lp-hero__section--product'],
  ['accordion', '.accordion-block__cta-block', '.lp-media-accordion'],
  ['science-tabs', '.science-tabs', '.lp-science-tabs'],
  ['buy-box', '.PBFCM-PDP-frequency-selector', '.lp-buy-box__section'],
  ['quantity', '.PBFCM-PDP-quantity-selector', '.lp-buy-box__quantity'],
];

const SOURCES = [
  ['reference', process.env.ORIGINAL_URL || 'http://127.0.0.1:8777/fd-lp.html', 0],
  ['delivered', `https://${STORE}.myshopify.com/pages/tdk-behind-the-science-lp`, 1],
  ['corrected', `https://${STORE}.myshopify.com/pages/tdk-behind-the-science-lp-v2`, 1],
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const written = [];

for (const width of VIEWPORTS) {
  /* No userAgent override — Shopify's edge varies its page cache by UA and a spoofed one is
     served a stale render. Same reason the audit stopped setting it. */
  const ctx = await browser.newContext({ viewport: { width, height: 1100 }, isMobile: width < 700 });
  const page = await ctx.newPage();
  let loggedIn = false;

  for (const [which, url, needsPassword] of SOURCES) {
    if (needsPassword && !loggedIn) {
      await page.goto(`https://${STORE}.myshopify.com/password`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const f = page.locator('input[name="password"], #password').first();
      if (await f.count()) { await f.fill(PASSWORD); await page.keyboard.press('Enter'); await page.waitForTimeout(3500); }
      loggedIn = true;
    }
    const bust = needsPassword ? `${url}?_shot=${Date.now()}` : url;
    await page.goto(bust, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(needsPassword ? 4500 : 7000);

    for (const [name, refSel, ourSel] of TARGETS) {
      const sel = which === 'reference' ? refSel : ourSel;
      const el = page.locator(sel).first();
      if (!(await el.count())) { console.log(`  ${width}px ${which}/${name}: not present`); continue; }
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(900);
      const file = path.join(OUT, `${name}-${width}-${which}.png`);
      await el.screenshot({ path: file }).catch((e) => console.log(`  ${name} ${which}: ${e.message.slice(0, 60)}`));
      if (fs.existsSync(file)) written.push(path.basename(file));
    }
  }
  await ctx.close();
}

await browser.close();
console.log(`\nwrote ${written.length} screenshots to ${OUT}`);
