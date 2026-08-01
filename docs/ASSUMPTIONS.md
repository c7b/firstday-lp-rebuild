# ASSUMPTIONS.md — decisions, constraints, and what was deliberately NOT built

Everything here was decided during the build, not reverse-engineered afterwards. Format:
decision → reasoning → what it costs us / when to revisit.

## The architecture decision that drives everything

**The sitemap shows 60 `-lp` pages; 18 are `behind-the-science` variants** of the same funnel
(product kde/tdk/wds/mcm × offer × channel × language), cloned by hand today. So the target
architecture is NOT "rebuild one page" — it's "one set of sections where a new variant is a new
template JSON + content entries, zero new code." Every section is generic; every piece of
per-page content lives in the template or in metaobjects.

## Section decisions

1. **19 original sections → 8 owned sections, 10 template instances.** The two Replo-exported
   heroes are one `lp-hero` with a `style` setting; the two accordions and the FAQ are three
   instances of one `lp-media-accordion`.
2. **8 of the 19 original sections render no visible content** — verified twice: in the saved
   snapshot AND in a rendered-DOM dump of the live page with JS executed (`_dropped.json`).
   They were not rebuilt: `temp_css` (722KB of injected CSS), `custom_liquid`, an empty
   marquee, timeline, a-plus cards, image-with-text, benefits-split, and the FrontRow MD embed.
   This is the frankenstein cleanup the exercise implies — deleting dead weight is a feature,
   not missing scope.
3. **The FAQ renders empty on the live page too.** Parity means we don't ship a FAQ either.
   The third `lp-media-accordion` instance exists as a ready fragment
   (`template-fragments/faq.json`) for when content exists.
4. **Buyer archetypes → architecture, not pixels.** The Picky-Eater Parent enters on ad-funnel
   variants (this page); the Whole-Family Buyer gets routed by product tabs
   (Toddlers'/Kids'/Teens') and cross-family upsells in the buy box. Both stay editable per
   variant via settings/blocks so CRO can tune per audience without a developer. Copy itself:
   transplanted byte-for-byte, zero changes (out of scope by brief).

## Metaobjects: one case, and why not more

- **`science_claim`** (label, panel_heading, intro, bullets rich-text, video_url, poster_url,
  product_scope): the four claims repeat across the 18 behind-the-science variants and are
  compliance-sensitive copy (supplement claims). One edit propagates everywhere; a new variant
  picks entries instead of duplicating copy. Entries are seeded by script
  (`tools/seed_metaobjects.py`), so the content pipeline is repeatable.
- **Why NOT clinician reviews:** they live in a third-party app (FrontRow MD). Mirroring app
  content into metaobjects creates a second source of truth that drifts. If First Day drops
  the app, that's the moment to model them natively.
- **Why NOT everything else:** one-off copy per LP belongs in section settings/blocks, where
  marketing edits it in the theme editor per template. Metaobjects earn their complexity only
  when content is shared across pages. Rule of thumb we'd defend: *metaobjects for shared or
  structured-and-repeated content; blocks for per-page copy; never both for the same string.*

## Stubs (visual parity, no fake functionality)

- **Subscription pricing (Monthly vs One-Time cards):** the original runs on a subscription
  app (selling plans). The rebuild shows the identical UI statically; the product form adds a
  real one-time purchase. Wiring real selling plans = app install + plan config (PLAN.md).
- **Gift progress bar, upsell add-ons, "Try Before You Buy":** same reasoning — app logic,
  stubbed visually, documented inline in the section with `{% comment %}`.
- **Judge.me reviews:** widget is client-rendered app content. Rebuilt natively from the
  widget's own data (4.74★, 1,394 product reviews, histogram, 5 real cards extracted from the
  live page's inline JSON). No fake reviews were written.
- **Checkout/cart untouched** — explicit client boundary, respected: the only cart interaction
  is a standard `{% form 'product' %}` add-to-cart.

## Content & images

- **Copy:** extracted deterministically from the live-page snapshot by script — no model ever
  retypes copy (`tools/extract_content.py`, gate in `tools/verify_build.py`). Emoji, typos and
  trademark symbols preserved.
- **Images/videos: referenced from First Day's CDN** with original params. Reason: byte-level
  visual fidelity and zero re-hosting drift inside the timebox. Production migration path
  (Files API upload + `image_picker`, already supported by every section via the image/URL
  setting pairs) is in PLAN.md. Risk accepted: if First Day deletes an asset, the dev store
  loses it too — acceptable for a take-home, not for production.
- **Dev store product** is a placeholder (`teens-multivitamin`) so the buy box renders a real
  product form; carousel falls back to CDN image blocks until real media is uploaded.

## Platform constraints hit during the build (documented because they cost time)

- Shopify `url` settings don't take `#anchor` defaults → in-page anchors are `text` settings.
- `rich_text_field` metaobject values require Shopify's rich-text JSON AST, not HTML;
  `url` fields reject protocol-relative `//` URLs (seeding script converts both).
- The storefront password check in `shopify theme dev` is unsupported with an Admin API token
  (Theme Access app is the production answer); QA runs against the published theme instead.
- PageSpeed Insights anonymous quota + firstday.com bot rate-limiting (429) → performance
  receipts come from local Lighthouse, same machine and profile for both pages.

## Out of scope, on purpose

New features, visual "improvements", app installs, quiz, header/footer chrome rebuild (Dawn
stock serves them; the exercise is the funnel template), overlay dialogs (sale/OTP/upsell),
and anything touching checkout. Each has a PLAN.md line instead of a half-built version.
