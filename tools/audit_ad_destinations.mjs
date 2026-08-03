/**
 * Which landing pages actually carry paid traffic.
 *
 * The sitemap says which landing pages exist. It does not say which ones matter. Meta's Ad
 * Library is public and lists every ad an advertiser is currently running, including where
 * each one sends people — so the pages with money behind them can be separated from the pages
 * that merely exist. That distinction should reorder any migration plan before a line of code
 * is written.
 *
 * METHOD. This reads the ADVERTISER PAGE view, not a keyword search:
 *
 *   facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL
 *     &search_type=page&view_all_page_id=<PAGE_ID>&sort_data[mode]=total_impressions
 *
 * An earlier version of this tool searched four keywords, US only. It saw 9 destinations and
 * led to the wrong conclusion — that almost nothing was advertised. The page view returns the
 * advertiser's whole active library, and the picture inverts. Keyword search is a sample of
 * an advertiser's ads; the page view is the advertiser's ads. Use the page view.
 *
 * Every outbound link is unwrapped from Facebook's l.facebook.com/l.php?u=… redirect and
 * counted by occurrence, then joined against docs/receipts/lp-estate.json so each destination
 * carries the build type of the page it lands on.
 *
 * LIMITS, equally important: occurrences are link appearances across the loaded cards — not
 * impressions, spend, or ad count. The library lazy-loads, so a long run still may not reach
 * every card; the receipt records how many were captured against how many Meta reported.
 * Presence is strong evidence, absence is weak. None of this substitutes for their own ad
 * account — it is what an outsider can establish before being given access.
 *
 * Run: node tools/audit_ad_destinations.mjs  →  docs/receipts/ad-destinations.json
 *
 * If the scroll cannot reach the end (Meta throttles aggressively), the fallback is to scroll
 * the page in a real browser, save it, and point this at the file:
 *   AD_SNAPSHOT=docs/receipts/ad-library-page-snapshot.html.gz node tools/audit_ad_destinations.mjs
 * That snapshot is committed, so the current receipt is reproducible without the network.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const DOMAIN = process.env.AD_DOMAIN || 'firstday.com';
const PAGE_ID = process.env.AD_PAGE_ID || '375215066258824';   // First Day's Meta page
const SNAPSHOT = process.env.AD_SNAPSHOT || '';                // parse a saved page instead of crawling
const SCROLLS = Number(process.env.AD_SCROLLS || 200);
const OUT = path.join('docs', 'receipts', 'ad-destinations.json');
const ESTATE = path.join('docs', 'receipts', 'lp-estate.json');

const LIBRARY_URL = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all`
  + `&country=ALL&is_targeted_country=false&media_type=all&search_type=page`
  + `&sort_data[direction]=desc&sort_data[mode]=total_impressions&view_all_page_id=${PAGE_ID}`;

/** Facebook wraps every outbound link; the real destination is the `u` parameter. */
const unwrap = (href) => {
  try {
    const target = new URL(href).searchParams.get('u');
    return target ? decodeURIComponent(target) : href;
  } catch { return href; }
};

const canonical = (url) => url.replace(/&amp;/g, '&').split('?')[0].split('#')[0].replace(/\/$/, '');

