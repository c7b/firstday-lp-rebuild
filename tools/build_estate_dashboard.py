#!/usr/bin/env python3
"""Render docs/receipts/lp-estate-graph.json as a self-contained work map.

A table of 60 rows is a report nobody reads twice. This draws the estate as what it actually
is — a handful of funnels cloned many times — and hangs each page's measured backlog off its
node, shaped for an agent to pick up rather than for a human to re-derive.

Run: python3 tools/build_estate_dashboard.py  →  docs/receipts/estate.html
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "docs" / "receipts" / "lp-estate-graph.json"
OUT = ROOT / "docs" / "receipts" / "estate.html"

# funnels already rebuilt on the dev store — these are the "done" nodes
MIGRATED = {"tdk-behind-the-science-lp", "kde-behind-the-science-lp"}


def main():
    if not GRAPH.exists():
        raise SystemExit(f"missing {GRAPH.relative_to(ROOT)} — run tools/audit_lp_estate.py first")

    graph = json.loads(GRAPH.read_text())
    nodes = graph["nodes"]
    for n in nodes:
        n["migrated"] = n["handle"] in MIGRATED

    total_mb = sum(n["weight_kb"] for n in nodes) / 1024
    backlog = [i for n in nodes for i in n.get("backlog", [])]
    builds = Counter(n["build_type"] for n in nodes)
    families = Counter(n["family"] for n in nodes)
    biggest_family = families.most_common(1)[0] if families else ("—", 0)

    payload = json.dumps({"nodes": nodes, "edges": graph.get("edges", []),
                          "generated": graph.get("generated", "")}, separators=(",", ":"))

    stats = {
        "pages": len(nodes),
        "mb": f"{total_mb:.0f}",
        "backlog": len(backlog),
        "migrated": sum(1 for n in nodes if n["migrated"]),
        "replo": builds.get("replo", 0),
        "sections": builds.get("sections", 0),
        "families": len(families),
        "biggest_family": f"{biggest_family[0]} ({biggest_family[1]})",
    }

    OUT.write_text(TEMPLATE.replace("__DATA__", payload).replace("__STATS__", json.dumps(stats)))
    print(f"wrote {OUT.relative_to(ROOT)} — {stats['pages']} nodes, {stats['backlog']} backlog items")


TEMPLATE = r"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>First Day — landing page estate</title>
<style>
  :root {
    color-scheme: dark light;
    --bg: #0c1013;
    --panel: #141b1f;
    --line: #232e34;
    --ink: #e8eeec;
    --ink-soft: #9aabaa;
    --ink-faint: #66787a;
    --accent: #5fc9a5;
    --warn: #e0a171;
    --neutral: #6f8792;
    --done: #7ee0c0;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: var(--sans); font-size: 15px; line-height: 1.55;
    display: grid; grid-template-rows: auto auto 1fr; height: 100vh; overflow: hidden;
  }
  header { padding: 18px 24px 0; }
  h1 { margin: 0; font-size: 19px; letter-spacing: -0.01em; }
  .claim { margin: 4px 0 0; color: var(--ink-soft); max-width: 78ch; font-size: 14px; }
  .stats { display: flex; flex-wrap: wrap; gap: 26px; padding: 14px 24px 16px; border-bottom: 1px solid var(--line); }
  .stat .n { font-family: var(--mono); font-size: 22px; font-variant-numeric: tabular-nums; }
  .stat .l { font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-faint); }
  .stat .n.warn { color: var(--warn); }
  .stat .n.ok { color: var(--done); }
  main { display: grid; grid-template-columns: minmax(0,1fr) 340px; min-height: 0; }
  @media (max-width: 860px) { main { grid-template-columns: minmax(0,1fr); } aside { display: none; } }
  .stage { position: relative; min-height: 0; }
  canvas { display: block; width: 100%; height: 100%; }
  .controls { position: absolute; top: 12px; left: 16px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .chip {
    font-family: var(--mono); font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
    padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line);
    background: rgb(20 27 31 / 82%); color: var(--ink-soft); cursor: pointer;
  }
  .chip[aria-pressed="true"] { color: var(--bg); background: var(--accent); border-color: var(--accent); }
  .chip.warn[aria-pressed="true"] { background: var(--warn); border-color: var(--warn); }
  input[type=search] {
    font-family: var(--mono); font-size: 12px; padding: 6px 10px; border-radius: 999px;
    border: 1px solid var(--line); background: rgb(20 27 31 / 82%); color: var(--ink); width: 170px;
  }
  aside { border-left: 1px solid var(--line); background: var(--panel); overflow-y: auto; padding: 18px 18px 40px; }
  aside h2 { margin: 0 0 2px; font-size: 15px; overflow-wrap: anywhere; }
  aside .meta { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); }
  .kv { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 14px 0; font-size: 13px; }
  .kv dt { font-family: var(--mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-faint); align-self: center; }
  .kv dd { margin: 0; font-family: var(--mono); font-variant-numeric: tabular-nums; }
  .tag { display: inline-block; font-family: var(--mono); font-size: 10px; letter-spacing: .08em;
         text-transform: uppercase; padding: 2px 7px; border-radius: 4px; }
  .tag.replo { background: rgb(224 161 113 / 18%); color: var(--warn); }
  .tag.sections { background: rgb(95 201 165 / 16%); color: var(--accent); }
  .tag.page-body, .tag.unknown { background: rgb(111 135 146 / 18%); color: var(--neutral); }
  h3.sec { margin: 20px 0 8px; font-family: var(--mono); font-size: 10px; letter-spacing: .12em;
           text-transform: uppercase; color: var(--ink-faint); }
  .job { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
  .job .t { font-weight: 600; font-size: 14px; }
  .job .m { display: flex; gap: 8px; margin-top: 5px; font-family: var(--mono); font-size: 10px;
            letter-spacing: .06em; text-transform: uppercase; color: var(--ink-faint); }
  .job .m .i-high { color: var(--warn); }
  .job .ev { margin-top: 6px; font-family: var(--mono); font-size: 11px; color: var(--ink-soft); overflow-wrap: anywhere; }
  .list { display: flex; flex-direction: column; gap: 1px; }
  .list button {
    text-align: left; background: none; border: 0; border-bottom: 1px solid var(--line);
    color: var(--ink); font: inherit; font-size: 13px; padding: 7px 2px; cursor: pointer;
    display: flex; justify-content: space-between; gap: 10px;
  }
  .list button:hover, .list button:focus-visible { background: rgb(95 201 165 / 10%); outline: none; }
  .list .w { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); }
  .empty { color: var(--ink-faint); font-size: 13px; }
  a { color: var(--accent); }
</style>

<header>
  <h1>The landing page estate</h1>
  <p class="claim">These are not 60 separate problems. They are a handful of funnels cloned many
    times — and every job below came from a measured number on that page, not an opinion.</p>
</header>

<div class="stats" id="stats"></div>

<main>
  <div class="stage">
    <canvas id="c"></canvas>
    <div class="controls">
      <button class="chip" data-filter="sections" aria-pressed="false">sections</button>
      <button class="chip warn" data-filter="replo" aria-pressed="false">page builder</button>
      <button class="chip" data-filter="migrated" aria-pressed="false">rebuilt</button>
      <input type="search" id="q" placeholder="filter by handle" aria-label="Filter pages by handle">
    </div>
  </div>
  <aside id="panel"></aside>
</main>

<script>
const DATA = __DATA__;
const STATS = __STATS__;

document.getElementById('stats').innerHTML = [
  ['pages measured', STATS.pages, ''],
  ['html shipped', STATS.mb + ' MB', 'warn'],
  ['stuck in a page builder', STATS.replo + '/' + STATS.pages, 'warn'],
  ['already rebuilt', STATS.migrated, 'ok'],
  ['jobs queued', STATS.backlog, ''],
  ['distinct funnels', STATS.families, ''],
].map(([l, n, cls]) => `<div class="stat"><div class="n ${cls}">${n}</div><div class="l">${l}</div></div>`).join('');

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLOR = { sections: '#5fc9a5', replo: '#e0a171', 'page-body': '#6f8792', unknown: '#6f8792' };

let W = 0, H = 0, dpr = 1;
const nodes = DATA.nodes.map((n, i) => ({
  ...n,
  r: Math.max(5, Math.min(20, Math.sqrt(n.weight_kb) / 4.5)),
  x: 0, y: 0, vx: 0, vy: 0, dim: false,
}));
const index = new Map(nodes.map((n, i) => [n.handle, i]));
const edges = DATA.edges
  .map(e => ({ a: index.get(e.from), b: index.get(e.to), type: e.type }))
  .filter(e => e.a !== undefined && e.b !== undefined);

function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const rect = canvas.parentElement.getBoundingClientRect();
  W = rect.width; H = rect.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// seed on a ring so the layout is deterministic; rebuilt funnels start pinned at the centre
function seed() {
  nodes.forEach((n, i) => {
    if (n.migrated) { n.x = W / 2 + (i % 2 ? 26 : -26); n.y = H / 2; return; }
    const a = (i / nodes.length) * Math.PI * 2;
    const rad = Math.min(W, H) * 0.36;
    n.x = W / 2 + Math.cos(a) * rad;
    n.y = H / 2 + Math.sin(a) * rad;
  });
}

let alpha = 1;
function step() {
  const centreX = W / 2, centreY = H / 2;
  for (const n of nodes) {
    n.vx += (centreX - n.x) * 0.0016;
    n.vy += (centreY - n.y) * 0.0016;
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d2 = dx * dx + dy * dy || 0.01;
      const min = (a.r + b.r + 14);
      const force = 900 / d2;
      const d = Math.sqrt(d2);
      const ux = dx / d, uy = dy / d;
      a.vx -= ux * force; a.vy -= uy * force;
      b.vx += ux * force; b.vy += uy * force;
      if (d < min) { const push = (min - d) * 0.5; a.vx -= ux * push; a.vy -= uy * push; b.vx += ux * push; b.vy += uy * push; }
    }
  }
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const k = (d - 120) * 0.0022;
    const ux = dx / d, uy = dy / d;
    a.vx += ux * k * d * 0.02; a.vy += uy * k * d * 0.02;
    b.vx -= ux * k * d * 0.02; b.vy -= uy * k * d * 0.02;
  }
  for (const n of nodes) {
    if (n.migrated) { n.vx *= 0.2; n.vy *= 0.2; }
    n.vx *= 0.86; n.vy *= 0.86;
    n.x = Math.max(n.r + 8, Math.min(W - n.r - 8, n.x + n.vx * alpha));
    n.y = Math.max(n.r + 8, Math.min(H - n.r - 8, n.y + n.vy * alpha));
  }
  alpha *= 0.994;
}

let hover = null, selected = null;
function draw() {
  ctx.clearRect(0, 0, W, H);
  const focus = hover || selected;
  const near = new Set();
  if (focus) {
    near.add(focus.handle);
    edges.forEach(e => {
      if (nodes[e.a] === focus) near.add(nodes[e.b].handle);
      if (nodes[e.b] === focus) near.add(nodes[e.a].handle);
    });
  }
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    if (a.dim || b.dim) continue;
    const lit = focus && (a === focus || b === focus);
    ctx.strokeStyle = lit ? 'rgba(95,201,165,.5)' : 'rgba(140,165,175,.09)';
    ctx.lineWidth = lit ? 1.2 : 0.6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const n of nodes) {
    const faded = n.dim || (focus && !near.has(n.handle));
    ctx.globalAlpha = faded ? 0.16 : 1;
    ctx.fillStyle = n.migrated ? '#7ee0c0' : (COLOR[n.build_type] || '#6f8792');
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    if (n.migrated) { ctx.strokeStyle = '#e8eeec'; ctx.lineWidth = 1.6; ctx.stroke(); }
    if (n === selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2); ctx.stroke(); }
    if (!faded && (n.r > 13 || n === focus)) {
      ctx.globalAlpha = faded ? 0.16 : 0.72;
      ctx.fillStyle = '#9aabaa';
      ctx.font = '10px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.handle.replace(/-lp$/, '').slice(0, 22), n.x, n.y + n.r + 12);
    }
    ctx.globalAlpha = 1;
  }
}

function frame() {
  if (alpha > 0.02) step();
  draw();
  requestAnimationFrame(frame);
}

function at(mx, my) {
  return nodes.find(n => !n.dim && Math.hypot(n.x - mx, n.y - my) <= n.r + 4) || null;
}

canvas.addEventListener('mousemove', ev => {
  const r = canvas.getBoundingClientRect();
  hover = at(ev.clientX - r.left, ev.clientY - r.top);
  canvas.style.cursor = hover ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => { hover = null; });
canvas.addEventListener('click', ev => {
  const r = canvas.getBoundingClientRect();
  const n = at(ev.clientX - r.left, ev.clientY - r.top);
  if (n) select(n);
});

const panel = document.getElementById('panel');
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function select(n) {
  selected = n;
  const jobs = (n.backlog || []).map(j => `
    <div class="job">
      <div class="t">${esc(j.title)}</div>
      <div class="m"><span class="i-${esc(j.impact)}">${esc(j.impact)} impact</span><span>effort ${esc(j.effort)}</span><span>${esc(j.agent)}</span></div>
      <div class="ev">${esc(Object.entries(j.evidence || {}).map(([k, v]) => k + ': ' + v).join(' · '))}</div>
    </div>`).join('') || '<p class="empty">Nothing queued — this page is already in the shared sections.</p>';

  panel.innerHTML = `
    <h2>${esc(n.handle)}</h2>
    <p class="meta">${esc(n.family)} · ${esc(n.funnel)}${n.offer_flags && n.offer_flags.length ? ' · ' + esc(n.offer_flags.join(', ')) : ''}</p>
    <p style="margin:10px 0 0"><span class="tag ${esc(n.build_type)}">${esc(n.build_type)}</span>${n.migrated ? ' <span class="tag sections">rebuilt</span>' : ''}</p>
    <dl class="kv">
      <dt>weight</dt><dd>${n.weight_kb} KB</dd>
      <dt>sections</dt><dd>${n.template_sections}${n.empty_sections ? ' (' + n.empty_sections + ' empty)' : ''}</dd>
      <dt>scripts</dt><dd>${n.scripts}</dd>
      <dt>overlap</dt><dd>${n.overlap_pct == null ? '—' : n.overlap_pct + '%'}</dd>
    </dl>
    <h3 class="sec">Queued work — ${(n.backlog || []).length}</h3>
    ${jobs}
    <h3 class="sec">Third parties — ${(n.vendors || []).length}</h3>
    <p class="meta">${esc((n.vendors || []).join(', ')) || '—'}</p>
    <h3 class="sec">Open</h3>
    <p><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.handle)} ↗</a></p>`;
}

function showList() {
  const rows = nodes.filter(n => !n.dim).sort((a, b) => b.weight_kb - a.weight_kb).map((n, i) =>
    `<button data-i="${nodes.indexOf(n)}"><span>${esc(n.handle.replace(/-lp$/, ''))}</span><span class="w">${Math.round(n.weight_kb)}KB · ${(n.backlog || []).length}</span></button>`).join('');
  panel.innerHTML = `<h2>Every page</h2><p class="meta">Heaviest first. Click a row or a node.</p>
    <h3 class="sec">${nodes.filter(n => !n.dim).length} shown</h3><div class="list">${rows}</div>`;
  panel.querySelectorAll('button[data-i]').forEach(b =>
    b.addEventListener('click', () => select(nodes[Number(b.dataset.i)])));
}

const active = new Set();
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    if (active.has(f)) { active.delete(f); chip.setAttribute('aria-pressed', 'false'); }
    else { active.add(f); chip.setAttribute('aria-pressed', 'true'); }
    applyFilters();
  });
});
document.getElementById('q').addEventListener('input', applyFilters);

function applyFilters() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  nodes.forEach(n => {
    const byType = !active.size || [...active].some(f => f === 'migrated' ? n.migrated : n.build_type === f);
    const byText = !q || n.handle.includes(q);
    n.dim = !(byType && byText);
  });
  if (selected && selected.dim) { selected = null; }
  if (!selected) showList();
  alpha = Math.max(alpha, 0.25);
}

addEventListener('resize', () => { resize(); });
resize(); seed();
if (reduce) { for (let i = 0; i < 320; i++) step(); alpha = 0; }
showList();
frame();
</script>
</html>
"""


if __name__ == "__main__":
    main()
