/**
 * Objective QA runner for the LP.
 *
 * Two jobs:
 *  1. Behaviour audit — click every interactive element and record what actually happened.
 *     A control that changes nothing is reported as a no-op, which is the class of defect a
 *     screenshot never catches.
 *  2. Test runner for the section loop (tools/section_loop.py): assertions live in
 *     docs/context/tests/*.json and are evaluated here against the real rendered page.
 *
 * Usage:
 *   node tools/qa_interactions.mjs                     # audit, writes docs/receipts/interaction-audit.md
 *   node tools/qa_interactions.mjs --tests <file.json> # run assertions, exit 1 on failure, prints JSON
 *   node tools/qa_interactions.mjs --tests <file.json> --refresh-sections hero_opener,hero_closer
 *
 * Env: SHOPIFY_FLAG_STORE, STOREFRONT_PASSWORD (from ../.env)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const STORE = process.env.SHOPIFY_FLAG_STORE;
const PASSWORD = process.env.STOREFRONT_PASSWORD;
const CHROME = process.env.CHROME_PATH || '/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const PAGE_PATH = process.env.QA_PAGE || '/pages/tdk-behind-the-science-lp';
const BASE = `https://${STORE}.myshopify.com`;
const PAGE_URL = new URL(PAGE_PATH, BASE);
PAGE_URL.searchParams.set('_qa', Date.now().toString());

const argv = process.argv.slice(2);
const testsFlag = argv.indexOf('--tests');
const TESTS_FILE = testsFlag > -1 ? argv[testsFlag + 1] : null;
const refreshFlag = argv.indexOf('--refresh-sections');
const REFRESH_SECTIONS = refreshFlag > -1 ? argv[refreshFlag + 1].split(',').filter(Boolean) : [];
const VIEWPORT = argv.includes('--desktop') ? { width: 1440, height: 900 } : { width: 390, height: 844 };

async function openPage(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    isMobile: VIEWPORT.width < 700,
    hasTouch: VIEWPORT.width < 700,
    extraHTTPHeaders: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200).trim()));
  page.on('pageerror', (e) => consoleErrors.push(('pageerror: ' + String(e).slice(0, 200)).trim()));
  page.on('response', (response) => {
    if (response.status() >= 400) consoleErrors.push(`HTTP ${response.status()}: ${response.url().slice(0, 180)}`);
  });

  if (PASSWORD) {
    await page.goto(`${BASE}/password`, { waitUntil: 'domcontentloaded' });
    const field = page.locator('input[name="password"]').first();
    if (await field.count()) {
      await field.fill(PASSWORD);
      await page.locator('form[action*="password"] button, form[action*="password"] input[type=submit]').first().click();
      await page.waitForLoadState('domcontentloaded');
    }
  }
  // Ask both browser and edge caches to revalidate. Shopify can still serve a
  // stale full-page variant briefly; Section Rendering API receipts distinguish
  // that propagation delay from the current section asset.
  // Shopify storefronts keep analytics/app requests alive, so `networkidle` is not a
  // reliable readiness signal. DOMContentLoaded plus a short hydration window is stable.
  await page.goto(PAGE_URL.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  return { page, context, consoleErrors };
}

/** Replace named template instances with Shopify's current Section Rendering API output. */
async function refreshSections(page, suffixes) {
  const refreshed = [];
  for (const suffix of suffixes) {
    const result = await page.evaluate(async (instanceSuffix) => {
      const wrapper = [...document.querySelectorAll('[id^="shopify-section-template--"]')]
        .find((el) => el.id.endsWith(`__${instanceSuffix}`));
      if (!wrapper) return { suffix: instanceSuffix, ok: false, detail: 'wrapper not found' };

      const sectionId = wrapper.id.replace(/^shopify-section-/, '');
      const url = new URL(location.href);
      url.search = '';
      url.searchParams.set('sections', sectionId);
      url.searchParams.set('_qa', Date.now().toString());
      const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) return { suffix: instanceSuffix, ok: false, detail: `HTTP ${response.status}` };

      const html = (await response.json())[sectionId];
      if (!html) return { suffix: instanceSuffix, ok: false, detail: 'empty section HTML' };
      const template = document.createElement('template');
      template.innerHTML = html.trim();
      const fresh = template.content.firstElementChild;
      if (!fresh) return { suffix: instanceSuffix, ok: false, detail: 'unparseable section HTML' };
      wrapper.replaceWith(fresh);
      return { suffix: instanceSuffix, ok: true, detail: sectionId };
    }, suffix);
    refreshed.push(result);
  }
  return refreshed;
}

