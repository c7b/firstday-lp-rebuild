# BRIEF-COVERAGE.md — the assignment, line by line

The brief is two pages. This file walks it clause by clause and points at the artifact that
satisfies each one, so nothing rests on a reviewer's charity. Anything deliberately *not* done
is listed too, with the reason.

## 2. The Exercise — the ask

> "rebuild one of our core funnels … https://firstday.com/pages/tdk-behind-the-science-lp"

Rebuilt as `templates/page.tdk-behind-the-science.json` on Dawn 15.5.0, live at
`/pages/tdk-behind-the-science-lp` on the dev store. 19 original sections → **11 owned sections,
12 instances**; 7 of the originals render nothing on the live page and were dropped (evidence:
`docs/context/sections/_dropped.json`, verified in a JS-executed DOM dump, not just the
snapshot).

> "Out of Scope: No need to change any visuals or copy"

Copy is **extracted deterministically** from the live page by `tools/extract_content.py` and
transplanted byte-for-byte — no model ever retypes it. `tools/verify_build.py` gates every
template fragment string against that extraction, so invented copy fails the build. Emoji,
typos and trademark symbols are preserved exactly (that includes 🍊💊 in the CTA and 🔥 in the
urgency strip: they are content, not icons, so they were left alone even when an audit flagged
them).

> "no need for additional front-end requirements"

No features were added to the page. Everything beyond parity lives in the architecture
(schemas, metafields, metaobjects) or in `docs/`, not as new UI.

## Deliverables

| The brief asks for | Where it is |
|---|---|
| "A GitHub repository with the code" | `github.com/c7b/firstday-lp-rebuild` — small, readable commits; each one says what changed and why |
| "A working preview theme/store" | `firstday-lp-rebuild.myshopify.com` (theme `firstday-lp-rebuild/main`, deployed by the Shopify GitHub integration). The store's homepage redirects to the LP so there is nothing else to get lost in |
| "Clear communication of any hidden assumptions or constraints" | `docs/ASSUMPTIONS.md` — decisions, stubs, platform constraints hit, and what was deliberately not built |
| "For anything that you ran out of time … a detailed strategy and plan … and on what timeline" | `docs/PLAN.md` — every cut item with an effort estimate and the sequence to land it |

## Assumptions the brief states

> "Standard Shopify Theme"

Dawn 15.5.0, unmodified as the baseline commit. Dawn's own files are untouched except two
deliberate lines: loading `lp-brand.css` in the layout and an og:image fallback in
`snippets/meta-tags.liquid`.

> "Simple Liquid, CSS, HTML, Javascript"

Exactly that. No framework, no build step, no bundler, no dependency in the theme. The only
npm packages in the repo are dev tools that never ship to the storefront (Lighthouse for the
performance receipts, Playwright for the QA runner).

> "Checkout Extensions (can be anything, we use react)"

**Deliberately not used.** In the interview the hiring manager drew the line explicitly —
checkout and cart are not to be touched — so the only cart interaction here is a standard
`{% form 'product' %}` add-to-cart. `docs/PLAN.md` records where a checkout UI extension
*would* earn its place (the free-gift threshold that this funnel promises but checkout has to
honour), so the omission is a decision rather than a gap.

## Business context the brief supplies (and expects to see used)

| From the brief | How it shaped the build |
|---|---|
| "The Concerned Picky-Eater Parent … usually the entry point" | This LP is that entry funnel; its buy box leads with the single product and the guarantee, not with a catalogue |
| "The Whole-Family Buyer … expanded into women's, sometimes men's, often subscribes" | The age tabs (Toddlers/Kids/Teens) swap the product **in place** via the Section Rendering API, and cross-family upsells sit under the buy box. Both are settings/blocks, so growth can retune them per variant without a developer |
| "the quiz needs to route all of these cleanly" | Out of scope for this page, but the same routing question shows up here as the age tabs. `docs/PLAN.md` connects the two: the tabs are the funnel-level version of what the quiz does site-wide, and both should read from the same product/segment data rather than hardcoded links |
| Brand voice: "sharp friend who knows nutrition … avoid medical claims" | Copy is untouched, so voice is preserved by construction. It also drove the metaobject choice: the science claims are compliance-sensitive text, so they live in one editable place (`science_claim`) instead of being copy-pasted across 18 LPs where a wording fix would have to be repeated |
| "Most of our revenue is DTC … growing footprints on Amazon and Target" | Argued for native Shopify over anything exotic: the team has to run this without a specialist |

## The number that motivated the architecture

The brief hands over one page. The sitemap (`inputs/firstday-sitemap.xlsx`) shows **60 `-lp`
pages, 18 of them variants of this exact funnel**, cloned by hand. So the build optimises for
the 19th variant, not just the first. Proof it works, live on the dev store:

- `/pages/tdk-behind-the-science-lp` — the funnel the brief asked for
- `/pages/kde-behind-the-science-lp` — Kids variant
- `/pages/toddlers-behind-the-science-lp` — Toddlers variant

Both variants are generated by `tools/build_template.py` with a one-line override each; their
product facts come from **their own product metafields**. No new Liquid, no new CSS, no new
section. `docs/ARCHITECTURE.md` explains the four content layers and the question that picks
between them.

## Time

> "~3–4 hours take-home"

The core rebuild fits that box, and `docs/PROCESS.md` logs it phase by phase as it happened,
including the dead ends. Work that continued past it — the QA runner, the analyze/build/verify
loop, the second and third variants — is separable and labelled as such; it exists because the
process itself is what the debrief is about, not because the page needed it.

## Receipts

| | Original | Rebuild |
|---|---|---|
| Lighthouse performance (mobile) | 26 | 73 |
| Total blocking time | 20,860 ms | 570 ms |
| Speed Index | 37.5 s | 3.1 s |
| Page weight | 32 MB | 15.4 MB |

Same CLI, same machine, same throttling profile on both sides. Raw summaries in
`docs/receipts/`.
