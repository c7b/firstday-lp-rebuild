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
2. **7 of the 19 original sections render no visible content** — verified twice: in the saved
   snapshot AND in a rendered-DOM dump of the live page with JS executed (`_dropped.json`).
   They were not rebuilt: `temp_css` (722KB of injected CSS), `custom_liquid`, an empty
   marquee, timeline, a-plus cards, image-with-text, benefits-split. This is the frankenstein
   cleanup the exercise implies — deleting dead weight is a feature, not missing scope.
   **Correction logged during visual QA:** the FrontRow MD section was initially classed as
   dead (1KB, empty in both dumps) — it's actually a cross-origin **iframe** that only paints
   on scroll. Visual QA caught it; it's now rebuilt as a static section (`lp-clinician-reviews`)
   with the iframe's real public content transplanted, keeping the "don't mirror app data"
   rule as a documented exception with the reason: visible content on the target page wins.
3. **The FAQ renders empty on the live page too.** Parity means we don't ship a FAQ either.
   The third `lp-media-accordion` instance exists as a ready fragment
   (`template-fragments/faq.json`) for when content exists.
4. **Buyer archetypes → architecture, not pixels.** The Picky-Eater Parent enters on ad-funnel
   variants (this page); the Whole-Family Buyer gets routed by product tabs
   (Toddlers'/Kids'/Teens') and cross-family upsells in the buy box. Both stay editable per
   variant via settings/blocks so CRO can tune per audience without a developer. Copy itself:
   transplanted byte-for-byte, zero changes (out of scope by brief).

## Where each piece of content lives: metaobject vs metafield vs section setting

The rule this repo follows, and the reason each one exists:

| Store it as | When | Here |
|---|---|---|
| **Metaobject** | a standalone content entity reused across pages, with its own fields | `science_claim` ×4 — the same claims appear on all 18 behind-the-science LPs |
| **Metafield** | data that belongs to an existing resource (a product), not to a page | `custom.servings_per_bottle`, `age_range`, `flavor`, `subtitle`, `short_description` on the product |
| **Section setting / block** | copy that is genuinely per-page: a variant's headline, its offer badge, its CTA | everything else on the page |

The metafield case is the one that shows up at scale. Those product facts started as section
settings; that means "30 Servings Per Bottle" gets retyped on every LP selling that product —
~18 of them — and drifts the first time the pack size changes. On the product, it's edited once
and every LP follows. The buy box resolves each fact as
`section.settings.X | default: product.metafields.custom.Y`, so a single variant page can still
override the product when the funnel genuinely needs different words. The template fragment
ships those settings **empty on purpose** — the product is the source of truth.

The mirror-image mistake is just as real: putting per-LP copy in metafields would force a
developer (or an API call) into every marketing edit. Neither is "more advanced" — they answer
different questions: *who owns this fact?*

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

## Color schemes: what they do and don't control here

The scheme system is **Dawn's**, not First Day's — the original page doesn't use schemes at
all; it's a fixed-palette design. Our sections consume Dawn schemes for *neutral* surfaces
(section background, base text) as an operator convenience, while brand elements are
deliberately fixed: CTAs `#486ced`, savings `#078942`, urgency `#f5b313`, functional SVG marks,
and any asset that only reads against a specific background (e.g. the buy-box benefit icons
are white glyphs on transparency — they sit on a brand-blue circle painted by CSS, never by
the scheme). Practical rule: **scheme-1 is the intended scheme for this LP**; switching
schemes recolors neutrals only and is expected to look "off" because the design itself is not
scheme-native. Making the LP fully scheme-driven would mean re-tokenizing the brand palette
into scheme slots — possible, out of scope, and of questionable value for an ad funnel with a
locked brand look (noted in PLAN.md territory: not built, on purpose).

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

## Deliberate departures from the original page

The brief puts copy and visual redesign out of scope, so every departure below is listed
with the reason it earns its place. Everything else on the page is the original, verified
string by string by `tools/verify_build.py`.

- **Closing hero portrait → family photo.** The original runs the founder's headshot beside
  copy about diet, microplastics and nutrient loss. A portrait next to that text reads as a
  bylined article, not as the families the copy is about. The photo is First Day's own
  (`/cdn/shop/files/1_3c7f014e…png`, from their site), re-hosted on this store like every
  other asset here.
- **New "Meet Our Founder" section.** The founder now has her own block, transplanted from
  firstday.com/pages/about-us where it exists as a rich-text heading plus a custom-liquid
  blob with its CSS inlined in a `<style>` tag. Rebuilt as `lp-founder-story` with the
  portrait, frame colour, background and every paragraph as settings, so it can be dropped on
  any LP from the editor. Copy is theirs verbatim; only the heading changes, from "Our
  Founder's Story" to "Meet Our Founder" — an introduction rather than a chapter title, since
  on an LP this is the first time the reader meets her. Verified against
  `docs/context/sections/lp-founder-story.json`, extracted from the About page.
- **Free-gift bar, cross-sell upsells and the flash-sale strip: off.** All three are
  app-driven on the original. The rebuilt gift bar does read the real cart and the upsells do
  add through the Cart AJAX API, but a gift you cannot actually claim and a countdown that
  counts down to nothing are theatre. They are switched off by emptying their settings; the
  Liquid still renders all three when those settings are filled, so turning them back on is a
  content change, not a deploy.
- **Urgency banner month.** The original says July. This says August — the month is the only
  changed word. A banner naming last month reads as an abandoned page, which is the opposite
  of what the section is for.

## Known limit of the variant demo

The Kids and Toddlers funnels override one setting — the product — and everything
product-shaped follows from that product's own metafields: title, benefit line, age range,
flavour, servings, price, selling plan. What does *not* follow is the science tabs, whose
claims are a section-level metaobject list. So the Toddlers page still argues "Focus in
Class", which is a teen claim.

Fixing it is one more line in `variant()` pointing at a toddler claim set — the mechanism is
already there. What is missing is the content: First Day has no live Toddlers LP to extract
those claims from, and writing them here would mean inventing clinical copy for a children's
supplement. That is the one thing this build will not do, so the tabs stay teen-flavoured and
the gap is written down instead.
