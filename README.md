# firstday-lp-rebuild

Clean-room rebuild of [`firstday.com/pages/tdk-behind-the-science-lp`](https://firstday.com/pages/tdk-behind-the-science-lp)
as a standard Shopify theme (Dawn 15.5.0 base, vanilla Liquid/CSS/JS — no frameworks, no
build step, non-headless), built as a hiring take-home for First Day.

**Preview:** `https://firstday-lp-rebuild.myshopify.com/pages/tdk-behind-the-science-lp`
(store password in the submission notes; the homepage redirects here). Deploys via the
Shopify GitHub integration from `main` — the same pipeline First Day production uses.

## About the timebox — read this before the commit history

The brief says ~3–4 hours. The history spans three evenings, so here is exactly what is in it.

**`git checkout timebox`** is the deliverable as briefed: the LP rebuilt, `docs/` written,
Lighthouse receipts captured. That tag sits on the commit where the brief's checklist was
complete. Commit timestamps show the work behind it: two sittings, Friday evening and Saturday
afternoon.

Everything after the tag is **extended work, and it is separable on purpose**:

| After the tag | Why it exists |
|---|---|
| `tools/qa_interactions.mjs` — clicks every control, diffs page state | it found controls that changed nothing, which no screenshot catches |
| `tools/section_loop.py` — analyze → build → verify, with a test runner between the models | the debrief is about process; this is the process as a runnable thing rather than a description |
| Kids and Toddlers variants | the claim "a new variant is data, not code" is worth more demonstrated than asserted |
| Real selling plans, in-place product switching | the last stubs on the page, closed |
| Parity fixes | the loop and the audits kept finding real defects; leaving them in to protect a tag would be the wrong call |

I would rather show the timebox honestly than compress the log. If the question is "can this
person ship inside a box", the tag answers it. If the question is "what does this person do when
the box is open", the rest answers that — and for a role where the engineer is the whole
engineering team, that seemed worth answering too.

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

## This is a reusable system, not one page

Everything here is built to be used again by the next funnel, and by people who don't write
Liquid:

| Layer | What it is | Who owns it |
|---|---|---|
| `assets/lp-brand.css` | palette + type tokens (transplanted from the original's own CSS variables) | design / dev, once |
| `sections/lp-*.liquid` | 11 generic sections, full schemas, presets — addable to any page in the theme editor | dev |
| product **metafields** | facts that belong to the product (servings, age range, flavor) | merchandising, once per product |
| **metaobjects** | content reused across LPs (`science_claim`) | content/compliance, once |
| template JSON | which sections, in what order, with which copy | CRO / growth, per LP |

**Live proof it composes:** `templates/page.kde-behind-the-science.json` is a second funnel
(`/pages/kde-behind-the-science-lp`) built by `tools/build_template.py` from the same
fragments with one override — a different product. Its buy box shows the Kids' product name,
its own serving count, age range and flavor, because those come from that product's
metafields. **No new Liquid, no new CSS, no new section.** That's the answer to 60 hand-cloned
LPs.

## Creating a new LP variant (~15 min, no developer)

1. Pick or seed the content: `python3 tools/seed_metaobjects.py` (science claims — reuse
   entries via `product_scope`) and `python3 tools/seed_metafields.py` (product facts)
2. Add a `variant(...)` block in `tools/build_template.py` with the overrides that differ,
   then run it — the new template JSON is generated from the shared fragments
3. Commit → the GitHub integration deploys; create the page and point it at the template
