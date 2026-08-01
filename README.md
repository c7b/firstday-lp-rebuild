# firstday-lp-rebuild

Clean-room rebuild of [`firstday.com/pages/tdk-behind-the-science-lp`](https://firstday.com/pages/tdk-behind-the-science-lp)
as a standard Shopify theme (Dawn 15.5.0 base, vanilla Liquid/CSS/JS — no frameworks, no
build step, non-headless), built as a hiring take-home for First Day.

**Preview:** `https://firstday-lp-rebuild.myshopify.com/pages/tdk-behind-the-science-lp`
(store password in the submission notes; the homepage redirects here). Deploys via the
Shopify GitHub integration from `main` — the same pipeline First Day production uses.

## What the original was, and what it became

| | Original | Rebuild |
|---|---|---|
| Template sections | 19 (2 Replo exports, `custom_liquid`, a 722KB CSS-injection section, a hash-named section, 8 sections rendering nothing) | **10 instances of 8 owned sections**, full settings/blocks schemas |
| Copy | baked into exported markup | template JSON + one metaobject case — editable per variant in the theme editor |
| New LP variant | hand-cloned page (60 `-lp` pages in the sitemap today) | new template JSON + content entries — zero new code |

## Performance (Lighthouse mobile, local run, same machine & profile both sides)

| Metric | Original | Rebuild | |
|---|---|---|---|
| Performance score | 26 | **73** | 2.8× |
| First Contentful Paint | 5.3 s | **1.8 s** | 2.9× |
| LCP | 8.4 s | **3.8 s** | 2.2× |
| Total blocking time | 20,860 ms | **570 ms** | 36× |
| Speed Index | 37.5 s | **3.1 s** | 12× |
| Page weight | 32 MB | **15.4 MB** | 2× |

Remaining weight is dominated by the four science videos (same assets the original plays,
now self-hosted) — the next perf step is deferring video fetch until the tabs scroll into
view (PLAN.md).

Receipts: `docs/receipts/`. Methodology note: local Lighthouse CLI (mobile emulation,
throttled) against both pages because PSI can't reach a password-protected dev store — same
tool, same box, same profile on both sides of the table.

## Repo map

- `sections/lp-*.liquid` + `assets/lp-*` — the 8 sections (BEM-scoped CSS, JS only where
  earned: tabs, buy-box carousel)
- `templates/page.tdk-behind-the-science.json` — the page IS this file
- `docs/PROCESS.md` — **how this was actually built** (the AI orchestration, written live)
- `docs/ASSUMPTIONS.md` — decisions incl. what was deliberately NOT built
- `docs/PLAN.md` — timebox cuts with estimates + the 60-LP variant-factory roadmap
- `docs/context/` — the actual context files given to builder agents (specs, extracted
  content, template fragments, review log)
- `tools/` — deterministic extraction, template assembly, metaobject seeding, review gates

## Creating a new LP variant (~15 min, no developer)

1. `python3 tools/seed_metaobjects.py` with the variant's claims (or reuse existing entries —
   `science_claim.product_scope` tags the product line)
2. Copy the template fragments you want, adjust copy/URLs, run `python3 tools/build_template.py`
3. Commit → the GitHub integration deploys; point a new page at the template
