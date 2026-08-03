/**
 * Which landing pages actually carry paid traffic.
 *
 * The sitemap says 60 landing pages exist. It does not say which ones matter. Meta's Ad
 * Library is public and shows every ad currently running, including where each one sends
 * people — so the pages with money behind them can be separated from the pages that merely
 * exist. That distinction should reorder any migration plan before a line of code is written.
 *
 * Method, stated so the numbers can be judged: the public Ad Library is queried for active
 * US ads across several keywords, the result list is scrolled to load more cards, and every
 * outbound link to the brand's domain is collected and counted. Facebook wraps outbound links
 * in l.facebook.com/l.php?u=…, so the real destination is decoded from that parameter.
 *
 * Limits, equally important: counts are OCCURRENCES OF A LINK in the loaded portion of the
 * results, not impressions, spend, or ad count. Ads are US + active only. Scrolling loads a
 * subset, so absence is weak evidence while presence is strong. Nothing here is a substitute
 * for their own ad account — it is what an outsider can establish before being given access.
 *
 * Run: node tools/audit_ad_destinations.mjs  →  docs/receipts/ad-destinations.json
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const DOMAIN = process.env.AD_DOMAIN || 'firstday.com';
const QUERIES = (process.env.AD_QUERIES || 'firstday.com,"First Day","No Junk",multivitamin gummies kids')
  .split(',').map((s) => s.trim()).filter(Boolean);
const OUT = path.join('docs', 'receipts', 'ad-destinations.json');
const SCROLLS = Number(process.env.AD_SCROLLS || 14);

const decode = (href) => {
  try {
    const u = new URL(href);
    const target = u.searchParams.get('u');
    return target ? decodeURIComponent(target) : href;
  } catch { return href; }
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 2400 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
});

const totals = new Map();
const perQuery = {};

for (const q of QUERIES) {
  const page = await context.newPage();
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US`
    + `&q=${encodeURIComponent(q)}&search_type=keyword_unordered&media_type=all`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    for (let i = 0; i < SCROLLS; i += 1) {
      await page.mouse.wheel(0, 5000);
      await page.waitForTimeout(1800);
    }
    const found = await page.evaluate((dom) => {
      const dec = (h) => { try { const u = new URL(h); const t = u.searchParams.get('u'); return t ? decodeURIComponent(t) : h; } catch { return h; } };
      const links = Array.from(document.querySelectorAll('a[href]'), (a) => dec(a.href))
        .filter((h) => h.includes(dom))
        .map((h) => h.split('?')[0].replace(/\/$/, ''));
      const counts = {};
      links.forEach((h) => { counts[h] = (counts[h] || 0) + 1; });
      const results = (document.body.innerText.match(/~?[\d,]+\s+results/i) || [])[0] || null;
      return { counts, results };
    }, DOMAIN);

    perQuery[q] = found;
    for (const [href, n] of Object.entries(found.counts)) {
      totals.set(href, (totals.get(href) || 0) + n);
    }
    console.log(`"${q}": ${found.results || '?'} — ${Object.keys(found.counts).length} destinations`);
  } catch (error) {
    perQuery[q] = { error: String(error).slice(0, 140) };
    console.log(`"${q}": failed — ${String(error).slice(0, 80)}`);
  }
  await page.close();
}

await browser.close();

const destinations = [...totals.entries()]
  .filter(([href]) => !href.includes('/ads/library'))
  .map(([url, occurrences]) => {
    const m = url.match(/\/pages\/([^/?#]+)/);
    return {
      url,
      occurrences,
      type: url.includes('/products/') ? 'product' : (m ? 'landing-page' : 'other'),
      handle: m ? m[1] : null,
    };
  })
  .sort((a, b) => b.occurrences - a.occurrences);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(),
  method: 'Public Meta Ad Library, active + US, several keyword queries, outbound links decoded from l.facebook.com wrappers and counted by occurrence in the loaded results.',
  limits: 'Occurrences are link appearances in the loaded portion of results — not impressions, spend or ad count. Presence is strong evidence; absence is weak.',
  queries: QUERIES,
  perQuery,
  destinations,
}, null, 1));

console.log(`\n${destinations.length} destinations -> ${OUT}`);
for (const d of destinations.slice(0, 12)) console.log(`  ${String(d.occurrences).padStart(3)}  ${d.url}`);
