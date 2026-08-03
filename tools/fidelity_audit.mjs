/**
 * Measure our rebuild against the live original and report every CSS difference as a number.
 *
 * The panel's criticism was visual fidelity, and the honest failure mode of answering it is
 * eyeballing screenshots until they "look close". Screenshots cannot tell you that a heading
 * is 600 where the reference is 700, and they certainly cannot tell you it at two viewports
 * across a dozen sections. So this reads getComputedStyle from both pages and diffs the
 * values, which turns "looks different" into "font-weight: 600 vs 700".
 *
 * Pairing is by ROLE, not by selector: the original and the rebuild have unrelated class
 * names, so each pair below says "the h1 of the opening hero, here and there". A pair that
 * cannot be resolved on either side is reported as unmatched rather than silently skipped —
 * a comparison that quietly compared nothing is worse than no comparison.
 *
 * Run: node tools/fidelity_audit.mjs           → docs/receipts/fidelity-audit.json
 *      VIEWPORTS=390 node tools/fidelity_audit.mjs   → one viewport only
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
/* firstday.com rate-limits this machine (429 local_rate_limited), and a reference that can
   change mid-audit is not a reference. So the comparison runs against the page snapshot the
   brief itself supplied, served locally — it renders with the real stylesheets from
   cdn.shopify.com and the real Typekit fonts, and it cannot drift between runs.
   Point ORIGINAL_URL at the live page when the limit lifts to re-confirm. */
const ORIGINAL = process.env.ORIGINAL_URL || 'http://127.0.0.1:8777/fd-lp.html';
const STORE = process.env.SHOPIFY_FLAG_STORE || 'firstday-lp-rebuild';
const REBUILD = process.env.FIDELITY_PAGE
  || `https://${STORE}.myshopify.com/pages/tdk-behind-the-science-lp-v2`;
const PASSWORD = process.env.STOREFRONT_PASSWORD || '1234';
const VIEWPORTS = (process.env.VIEWPORTS || '1440,390').split(',').map(Number);
const OUT = path.join('docs', 'receipts', 'fidelity-audit.json');

/* Two groups, because the two builds distribute styling differently. The original wraps a
   badge <div> around a text <p>: the div carries background, radius and padding, the p carries
   type. Ours is one span carrying both. Comparing the whole property list against either one
   alone reports differences that are really just "the other element has them" — the first run
   of this audit did exactly that and produced twenty false gaps. So a pair declares which
   group it is asking about, and the box question is aimed at whichever element owns the box. */
const TYPO = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-transform', 'text-align', 'color'];
const BOX = ['background-color', 'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom',
  'padding-left', 'padding-right', 'border-radius', 'border-top-width', 'border-bottom-width',
  'box-shadow', 'gap'];
const MEDIA = ['object-fit', 'object-position', 'aspect-ratio', 'border-radius'];
const PROPS = [...new Set([...TYPO, ...BOX, ...MEDIA])];

/* role → [selectors on the original, selectors on the rebuild]. First match wins on each
   side, so a list is a fallback chain, not an "all of these". */
const PAIRS = [
  ['hero / h1',                    ['.v1-hero-headline'], ['.lp-hero__heading'], TYPO],
  ['hero / cta label',             ['.v1-hero-cta-text'], ['.lp-hero__cta'], TYPO],
  ['hero / review line',           ['.v1-hero-reviews-text'], ['.lp-hero__badge'], TYPO],
  ['accordion / heading',          ['.title-font-size'], ['.lp-media-accordion__heading'], TYPO],
  ['accordion / item title',       ['.accordion-block__title'], ['.lp-media-accordion__title'], TYPO],
  ['accordion / cta label',        ['.accordion-block__cta a'], ['.lp-media-accordion__cta'], TYPO],
  ['accordion / cta box',          ['.accordion-block__cta a'], ['.lp-media-accordion__cta'], BOX],
  ['accordion / guarantee',        ['.accordion-block__guarantee-text'], ['.lp-media-accordion__guarantee span'], TYPO],
  ['tabs / heading',               ['.science-tabs__heading'], ['.lp-science-tabs__heading'], TYPO],
  ['tabs / tab label',             ['.science-tabs__tab-label'], ['.lp-science-tabs__tab'], TYPO],
  ['tabs / tab box',               ['.science-tabs__tab'], ['.lp-science-tabs__tab'], BOX],
  ['tabs / panel title',           ['.science-tabs__content-title'], ['.lp-science-tabs__content-title', '.lp-science-tabs__panel-heading'], TYPO],
  ['tabs / panel body',            ['.science-tabs__content-desc'], ['.lp-science-tabs__content-desc', '.lp-science-tabs__panel-content p'], TYPO],
  ['buy box / gallery image',      ['.PBFCM-PDP-product-gallery__main-image'], ['.lp-buy-box__media-frame img'], MEDIA],
  ['buy box / group legend',       ['.PBFCM-PDP-frequency-selector__title'], ['.lp-buy-box__legend'], TYPO],
  ['buy box / plan label',         ['.PBFCM-PDP-frequency-selector__label'], ['.lp-buy-box__delivery-title'], TYPO],
  ['buy box / price',              ['.PBFCM-PDP-frequency-selector__price-final'], ['.lp-buy-box__price'], TYPO],
  ['buy box / price compare',      ['.PBFCM-PDP-frequency-selector__price-compare'], ['.lp-buy-box__price-compare', '.lp-buy-box__delivery-prices s'], TYPO],
  ['buy box / price note',         ['.PBFCM-PDP-frequency-selector__price-note'], ['.lp-buy-box__price-note'], TYPO],
  ['buy box / plan benefit',       ['.PBFCM-PDP-frequency-selector__benefit-text'], ['.lp-buy-box__delivery-copy li', '.lp-buy-box__delivery-copy'], TYPO],
  ['buy box / plan badge text',    ['.PBFCM-PDP-frequency-selector__badge-text'], ['.lp-buy-box__delivery-badge'], TYPO],
  ['buy box / plan badge box',     ['.PBFCM-PDP-frequency-selector__badge'], ['.lp-buy-box__delivery-badge'], BOX],
  ['buy box / servings text',      ['.PBFCM-PDP-quantity-selector__servings-text'], ['.lp-buy-box__quantity-note'], TYPO],
  ['buy box / servings box',       ['.PBFCM-PDP-quantity-selector__servings-badge'], ['.lp-buy-box__quantity-note'], BOX],
  ['buy box / qty label',          ['.PBFCM-PDP-quantity-selector__item-label'], ['.lp-buy-box__quantity-label'], TYPO],
  ['buy box / qty savings text',   ['.PBFCM-PDP-quantity-selector__savings-text'], ['.lp-buy-box__savings'], TYPO],
  ['buy box / qty savings box',    ['.PBFCM-PDP-quantity-selector__savings-badge'], ['.lp-buy-box__savings'], BOX],
];

