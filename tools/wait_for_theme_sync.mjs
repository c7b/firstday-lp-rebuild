/**
 * Block until the theme is serving the stylesheet that is currently committed.
 *
 * The theme is connected to GitHub, so a push — not an Asset API call — is what actually
 * lands. That sync takes minutes, and during the window the storefront happily serves the
 * previous asset under its old ?v= key. An audit run inside that window reports the previous
 * deploy's numbers and looks exactly like "the fix did nothing", which cost real time here.
 *
 * Run: node tools/wait_for_theme_sync.mjs <substring that must appear in the served css>
 */
import fs from 'node:fs';

const STORE = process.env.SHOPIFY_FLAG_STORE || 'firstday-lp-rebuild';
const PAGE = `https://${STORE}.myshopify.com/pages/tdk-behind-the-science-lp-v2`;
const NEEDLE = process.argv[2] || fs.readFileSync('assets/lp-fidelity.css', 'utf8')
  .split('\n').find((l) => l.trim().startsWith('--lp-navy'))?.trim() || 'sofia-pro';
const DEADLINE = Date.now() + Number(process.env.SYNC_TIMEOUT_MS || 600000);

const login = async () => {
  const body = new URLSearchParams({ form_type: 'storefront_password', utf8: '✓', password: process.env.STOREFRONT_PASSWORD || '1234' });
  const r = await fetch(`https://${STORE}.myshopify.com/password`, { method: 'POST', body, redirect: 'manual' });
  return (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
};

const cookie = await login();
let attempt = 0;
while (Date.now() < DEADLINE) {
  attempt += 1;
  const html = await fetch(`${PAGE}?_sync=${Date.now()}`, { headers: { cookie } }).then((r) => r.text());
  const href = (html.match(/[^"']*lp-fidelity\.css\?v=\d+/) || [])[0];
  if (href) {
    const css = await fetch(href.startsWith('http') ? href : `https:${href}`).then((r) => r.text());
    if (css.includes(NEEDLE)) {
      console.log(`  synced after ${attempt} check(s) — serving ${css.length} bytes`);
      process.exit(0);
    }
    console.log(`  check ${attempt}: still ${css.length} bytes, waiting`);
  } else {
    console.log(`  check ${attempt}: no stylesheet link yet`);
  }
  await new Promise((r) => setTimeout(r, 20000));
}
console.log('  TIMED OUT waiting for the theme to serve the committed stylesheet');
process.exit(1);