/** Snapshot enough state to tell whether a click did anything at all. */
async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.href,
    aria: [...document.querySelectorAll('[aria-selected],[aria-expanded],[aria-current],[open]')]
      .map((el) => `${el.tagName}.${el.className}:${el.getAttribute('aria-selected') ?? ''}${el.getAttribute('aria-expanded') ?? ''}${el.getAttribute('aria-current') ?? ''}${el.hasAttribute('open') ? 'open' : ''}`)
      .join('|'),
    visible: [...document.querySelectorAll('[role="tabpanel"],details,dialog')]
      .map((el) => (el.hasAttribute('hidden') || el.hasAttribute('open') === false ? '0' : '1')).join(''),
    checked: [...document.querySelectorAll('input')].map((i) => (i.checked ? '1' : '0')).join(''),
    video: [...document.querySelectorAll('video')]
      .map((video) => `${video.paused ? 'paused' : 'playing'}:${video.dataset.userPaused || ''}`)
      .join('|'),
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 4000),
    scrollY: Math.round(window.scrollY),
  }));
}

async function auditVideos(page) {
  await page.waitForTimeout(3500);
  return page.evaluate(() =>
    [...document.querySelectorAll('video')].map((v, i) => ({
      index: i,
      src: (v.currentSrc || v.src || '').split('/').pop().slice(0, 40),
      autoplayAttr: v.hasAttribute('autoplay'),
      muted: v.muted,
      paused: v.paused,
      currentTime: Number(v.currentTime.toFixed(2)),
      readyState: v.readyState,
      networkState: v.networkState,
      inViewport: (() => { const r = v.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })(),
      displayed: v.offsetParent !== null,
    })));
}