/** Both paths end here: a string of HTML in, counted destinations out. */
function harvest(html) {
  const counts = new Map();
  const wrapped = html.match(/https?:\/\/l\.facebook\.com\/l\.php\?[^"'<>\\ ]+/g) || [];
  const direct = html.match(/https?:\/\/(?:www\.)?firstday\.com\/[^"'<>\\ ]+/g) || [];
  for (const raw of [...wrapped.map((w) => unwrap(w.replace(/&amp;/g, '&'))), ...direct]) {
    if (!raw.includes(DOMAIN)) continue;
    const url = canonical(raw);
    if (url.includes('/ads/library')) continue;
    counts.set(url, (counts.get(url) || 0) + 1);
  }
  return {
    counts,
    cards: (html.match(/Library ID/g) || []).length,
    reported: (html.match(/~?[\d,]+\s+results/i) || [])[0] || null,
  };
}

let html;
if (SNAPSHOT) {
  console.log(`reading snapshot ${SNAPSHOT}`);
  /* The saved page is ~11 MB of markup and compresses to a tenth of that, so the committed
     copy is gzipped — the evidence stays in the repo without the repo carrying 11 MB. */
  html = SNAPSHOT.endsWith('.gz')
    ? zlib.gunzipSync(fs.readFileSync(SNAPSHOT)).toString('utf8')
    : fs.readFileSync(SNAPSHOT, 'utf8');
} else {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 2400 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.goto(LIBRARY_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(9000);
  /* Stop when the card count stops moving, not at a fixed scroll budget — the library
     lazy-loads and how many passes it takes varies with how throttled you are. */
  let previous = 0; let stagnant = 0;
  for (let i = 0; i < SCROLLS; i += 1) {
    await page.mouse.wheel(0, 9000);
    await page.waitForTimeout(1400);
    if (i % 10 !== 9) continue;
    const cards = await page.evaluate(() => (document.body.innerText.match(/Library ID/g) || []).length);
    console.log(`  scroll ${i + 1}: ${cards} cards`);
    if (cards === previous) { stagnant += 1; if (stagnant >= 4) break; } else { stagnant = 0; }
    previous = cards;
  }
  html = await page.content();
  await browser.close();
}

const { counts, cards, reported } = harvest(html);

/* Join each destination to the build type of the page it lands on. A destination with no
   entry here is a page the estate crawl never saw — which is itself a finding, so it is
   marked rather than dropped. */
let buildTypes = {};
try {
  const estate = JSON.parse(fs.readFileSync(ESTATE, 'utf8'));
  const pages = Array.isArray(estate.pages) ? estate.pages
    : Object.values(estate.pages || estate);
  for (const p of pages) if (p.handle) buildTypes[p.handle] = p.build_type;
} catch { console.log('  (no estate file — destinations will not carry build types)'); }

const destinations = [...counts.entries()]
  .map(([url, occurrences]) => {
    const handle = (url.match(/\/pages\/([^/?#]+)/) || [])[1] || null;
    return {
      url,
      occurrences,
      type: url.includes('/products/') ? 'product' : (handle ? 'landing-page' : 'other'),
      handle,
      build_type: handle ? (buildTypes[handle] ?? null) : null,
      in_measured_estate: Boolean(handle && handle in buildTypes),
    };
  })
  .sort((a, b) => b.occurrences - a.occurrences);

const lp = destinations.filter((d) => d.type === 'landing-page');
const known = lp.filter((d) => d.in_measured_estate);
const sum = (rows) => rows.reduce((t, d) => t + d.occurrences, 0);
const toSections = sum(known.filter((d) => d.build_type === 'sections'));
const toReplo = sum(known.filter((d) => d.build_type === 'replo'));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(),
  source: `Meta Ad Library, advertiser page view (page id ${PAGE_ID}), active ads, country=ALL, sorted by total impressions.`,
  method: 'Outbound links decoded from the l.facebook.com/l.php?u= wrapper and counted by occurrence across every loaded ad card, then joined to lp-estate.json for build type.',
  limits: 'Occurrences are link appearances, not spend, impressions or ad count. The library lazy-loads, so shares are representative rather than exhaustive. Presence is strong evidence; absence is weak.',
  supersedes: 'An earlier keyword-based crawl (4 keywords, US only) that saw 9 destinations and understated the estate badly.',
  ads_captured: cards,
  ads_reported_by_meta: reported,
  totals: {
    destinations: destinations.length,
    link_occurrences: sum(destinations),
    landing_page_destinations: lp.length,
    product_page_destinations: destinations.filter((d) => d.type === 'product').length,
    lp_links_to_sections_pages: toSections,
    lp_links_to_replo_pages: toReplo,
    pct_lp_links_to_sections_pages: toSections + toReplo
      ? Math.round((100 * toSections) / (toSections + toReplo)) : null,
  },
  destinations,
}, null, 1));

console.log(`\n${cards} ad cards of ${reported || '?'} → ${destinations.length} destinations`);
console.log(`  paid LP traffic to section-built pages: ${toSections}/${toSections + toReplo}`);
for (const d of destinations.slice(0, 12)) {
  console.log(`  ${String(d.occurrences).padStart(4)}  ${(d.build_type || d.type).padEnd(12)} ${d.url}`);
}
