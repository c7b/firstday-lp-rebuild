# firstday-lp-rebuild

Clean-room rebuild of [`firstday.com/pages/tdk-behind-the-science-lp`](https://firstday.com/pages/tdk-behind-the-science-lp)
as a standard Shopify theme — Dawn 15.5.0 base, vanilla Liquid/CSS/JS, no framework, no build
step, non-headless. Built as a hiring take-home for First Day.

**Preview:** `https://firstday-lp-rebuild.myshopify.com/pages/tdk-behind-the-science-lp`
(store password in the submission notes). Deploys from `main` through the Shopify GitHub
integration — the same pipeline First Day already runs.

**Interactive appendix:** [`firstday-storefront-audit.netlify.app`](https://firstday-storefront-audit.netlify.app)
— every landing page, app and product measured from public sources. `noindex`; it is meant to
be handed over, not found.

---

## The short version

The brief was one page. The finding underneath it is the reason for everything else here:

**32 of First Day's 44 ad landing pages contain no Shopify section at all.** They are Replo
exports — one frozen block of markup each. Nothing in them is editable in the theme editor and
nothing in them is reusable by the next page. Measured from the pages themselves, not guessed.

So this repo answers two questions, and they are separable:

1. **Can this page be rebuilt properly?** Yes — 13 section instances from 14 owned sections,
   full schemas, every string editable by a merchant. Lighthouse mobile 26 → 73.
2. **Does the rebuild scale to the other 43?** The same section set drives three live funnels
   from three template files. A new variant is a template JSON plus product metafields —
   **no new Liquid, no new CSS.** `/pages/kde-behind-the-science-lp` and
   `/pages/toddlers-behind-the-science-lp` are that claim, running.

And the finding that turns it into an ordering rather than a list. Reading 413 of First Day's
~520 active ads out of Meta's public library and counting where each one sends people:

**92% of paid landing-page traffic already goes to the section-built pages, not the Replo
ones.** The Replo majority is a maintenance cost, not a revenue surface. So the plan is not
"rewrite 32 pages" — it is: the pages carrying the spend are already sections, and the work
that pays is making *those* excellent and reusable first, then retiring the Replo tail as the
brand or the claims force a touch.

The top two paid landing pages are `kde-behind-the-science-lp` (111 ad links) and
`tdk-behind-the-science-lp` (49) — the page assigned here, and the Kids sibling built as the
variant demo. The single biggest destination on the whole account is neither: it is the
`teens-kickstart-vitamin` product page, at 108.

---

## Performance

Lighthouse mobile, local CLI, same machine and profile on both sides — PSI cannot reach a
password-protected dev store, so both pages were measured the same way rather than one by PSI
and one by hand.

| Metric | Original | Rebuild | |
|---|---|---|---|
| Performance score | 26 | **73** | 2.8× |
| First Contentful Paint | 5.3 s | **1.8 s** | 2.9× |
| Largest Contentful Paint | 8.4 s | **3.8 s** | 2.2× |
| Total blocking time | 20,860 ms | **570 ms** | 36× |
| Speed Index | 37.5 s | **3.1 s** | 12× |
| Page weight | 32 MB | **15.4 MB** | 2× |

Remaining weight is the four science videos — the same assets the original plays, now
self-hosted rather than hotlinked. Deferring their fetch until the tabs scroll into view is
the next step, costed in `docs/PLAN.md`.

Receipts: `docs/receipts/lh-*.summary.json`.

---

## Repo map

Read in this order if you have ten minutes: this file → `docs/ASSUMPTIONS.md` →
`docs/PROCESS.md` → the preview.

| Path | What is in it |
|---|---|
| `sections/lp-*.liquid` | The 14 owned sections. BEM-scoped CSS in `assets/lp-*.css`; JS only where earned (tabs, carousel, cart-aware buy box). |
| `templates/page.*-behind-the-science.json` | The three funnels. **The page is this file** — sections, order, and every string. |
| `docs/context/template-fragments/` | One JSON per section instance. These are the source of truth; the templates are generated from them. |
| `docs/context/sections/` | Copy extracted from the original, per section. The fidelity gate checks the build against these. |
| `docs/context/specs/` | The spec each builder agent was given, written before the code. |
| `docs/context/tests/` | Acceptance assertions per section, run by the Playwright runner. |
| `docs/receipts/` | Outputs, not prose: Lighthouse runs, the estate crawl, the ad-library crawl, the interaction audit, the mobile audit. |
| `tools/` | Everything is reproducible from here. See the table below. |
| `docs/*.md` | The written record — assumptions, process, architecture, plan, brief coverage, CI, metrics. |

### `tools/` — every number in this repo is re-derivable

| Tool | Does what |
|---|---|
| `extract_content.py` | Pulls copy out of the original snapshot deterministically. No model in the loop, so the baseline cannot hallucinate. |
| `verify_build.py` | **The fidelity gate.** Every string in every fragment must appear in the extraction, or the build fails. Deliberate deviations are recorded in the corpus with a reason. |
| `build_template.py` | Assembles templates from fragments. `--check` compares committed vs generated **as data**, so Shopify's key reordering is not read as drift. |
| `qa_interactions.mjs` | Playwright: clicks every visible control and diffs page state. Catches controls that look interactive and do nothing. |
| `section_loop.py` | analyst → builder → runner → verifier, across two model families, with a test runner between them. |
| `audit_lp_estate.py` | Crawls the 44 LPs, classifies build type, emits a backlog where a measured value justifies one. |
| `audit_ad_destinations.mjs` | Meta's public Ad Library → which pages actually carry paid traffic. |
| `collect_company_intel.py` | Public `products.json`, collections, tech fingerprints, sitemap, social. |
| `build_audit_site.py` | Assembles all of it into the deployable appendix. |
| `seed_metaobjects.py` / `seed_metafields.py` | Content that belongs to the store, not the template. |

---

## Why it composes

| Layer | What it holds | Who owns it |
|---|---|---|
| `assets/lp-brand.css` | Palette and type tokens, transplanted from the original's own CSS variables | dev, once |
| `sections/lp-*.liquid` | Generic sections with full schemas and presets — addable to any page in the editor | dev |
| Product **metafields** | Facts belonging to the product: servings, age range, flavour, benefit line | merchandising, once per product |
| **Metaobjects** | Content reused across LPs (`science_claim`) | content / compliance, once |
| Template JSON | Which sections, in what order, with which copy | CRO / growth, per LP |

A new funnel touches only the bottom two rows. That is the whole argument.

**Making one (~15 minutes, no developer):** seed the content with `seed_metaobjects.py` and
`seed_metafields.py`, add a `variant(...)` entry in `build_template.py` with only the settings
that differ, run it, commit. The GitHub integration deploys; create the page and point it at
the template.

---

## About the timebox — read this before the commit history

The brief says ~3–4 hours. The history spans three evenings, so here is exactly what is in it.

**`git checkout timebox`** is the deliverable as briefed: the LP rebuilt, `docs/` written,
Lighthouse captured. Everything after that tag is extended work and is separable on purpose —
the QA runner, the cross-model build loop, the two variants, real selling plans, the estate
and ad audits, and the parity fixes those audits kept surfacing.

I would rather show the timebox honestly than compress the log. If the question is *can this
person ship inside a box*, the tag answers it. If the question is *what do they do when the box
is open*, the rest answers that.

---

## Notes for whoever picks this up next — human or agent

There is no `AGENTS.md`; this section is it.

**Ground rules that are not style preferences.**

- **Never touch checkout or cart** — the client restricted it explicitly and it was restated in
  the interview.
- **Copy and visuals are out of scope.** Every string on the page must survive
  `verify_build.py`. If a deviation is genuinely warranted, add it to the corpus in
  `docs/context/sections/` **with the reason**, and to `docs/ASSUMPTIONS.md`. There are five;
  each is written down.
- **`.env` never enters the repo.** Tools read `SHOPIFY_FLAG_STORE` and `SHOPIFY_ADMIN_TOKEN`
  from the environment.
- **No AI attribution in commits or PRs.** How the work was made belongs in `docs/PROCESS.md`,
  which describes it in full — not in git metadata.

**The loop that keeps it honest**, and the order it runs in:

```
edit a fragment or a section
  → python3 tools/build_template.py      # templates are generated, never hand-edited
  → python3 tools/verify_build.py        # schemas valid + every string traceable to a source
  → python3 tools/build_template.py --check
  → push sections/assets/templates to the theme (the Asset API rejects invalid Liquid)
  → node tools/qa_interactions.mjs       # every control clicked, state diffed
```

A green run is 14/14 sections, 0 failures, 0 warnings, and 0 problems from the interaction
audit. Anything less is a real regression, not noise.

**Things that will bite you**, each one having bitten already:

- Metaobject list settings resolve by **handle** in template JSON, not by gid. A gid returns
  empty and fails silently.
- Colour scheme ids are dashed (`scheme-1`). An invalid id falls back with no error.
- Metaobject arrays have `.size`, not `.count`. `.count` is nil, so the branch goes quiet.
- Richtext settings arrive already wrapped in `<p>`, and carry Dawn's `.rte`, whose
  `> p:last-child` zeroes bottom margins and outranks a class-plus-element selector.
- Shopify's GitHub sync rewrites templates with its own key order. Compare as data
  (`--check`), never byte-for-byte.
- Shopify rejects `"default": ""` in a schema — omit the key. And `url` settings take no
  `#anchor` default; use `text`.
- The published storefront can serve stale compiled templates; QA runs against
  `preview_theme_id`.
- This is a Partner development store, so Shopify serves its **own** password screen. The
  theme's `password.liquid` is never rendered and cannot be themed or pre-filled.