async function auditClickables(page, consoleErrors) {
  const SEL = ['a[href]', 'button', '[role="tab"]', 'summary',
    'input[type="radio"]', 'input[type="checkbox"]'].join(',');
  const total = (await page.$$(SEL)).length;

  const results = [];
  for (let idx = 0; idx < total; idx += 1) {
    // re-query every iteration: a control that navigates invalidates every stale handle
    const els = await page.$$(SEL);
    const el = els[idx];
    if (!el) continue;
    let info;
    try {
      info = await el.evaluate((node) => {
      const r = node.getBoundingClientRect();
      const ariaCurrent = node.getAttribute('aria-current');
      return {
        tag: node.tagName.toLowerCase(),
        cls: (node.className || '').toString().slice(0, 60),
        label: (node.innerText || node.getAttribute('aria-label') || node.value || '').replace(/\s+/g, ' ').trim().slice(0, 48),
        href: node.getAttribute('href') || '',
        type: node.getAttribute('type') || '',
        active: node.matches(':checked') || (ariaCurrent != null && ariaCurrent !== 'false') || node.getAttribute('aria-selected') === 'true',
        disabled: node.matches(':disabled') || node.getAttribute('aria-disabled') === 'true',
        visible: r.width > 0 && r.height > 0 && node.offsetParent !== null,
        size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        section: node.closest('[id^="shopify-section"]')?.id.replace(/^shopify-section-template--\d+__/, '') || '',
      };
      });
    } catch { continue; }
    if (!info.visible) continue;

    if (info.disabled) {
      results.push({ ...info, kind: 'control', verdict: 'disabled (intentional)' });
      continue;
    }

    // links: verify the destination instead of navigating away
    if (info.tag === 'a' && info.href) {
      let verdict = 'ok';
      if (info.href.startsWith('#')) {
        const exists = await page.evaluate((h) => !!document.querySelector(h) || !!document.getElementById(h.slice(1)), info.href);
        verdict = exists ? 'anchor ok' : 'ANCHOR TARGET MISSING';
      } else if (info.href.startsWith('/')) {
        const status = await page.evaluate(async (h) => (await fetch(h, { method: 'GET' })).status, info.href);
        verdict = status === 200 ? 'link 200' : `LINK ${status}`;
      } else if (/^https?:/.test(info.href)) {
        verdict = 'external';
      } else if (info.href === '' || info.href === '#') {
        verdict = 'EMPTY HREF';
      }
      results.push({ ...info, kind: 'link', verdict });
      continue;
    }

    // buttons / tabs / inputs: click and diff the page state
    const before = await snapshot(page);
    const errorsBefore = consoleErrors.length;
    let clicked = true;
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 2000 });
      // visually-hidden radios/checkboxes are driven by their <label> — click what a user clicks
      const proxyId = await el.evaluate((node) => {
        if (!['INPUT'].includes(node.tagName)) return null;
        const cs = getComputedStyle(node);
        const hidden = cs.pointerEvents === 'none' || cs.opacity === '0' || node.getBoundingClientRect().width < 4;
        return hidden && node.id ? node.id : null;
      });
      if (proxyId) {
        await page.locator(`label[for="${proxyId}"]`).first().click({ timeout: 2500, noWaitAfter: true });
      } else {
        await el.click({ timeout: 2500, noWaitAfter: true });
      }
      await page.waitForTimeout(450);
    } catch {
      clicked = false;
    }
    let after;
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 2500 }).catch(() => {});
      after = await snapshot(page);
    } catch {
      // the click navigated and tore down the context: that IS the observed behaviour
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      after = { ...before, url: page.url() + '#navigated' };
    }

    const changed = [];
    if (before.url !== after.url) changed.push('url');
    if (before.aria !== after.aria) changed.push('aria');
    if (before.visible !== after.visible) changed.push('visibility');
    if (before.checked !== after.checked) changed.push('checked');
    if (before.video !== after.video) changed.push('video');
    if (before.text !== after.text) changed.push('content');
    const newErrors = consoleErrors.slice(errorsBefore);
    let activeAfter = false;
    try {
      activeAfter = await el.evaluate((node) => {
        const ariaCurrent = node.getAttribute('aria-current');
        return node.matches(':checked') || (ariaCurrent != null && ariaCurrent !== 'false') || node.getAttribute('aria-selected') === 'true';
      });
    } catch { /* navigation or a section swap can replace the clicked node */ }

    results.push({
      ...info,
      kind: 'control',
      verdict: !clicked ? 'NOT CLICKABLE'
        : changed.length === 0 && (info.active || activeAfter) ? 'already active'
        : changed.length === 0 ? 'NO-OP (nothing changed)'
        : changed.join('+'),
      jsErrors: newErrors.length ? newErrors : undefined,
    });

    if (before.url !== after.url) {
      // the control navigated (add-to-cart submits a form, for example). Get back, patiently:
      // a redirect chain can still be in flight when we ask.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await page.waitForTimeout(600);
          await page.goto(PAGE_URL.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
          break;
        } catch { /* retry */ }
      }
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      if (REFRESH_SECTIONS.length) {
        const recoveryRefresh = await refreshSections(page, REFRESH_SECTIONS);
        const failed = recoveryRefresh.filter((item) => !item.ok);
        if (failed.length) throw new Error(`post-navigation section refresh failed: ${JSON.stringify(failed)}`);
      }
    }
  }
  return results;
}

