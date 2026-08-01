# PLAN.md — what didn't fit the timebox, and where this architecture goes

The brief asks for a detailed strategy for anything that ran out of time. Two kinds of items
below: things cut by the timebox (with effort estimates), and the roadmap this architecture
was actually designed for.

## Cut by the timebox — strategy + estimate for each

| Item | Why it's not in | How I'd do it | Est. |
|---|---|---|---|
| **Real subscriptions (selling plans)** | The original's Monthly/One-Time cards run on a subscription app; wiring real selling plans means installing and configuring one — app choice is a business decision, not mine to make in a take-home | Install the subscriptions app of record, define the monthly plan (40% off first order per the original), swap the static delivery cards for `product.selling_plan_groups` rendering — the section's markup is already shaped for it | ~2h |
| **Review app integration** | Reviews are Judge.me content; the rebuild renders the same UI natively from real extracted data | Either install Judge.me and drop their app block into `lp-reviews` (it accepts app blocks), or keep the native section and feed it from a metafield the app writes | ~1h |
| **Gift progress + upsell add-ons (live cart math)** | Cart-drawer logic and gift thresholds are app/checkout territory — explicitly out of scope | Cart AJAX for the progress bar; upsells as real `product_list` setting + add-to-cart forms | ~2h |
| **Overlay dialogs (sale/OTP/upsell)** | Marketing-app overlays, not theme funnel content | Rebuild only if the funnel data says they earn their weight; otherwise leave to the app that owns them | ~1-2h |
| **Image migration to Files** | CDN hotlinks give byte-exact parity today; migration is mechanical | Script: download → upload via Files API → swap `image_url` settings for `image_picker` values (every section already supports both) | ~1h scripted |
| **FAQ content** | The original's FAQ section renders empty on the live page (verified in rendered DOM) — nothing to transplant | The third `lp-media-accordion` instance is a ready fragment; paste real Q&A into blocks when it exists | ~15min |

## The real roadmap: the variant factory (why the architecture looks like this)

The sitemap has **60 `-lp` pages, 18 of them behind-the-science variants** — today each one is
a hand-cloned page. With this architecture, a new variant is:

1. **New template JSON** (`page.kde-behind-the-science-40-off.json`) — assembled by
   `tools/build_template.py` from fragments; no Liquid is written.
2. **Content entries** — `science_claim` metaobjects picked by handle (`product_scope` field
   already tags kde/tdk/wds/mcm); per-variant copy edited in the theme editor by whoever owns
   the funnel — CRO manager, not developer.
3. **A page** pointing at the template.

Next steps to make that fully self-serve, in order:

- **Sheet → variants pipeline (~half a day):** a Google Sheet (or CSV in the repo) with one
  row per variant (product, offer, headline overrides, metaobject handles) that a script turns
  into template JSON + metaobject entries + pages via Admin API. The seeding and assembly
  scripts in `tools/` are already the two halves of this; the sheet is the missing front-end.
  Marketing requests a variant by adding a row.
- **Spanish variants via the same pipeline (~half a day):** the sitemap shows `-spanish-lp`
  clones. Model translations as locale columns in the same sheet (or metaobject fields per
  locale) instead of separate hand-built pages. Worth checking how much of the current
  translation app's scope this quietly replaces.
- **Copy generation with guardrails (opt-in, later):** with claims in metaobjects and brand
  voice documented, drafting variant copy becomes an AI task with a human approval gate —
  drafts land as `draft` metaobject entries, a human publishes. One line here because it's
  roadmap, not scope: the structure is what makes it safe to do at all.

## How this process scales to the full site rebuild

This assignment ran as: deterministic extraction → per-section specs → parallel builder agents
→ cross-model review → automated gates → platform-validated deploy via the GitHub integration
(the same pipeline First Day production already uses). The full rebuild is the same loop with
a bigger inventory: audit the theme's sections, rank by traffic/revenue exposure, and migrate
page-type by page-type behind the existing GitHub sync — phased, never big-bang, each phase
shippable and reversible. The 3-4 hours here are the pilot of exactly that machine.

## Ecosystem note

firstday.com already serves **`/agents.md`** and an agentic-discovery entry in its sitemap —
the site is positioning for AI-agent commerce. Two cheap, high-signal follow-ups: keep
`agents.md` in sync with the real funnel URLs (the 60-LP list is exactly what an agent needs),
and consider the structured-data story on these LPs (product JSON-LD on funnel pages is thin
today). Native metaobject-backed content also sets up clean structured answers for
answer-engine traffic — the same single-source-of-truth argument, pointed outward.
