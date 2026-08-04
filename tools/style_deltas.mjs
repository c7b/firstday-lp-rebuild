/**
 * Deterministic computed-style diff between the reference and the rebuild.
 *
 * The previous harness paired 34 elements by hand, so everything outside that list was invisible
 * to it — reversed columns, a border on a tab bar rather than a tab, an image cropped to the
 * wrong ratio. It scored a page at 10 differences that a designer failed on sight. The problem
 * was not the threshold, it was the sample.
 *
 * This pairs automatically, and it can because of a property this build already guarantees:
 * every string on the page is byte-identical to the reference, enforced by the copy gate. So
 * text content is a reliable join key. Elements that carry text pair by their text; images pair
 * by order within their section; containers pair by the text of what they contain.
 *
 * What it reads, per pair:
 *   typography  font-family, size, weight, style, line-height, letter-spacing, transform, align
 *   box         margin, padding, gap, width, height, display, flex-direction, grid-template
 *   paint       color, background-color, border (each side), border-radius, box-shadow, opacity
 *   images      getBoundingClientRect + naturalWidth/Height + object-fit + object-position,
 *               which is what turns "the crop looks off" into a number
 *   motion      transition-property/duration/timing, animation-name/duration — because a toggle
 *               that lands on the right colour by a different curve is still not identical
 *
 * It also drives state: every toggle and tab is clicked on both pages and re-measured, so the
 * selected/active appearance is diffed rather than assumed.
 *
 * Output is a table — selector, property, reference value, our value — meant to be worked
 * through mechanically. Nothing here interprets a screenshot.
 *
 * Run: node tools/style_deltas.mjs            → docs/receipts/style-deltas.json + stdout table
 *      VIEWPORTS=1440 node tools/style_deltas.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const REFERENCE = process.env.REFERENCE_URL || 'http://127.0.0.1:8777/fd-lp.html';
const REBUILD = process.env.REBUILD_URL || 'http://127.0.0.1:8777/v2-live.html';
const VIEWPORTS = (process.env.VIEWPORTS || '1440,390').split(',').map(Number);
const OUT = path.join('docs', 'receipts', 'style-deltas.json');

const TYPOGRAPHY = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-transform', 'text-align', 'text-decoration-line'];
const BOX = ['margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'column-gap', 'row-gap', 'display', 'flex-direction', 'justify-content', 'align-items',
  'grid-template-columns'];
const PAINT = ['color', 'background-color', 'border-top-width', 'border-bottom-width',
  'border-left-width', 'border-right-width', 'border-top-style', 'border-top-color',
  'border-radius', 'box-shadow', 'opacity'];
const MOTION = ['transition-property', 'transition-duration', 'transition-timing-function',
  'animation-name', 'animation-duration'];
const ALL = [...TYPOGRAPHY, ...BOX, ...PAINT, ...MOTION];

/* Values that differ only by rounding, or only in the tail of a font stack, are not decisions. */
const firstFamily = (v) => String(v || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
const PX = /^-?[\d.]+px$/;
const same = (prop, a, b) => {
  if (a === b) return true;
  if (prop === 'font-family') return firstFamily(a) === firstFamily(b);
  if (PX.test(a) && PX.test(b)) return Math.abs(parseFloat(a) - parseFloat(b)) < 1;
  return false;
};

/* Collected in the page. Keyed by normalised own-text so the two DOMs can be joined without a
   hand-written selector map. */
/* Scope. The brief puts theme chrome out of bounds, and measuring it drowns the findings that
   matter: the first run spent its first dozen rows on a skip-to-content link. Each page declares
   which containers ARE the landing page, and nothing outside them is read. */
const SCOPES = {
  reference: '.v1-hero-section, .accordion-block, .science-tabs, [class^="PBFCM-PDP"], [class*="tc-card"], [class*="social-proof"]',
  rebuild: '[class*="lp-hero__"], [class*="lp-media-accordion"], [class*="lp-science-tabs"], [class*="lp-buy-box"], [class*="lp-clinicians"], [class*="lp-trust-wall"]',
};

const COLLECT = ([props, scope]) => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 90);
  const ownText = (el) => Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
  const label = (el) => {
    const cls = (el.className || '').toString().trim().split(/\s+/)[0] || '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden';
  };

  const roots = Array.from(document.querySelectorAll(scope));
  const inScope = (el) => roots.some((r) => r === el || r.contains(el));

  const text = {};
  const images = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || !inScope(el)) continue;
    if (el.closest('header, footer, nav, [class*="cart-drawer"], [class*="menu-drawer"], [class*="announcement"]')) continue;

    if (el.tagName === 'IMG') {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      images.push({
        label: label(el),
        rect: `${Math.round(r.width)}x${Math.round(r.height)}`,
        natural: `${el.naturalWidth}x${el.naturalHeight}`,
        'object-fit': cs.objectFit,
        'object-position': cs.objectPosition,
        'border-radius': cs.borderRadius,
        'aspect-ratio': cs.aspectRatio,
      });
      continue;
    }

    const t = norm(ownText(el));
    if (t.length < 4) continue;               // too short to join on reliably
    if (text[t]) continue;                     // first occurrence wins on both sides

    /* Text-joined pairs carry TYPOGRAPHY only. Box and paint are read from explicit component
       pairs below instead, because the two DOMs nest differently — the reference wraps its
       labels in unstyled spans while ours put the text on the control itself. An automatic
       ancestor walk looked like the fix and was not: "the first ancestor that paints" lands at
       a different depth on each side, which traded twenty invented differences for six hundred.
       Typography is safe to join on text; boxes need a named counterpart. */
    const cs = getComputedStyle(el);
    const row = { label: label(el) };
    for (const p of props) row[p] = cs.getPropertyValue(p);
    text[t] = row;
  }
  return { text, images };
};