async function runTests(page, file) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];
  for (const t of spec.assertions) {
    let pass = false;
    let detail = '';
    try {
      if (t.type === 'exists') {
        const n = await page.locator(t.selector).count();
        pass = t.min ? n >= t.min : n > 0;
        detail = `count=${n}`;
      } else if (t.type === 'count') {
        const n = await page.locator(t.selector).count();
        pass = n === t.equals;
        detail = `count=${n} expected=${t.equals}`;
      } else if (t.type === 'text') {
        const target = page.locator(t.selector || 'body').first();
        // Hidden copy is opt-in so visible-state assertions cannot be satisfied
        // by an inactive tab or a closed disclosure elsewhere in the DOM.
        const body = t.include_hidden ? await target.textContent() : await target.innerText();
        pass = (body || '').replace(/\s+/g, ' ').includes(t.contains.replace(/\s+/g, ' '));
        detail = pass ? 'found' : `missing: ${t.contains.slice(0, 60)}`;
      } else if (t.type === 'video-playing') {
        await page.waitForTimeout(3000);
        const v = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? { paused: el.paused, t: el.currentTime } : null;
        }, t.selector);
        pass = !!v && !v.paused && v.t > 0.1;
        detail = JSON.stringify(v);
      } else if (t.type === 'video-toggle') {
        const toggle = page.locator(t.selector).first();
        const videoSelector = t.video_selector || '.lp-science-tabs__panel:not([hidden]) video';
        const video = page.locator(videoSelector).first();
        await toggle.click();
        await page.waitForTimeout(150);
        const paused = await video.evaluate((el) => el.paused && el.dataset.userPaused === 'true');
        await toggle.click();
        await page.waitForTimeout(450);
        const replayed = await video.evaluate((el) => !el.paused && el.dataset.userPaused === 'false');
        pass = paused && replayed;
        detail = `paused=${paused} replayed=${replayed}`;
      } else if (t.type === 'video-play-buttons') {
        const buttons = page.locator(t.selector);
        const videos = page.locator(t.video_selector);
        const count = await buttons.count();
        const expected = t.equals || count;
        const states = [];
        for (let index = 0; index < count; index += 1) {
          await buttons.nth(index).click();
          await page.waitForFunction(
            ({ selector, item }) => {
              const video = document.querySelectorAll(selector)[item];
              return video && !video.paused && video.currentTime > 0.05;
            },
            { selector: t.video_selector, item: index },
            { timeout: 10000 }
          );
          states.push(await videos.nth(index).evaluate((video) => ({
            paused: video.paused,
            currentTime: video.currentTime,
            source: video.currentSrc,
          })));
          await videos.nth(index).evaluate((video) => video.pause());
        }
        pass = count === expected
          && states.length === expected
          && states.every((state) => !state.paused && state.currentTime > 0.05 && state.source);
        detail = JSON.stringify({ count, expected, states });
      } else if (t.type === 'product-switch') {
        const selector = t.selector || 'lp-buy-box';
        const root = page.locator(selector).first();
        const states = [];
        for (const handle of t.handles) {
          await root.locator(`[data-product-handle="${handle}"]`).click();
          await page.waitForFunction(
            ({ rootSelector, current }) => document.querySelector(rootSelector)?.dataset.currentHandle === current,
            { rootSelector: selector, current: handle }
          );
          states.push(await root.evaluate((el) => ({
            handle: el.dataset.currentHandle,
            focusedHandle: el.querySelector(':focus')?.dataset.productHandle || '',
            title: el.querySelector('.lp-buy-box__title')?.textContent.trim(),
            subtitle: el.querySelector('.lp-buy-box__subtitle')?.textContent.trim(),
            flavor: el.querySelector('.lp-buy-box__flavor')?.textContent.trim(),
            hero: el.querySelector('[data-media-slide] img')?.currentSrc || '',
            slides: el.querySelectorAll('[data-media-slide]').length,
            prices: [...el.querySelectorAll('.lp-buy-box__price')].map((node) => node.textContent.trim()),
            benefits: [...el.querySelectorAll('.lp-buy-box__benefit-heading')]
              .map((node) => node.textContent.replace(/\s+/g, ' ').trim()),
          })));
        }
        const uniqueHeroes = new Set(states.map((state) => state.hero)).size;
        const expectedCopy = !t.expected || states.every((state) => {
          const expected = t.expected[state.handle];
          return expected
            && state.title === expected.title
            && state.subtitle === expected.subtitle
            && state.flavor === expected.flavor
            && state.benefits.includes(expected.first_benefit);
        });
        pass = states.length === t.handles.length
          && states.every((state) => state.slides === (t.media_count || 10))
          && states.every((state) => t.prices.every((price) => state.prices.includes(price)))
          && states.every((state) => state.focusedHandle === state.handle)
          && uniqueHeroes === t.handles.length
          && expectedCopy;
        detail = JSON.stringify({ uniqueHeroes, expectedCopy, states });
      } else if (t.type === 'no-broken-links') {
        const bad = await page.evaluate(async () => {
          const out = [];
          for (const a of document.querySelectorAll('a[href^="/"]')) {
            const r = await fetch(a.getAttribute('href'));
            if (r.status !== 200) out.push(a.getAttribute('href') + ':' + r.status);
          }
          return out;
        });
        pass = bad.length === 0;
        detail = bad.join(',') || 'all 200';
      } else if (t.type === 'no-horizontal-overflow') {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        pass = over <= 2;
        detail = `overflow=${over}px`;
      }
    } catch (e) {
      detail = 'ERROR ' + String(e).slice(0, 120);
    }
    out.push({ ...t, pass, detail });
  }
  return out;
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=document-user-activation-required'] });
const { page, context, consoleErrors } = await openPage(browser);
const refreshed = REFRESH_SECTIONS.length ? await refreshSections(page, REFRESH_SECTIONS) : [];