const read = (page, selectors, props) => page.evaluate(([sels, props]) => {
  const pick = () => {
    for (const s of sels) {
      for (const el of document.querySelectorAll(s)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;      // must actually render
      }
    }
    return null;
  };
  const el = pick();
  if (!el) return null;
  const cs = getComputedStyle(el);
  const out = { _tag: el.tagName.toLowerCase(), _text: (el.textContent || '').trim().slice(0, 48) };
  for (const p of props) out[p] = cs.getPropertyValue(p);
  const r = el.getBoundingClientRect();
  out._w = Math.round(r.width); out._h = Math.round(r.height);
  return out;
}, [selectors, props]);

/* What matters in a font stack is the family that actually resolves, not the length of the
   fallback chain behind it. "sofia-pro, sans-serif" and "sofia-pro, Poppins, system-ui" render
   identically; reporting them as a difference buries the one row where the first family really
   is different. */
const firstFamily = (v) => (v || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();

/* px values that differ by less than a pixel are rounding, not a decision. */
const near = (a, b) => {
  const na = parseFloat(a), nb = parseFloat(b);
  return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) < 1
    && a.replace(/[\d.]+/g, '') === b.replace(/[\d.]+/g, '');
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const report = { generated: new Date().toISOString(), original: ORIGINAL, rebuild: REBUILD, viewports: {} };

for (const width of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 1000 },
    isMobile: width < 700,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
  const a = await ctx.newPage();          // original
  const b = await ctx.newPage();          // rebuild

  await a.goto(ORIGINAL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await a.waitForTimeout(7000);
  await a.evaluate(() => window.scrollTo(0, 4000));   // wake lazy content
  await a.waitForTimeout(2500);
  await a.evaluate(() => window.scrollTo(0, 0));

  await b.goto(`https://${STORE}.myshopify.com/password`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const f = b.locator('input[name="password"], #password').first();
  if (await f.count()) { await f.fill(PASSWORD); await b.keyboard.press('Enter'); await b.waitForTimeout(3500); }
  /* Shopify edge-caches the rendered page, and the cached HTML points at the asset URL that
     was current when it was cached. Without a cache buster this reads a page that references
     last deploy's stylesheet — which is how two consecutive audits returned byte-identical
     results across two real CSS changes. */
  const bust = `${REBUILD}${REBUILD.includes('?') ? '&' : '?'}_fid=${Date.now()}`;
  await b.goto(bust, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await b.waitForTimeout(4500);

  const rows = [];
  for (const [role, origSel, ourSel, group] of PAIRS) {
    const ask = group || PROPS;
    const [o, r] = await Promise.all([read(a, origSel, ask), read(b, ourSel, ask)]);
    if (!o || !r) { rows.push({ role, unmatched: !o ? 'original' : 'rebuild' }); continue; }
    const diffs = [];
    for (const p of ask) {
      if (o[p] === r[p] || near(o[p], r[p])) continue;
      if (p === 'font-family' && firstFamily(o[p]) === firstFamily(r[p])) continue;
      diffs.push({ property: p, original: o[p], rebuild: r[p] });
    }
    rows.push({ role, origText: o._text, ourText: r._text, diffs });
  }
  report.viewports[width] = rows;
  await ctx.close();

  const n = rows.reduce((t, x) => t + (x.diffs?.length || 0), 0);
  const um = rows.filter((x) => x.unmatched).length;
  console.log(`  ${width}px: ${n} property differences across ${rows.length - um} matched roles (${um} unmatched)`);
}

await browser.close();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`\nwrote ${OUT}`);
for (const [w, rows] of Object.entries(report.viewports)) {
  for (const r of rows) {
    if (r.unmatched) { console.log(`  ${w}px  ${r.role}: UNMATCHED on ${r.unmatched}`); continue; }
    for (const d of r.diffs) console.log(`  ${w}px  ${r.role}  ${d.property}: ${d.original}  ->  ${d.rebuild}`);
  }
}
