/**
 * Final layout gate: how many pixels differ between the reference and the rebuild.
 *
 * This is a GATE, not a diagnostic. It answers "is the layout closed" with one number and a
 * heat map; it cannot tell you which property is wrong, and asking it to is how the earlier
 * rounds of this work went in circles. Diagnosis belongs to tools/style_deltas.mjs, which
 * returns properties and values. Run this after that table is empty, to catch what a
 * property-level diff structurally cannot: something present in one page and absent in the
 * other, or in the wrong place.
 *
 * The comparison runs in the browser on a canvas rather than through pixelmatch, because this
 * box does not install packages. Same arithmetic, no dependency.
 *
 * Run: node tools/pixel_gate.mjs  →  docs/receipts/pixel-gate.json + a diff image
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const REFERENCE = process.env.REFERENCE_URL || 'http://127.0.0.1:8777/fd-lp.html';
const REBUILD = process.env.REBUILD_URL || 'http://127.0.0.1:8777/v2-live.html';
const VIEWPORTS = (process.env.VIEWPORTS || '1440,390').split(',').map(Number);
const HEIGHT = Number(process.env.GATE_HEIGHT || 3000);
const THRESHOLD = Number(process.env.GATE_THRESHOLD || 0.1);   // per-channel, 0..1
const OUT_DIR = process.env.GATE_DIR || 'docs/receipts/pixel-gate';

const shot = async (ctx, url, width) => {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(7000);
  /* Walk the page once so anything lazy has committed before the capture. */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width, height: HEIGHT } });
  await page.close();
  return buf.toString('base64');
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const report = { generated: new Date().toISOString(), threshold: THRESHOLD, viewports: {} };

for (const width of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  const [a, b] = [await shot(ctx, REFERENCE, width), await shot(ctx, REBUILD, width)];

  const page = await ctx.newPage();
  const result = await page.evaluate(async ([refB64, ourB64, w, h, threshold]) => {
    const load = (b64) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.src = `data:image/png;base64,${b64}`;
    });
    const [refImg, ourImg] = await Promise.all([load(refB64), load(ourB64)]);
    const grab = (img) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.getContext('2d').getImageData(0, 0, w, h);
    };
    const A = grab(refImg), B = grab(ourImg);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d');
    const D = octx.createImageData(w, h);
    const cut = threshold * 255;
    let differing = 0;
    /* Rows are reported separately so the gate can say WHERE, which is the only diagnostic
       value a pixel count legitimately has. */
    const rows = new Array(Math.ceil(h / 50)).fill(0);
    for (let i = 0; i < A.data.length; i += 4) {
      const d = Math.max(
        Math.abs(A.data[i] - B.data[i]),
        Math.abs(A.data[i + 1] - B.data[i + 1]),
        Math.abs(A.data[i + 2] - B.data[i + 2]),
      );
      const hit = d > cut;
      if (hit) {
        differing += 1;
        rows[Math.floor((i / 4 / w) / 50)] += 1;
      }
      D.data[i] = hit ? 255 : 20;
      D.data[i + 1] = hit ? 40 : 20;
      D.data[i + 2] = hit ? 40 : 20;
      D.data[i + 3] = 255;
    }
    octx.putImageData(D, 0, 0);
    return {
      differing,
      total: w * h,
      pct: +((100 * differing) / (w * h)).toFixed(2),
      worstBands: rows.map((n, i) => ({ y: i * 50, n })).sort((x, y) => y.n - x.n).slice(0, 6),
      diff: out.toDataURL('image/png').split(',')[1],
    };
  }, [a, b, width, HEIGHT, THRESHOLD]);

  fs.writeFileSync(path.join(OUT_DIR, `diff-${width}.png`), Buffer.from(result.diff, 'base64'));
  fs.writeFileSync(path.join(OUT_DIR, `reference-${width}.png`), Buffer.from(a, 'base64'));
  fs.writeFileSync(path.join(OUT_DIR, `rebuild-${width}.png`), Buffer.from(b, 'base64'));
  delete result.diff;
  report.viewports[width] = result;
  console.log(`  ${width}px: ${result.pct}% of pixels differ (${result.differing} of ${result.total})`);
  console.log(`     worst bands (y): ${result.worstBands.map((x) => `${x.y}:${x.n}`).join(' ')}`);
  await ctx.close();
}

await browser.close();
fs.writeFileSync('docs/receipts/pixel-gate.json', JSON.stringify(report, null, 1));
console.log(`\nwrote docs/receipts/pixel-gate.json and ${OUT_DIR}/`);