if (TESTS_FILE) {
  const refreshFailures = refreshed
    .filter((item) => !item.ok)
    .map((item) => ({
      id: `refresh-${item.suffix}`,
      type: 'section-refresh',
      pass: false,
      detail: item.detail,
    }));
  const results = [...refreshFailures, ...await runTests(page, TESTS_FILE)];
  const failed = results.filter((r) => !r.pass);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, refreshed, results }, null, 1));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}

const failedRefreshes = refreshed.filter((item) => !item.ok);
if (failedRefreshes.length) {
  console.error('Section refresh failed:', JSON.stringify(failedRefreshes));
  await browser.close();
  process.exit(1);
}

const videos = await auditVideos(page);
const clickables = await auditClickables(page, consoleErrors);
await browser.close();

const problems = clickables.filter((c) => /NO-OP|MISSING|LINK [45]|EMPTY|NOT CLICKABLE/.test(c.verdict));
const staticVideos = videos.filter((v) => v.displayed && v.paused);
const reportedConsoleErrors = [...new Set(consoleErrors)]
  .filter((error) => !error.includes('otlp-http-production.shopifysvc.com'));

const md = [
  `# Interaction audit — ${VIEWPORT.width}px viewport`,
  '',
  `Page: ${PAGE_PATH}. Every visible control was clicked and the page state diffed before/after.`,
  refreshed.length ? `Current section instances refreshed before audit: ${refreshed.map((item) => item.suffix).join(', ')}.` : '',
  '',
  '## Videos',
  '',
  '| # | src | autoplay attr | muted | paused | currentTime | readyState | displayed |',
  '|---|---|---|---|---|---|---|---|',
  ...videos.map((v) => `| ${v.index} | ${v.src} | ${v.autoplayAttr} | ${v.muted} | ${v.paused} | ${v.currentTime} | ${v.readyState} | ${v.displayed} |`),
  '',
  staticVideos.length ? `**${staticVideos.length} visible video(s) not playing.**` : 'All visible videos are playing.',
  '',
  '## Controls that did not behave',
  '',
  problems.length ? '| section | element | label | verdict |\n|---|---|---|---|' : '_none_',
  ...problems.map((p) => `| ${p.section} | ${p.tag}.${p.cls.split(' ')[0]} | ${p.label} | ${p.verdict} |`),
  '',
  '## All controls',
  '',
  '| section | element | label | size | verdict |',
  '|---|---|---|---|---|',
  ...clickables.map((c) => `| ${c.section} | ${c.tag}.${c.cls.split(' ')[0]} | ${c.label} | ${c.size} | ${c.verdict} |`),
  '',
  reportedConsoleErrors.length ? '## Console errors\n\n' + reportedConsoleErrors.map((e) => `- ${e}`).join('\n') : '',
].join('\n');

const outFile = path.join('docs', 'receipts', `interaction-audit-${VIEWPORT.width}.md`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, md + '\n');
console.log(`${videos.length} videos, ${clickables.length} controls, ${problems.length} problems, ${staticVideos.length} static videos -> ${outFile}`);
