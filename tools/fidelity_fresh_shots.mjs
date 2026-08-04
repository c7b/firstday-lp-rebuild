/**
 * Get a render of the v2 page that provably matches the current commit, then screenshot it.
 *
 * Shopify's edge answers this page from a rotating set of nodes, some holding an older render,
 * with no header or parameter that selects the current one. Chromium pools connections at the
 * browser level, so retrying inside one context keeps talking to whichever node answered
 * first — the retry has to build a new context each time to get a new connection.
 *
 * The check is the build stamp in sections/lp-fidelity-overrides.liquid: the one string in the
 * file guaranteed to change every commit. Class names and rem values also exist in earlier
 * commits, and using them as the marker twice certified a stale render as current.
 *
 * Run: WANT=round17 node tools/fidelity_fresh_shots.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const STORE = process.env.SHOPIFY_FLAG_STORE || 'firstday-lp-rebuild';
const PASSWORD = process.env.STOREFRONT_PASSWORD || '1234';
const PAGE = `https://${STORE}.myshopify.com/pages/tdk-behind-the-science-lp-v2`;
const OUT = process.env.SHOT_DIR || '/tmp/fidelity-shots';
const HTML_OUT = process.env.HTML_OUT || '/home/lcam/firstday-assignment/inputs/v2-live.html';
const TRIES = Number(process.env.TRIES || 25);

/* Read the wanted stamp straight out of the working tree, so this cannot drift from the code. */
const WANT = process.env.WANT
  || (fs.readFileSync('sections/lp-fidelity-overrides.liquid', 'utf8')
    .match(/--lp-fidelity-build:\s*"([^"]+)"/) || [])[1];
if (!WANT) { console.error('no build stamp found — cannot verify freshness'); process.exit(2); }

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let failed = false;

for (const width of [1440, 390]) {
  let done = false;
  for (let attempt = 1; attempt <= TRIES && !done; attempt += 1) {
    /* A fresh context per attempt, because that is what gets a fresh connection. */
    const ctx = await browser.newContext({ viewport: { width, height: 1100 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    try {
      await page.goto(`https://${STORE}.myshopify.com/password`, { waitUntil: 'domcontentloaded' });
      const field = page.locator('input[name="password"], #password').first();
      if (await field.count()) {
        await field.fill(PASSWORD);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);
      }
      await page.goto(`${PAGE}?_f=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3500);

      if (await page.evaluate((want) => document.documentElement.outerHTML.includes(want), WANT)) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(OUT, `v2-${width}.png`), clip: { x: 0, y: 0, width, height: 3200 } });
        if (width === 1440) fs.writeFileSync(HTML_OUT, await page.content());
        console.log(`  ${width}px: current render on attempt ${attempt}`);
        done = true;
      }
    } catch (error) {
      console.log(`  ${width}px attempt ${attempt}: ${String(error).slice(0, 70)}`);
    }
    await ctx.close();
    if (!done) await new Promise((r) => setTimeout(r, 4000));
  }
  if (!done) { console.log(`  ${width}px: never saw "${WANT}" in ${TRIES} attempts`); failed = true; }
}

await browser.close();
process.exit(failed ? 1 : 0);