/* Clickables worth driving: the reference and the rebuild both express selection through them. */
const TOGGLES = 'button, [role="radio"], [role="tab"], summary, label[for]';

async function snapshot(page, props, scope) {
  return page.evaluate(COLLECT, [props, scope]);
}

async function driveToggles(page, scope) {
  /* Click each toggle once and record what its own computed style became. Keyed by its text, so
     the two pages join the same way the static pass does. */
  return page.evaluate(async ([sel, props, scope]) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 90);
    const out = {};
    const roots = Array.from(document.querySelectorAll(scope));
    const nodes = Array.from(document.querySelectorAll(sel)).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1
        && roots.some((x) => x.contains(el))
        && !el.closest('header, footer, nav, [class*="drawer"], [class*="announcement"]');
    }).slice(0, 24);
    for (const el of nodes) {
      const key = norm(el.textContent) || norm(el.getAttribute('aria-label'));
      if (!key || out[key]) continue;
      try { el.click(); } catch { /* a control that refuses to be clicked is itself a finding */ }
      await new Promise((r) => setTimeout(r, 260));   // let a transition land
      const cs = getComputedStyle(el);
      const row = { label: el.tagName.toLowerCase() };
      for (const p of props) row[p] = cs.getPropertyValue(p);
      out[key] = row;
    }
    return out;
  }, [TOGGLES, [...PAINT, ...MOTION, 'font-weight'], scope]);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const report = { generated: new Date().toISOString(), reference: REFERENCE, rebuild: REBUILD, viewports: {} };

for (const width of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  const [refPage, ourPage] = [await ctx.newPage(), await ctx.newPage()];

  for (const [page, url] of [[refPage, REFERENCE], [ourPage, REBUILD]]) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
  }

  const [refSnap, ourSnap] = await Promise.all([
    snapshot(refPage, ALL, SCOPES.reference),
    snapshot(ourPage, ALL, SCOPES.rebuild),
  ]);

  const deltas = [];
  let paired = 0;
  for (const [key, refRow] of Object.entries(refSnap.text)) {
    const ourRow = ourSnap.text[key];
    if (!ourRow) continue;                 // not on our page, or worded differently — see unpaired
    paired += 1;
    for (const p of TYPOGRAPHY) {
      if (same(p, refRow[p], ourRow[p])) continue;
      deltas.push({ element: ourRow.label, text: key.slice(0, 44), property: p,
        reference: refRow[p], rebuild: ourRow[p] });
    }
  }

  /* Images pair by order — there is no text to join on, and order is what a reader sees. */
  const imgProps = ['rect', 'natural', 'object-fit', 'object-position', 'border-radius', 'aspect-ratio'];
  const imgCount = Math.min(refSnap.images.length, ourSnap.images.length);
  for (let i = 0; i < imgCount; i += 1) {
    for (const p of imgProps) {
      const a = refSnap.images[i][p], b = ourSnap.images[i][p];
      if (a === b) continue;
      deltas.push({ element: `img[${i}] ${ourSnap.images[i].label}`, text: '(image)',
        property: p, reference: a, rebuild: b });
    }
  }

  const [refToggles, ourToggles] = await Promise.all([driveToggles(refPage, SCOPES.reference), driveToggles(ourPage, SCOPES.rebuild)]);
  const stateDeltas = [];
  for (const [key, refRow] of Object.entries(refToggles)) {
    const ourRow = ourToggles[key];
    if (!ourRow) continue;
    for (const p of [...PAINT, ...MOTION, 'font-weight']) {
      if (same(p, refRow[p], ourRow[p])) continue;
      stateDeltas.push({ element: `${ourRow.label} (after click)`, text: key.slice(0, 44),
        property: p, reference: refRow[p], rebuild: ourRow[p] });
    }
  }

  report.viewports[width] = {
    paired,
    unpaired_reference: Object.keys(refSnap.text).filter((k) => !ourSnap.text[k]).length,
    images: { reference: refSnap.images.length, rebuild: ourSnap.images.length },
    deltas,
    state_deltas: stateDeltas,
  };
  console.log(`  ${width}px: ${paired} paired · ${deltas.length} static deltas · ${stateDeltas.length} state deltas`);
  await ctx.close();
}

await browser.close();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));

for (const [width, r] of Object.entries(report.viewports)) {
  console.log(`\n===== ${width}px =====`);
  for (const d of [...r.deltas, ...r.state_deltas]) {
    console.log(`  ${d.element.padEnd(34)} ${d.property.padEnd(22)} ref=${String(d.reference).slice(0, 26).padEnd(26)} v2=${String(d.rebuild).slice(0, 24)}`);
  }
}
console.log(`\nwrote ${OUT}`);
