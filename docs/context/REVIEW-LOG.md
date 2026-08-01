# Cross-model review log (Claude reviewing GPT builds)

Every builder diff gets reviewed here before it's committed. Format: finding → severity →
resolution. This log is deliberately unpolished — it's the actual loop, not a writeup.

## Round 1

### lp-urgency-banner (builder: terra)

1. **`url` setting with `"default": "#standalone-product-section"`** — Shopify `url` settings
   don't accept fragment-only values reliably (editor validation); these links are in-page
   anchors, so the link-picker UI would be wrong anyway. → **Fix: `type: text` for anchor
   links.** Root cause is the SPEC (it said `url`), not the builder — spec bug, my side.
   Applies to every section; fixed globally in the review pass.
2. **Notice copy wrapped in `<h2>`** — it's a notice strip, not a document heading; pollutes
   the outline. → Fix: `<p>` with the same classes.
3. **ASSUMPTIONS note as HTML comment** ships to the browser. → Fix: `{% comment %}`.
4. CSS: clean, scoped, focus-visible present, 44px target respected. No changes.
5. Fragment: copy byte-exact vs extraction JSON ✓ (emoji intact).

## Round 2 — full wave (7 sections, 6× terra + buy-box on sol)

**Automated gates first** (`tools/verify_build.py`): schema JSON validity ✓ 8/8, fragment↔schema
integrity, and copy fidelity (every fragment string must exist in the extraction corpus). The
gate itself needed two review fixes — node-order corpus (multi-node sentences) and HTML-entity
unescape — both were false-positive bugs in MY checker, worth logging: review tooling gets
reviewed too. Final: 0 failures, 1 sanctioned warning (FAQ heading is spec-invented; the FAQ
instance ships as a fragment but NOT in the template — original renders empty).

### lp-science-tabs (terra)
1. **BUG: `section.settings.claims.count`** — metaobject_list returns an array; Liquid arrays
   have `.size`, `.count` is nil → the metaobject branch would NEVER activate and the section
   would silently fall back to blocks. Exactly the class of bug cross-model review exists for.
   → Fixed `.size`.
2. JS: keyboard nav, aria wiring, reduced-motion, inactive-video pause — no changes. Good build.

### lp-hero (terra)
1. Same spec-inherited `url`+`#` default → `text`. (Spec bug, fixed globally.)
2. Nit, left as-is: `image_mobile_alt` setting is schema-only (alt renders from the `<img>`
   fallback); harmless, documented here instead of churning the diff.

### lp-buy-box (sol)
1. ASSUMPTIONS note shipped as HTML comment → `{% comment %}`.
2. Real `{% form 'product' %}` + hidden qty wired to tier radios ✓; delivery cards are honest
   static stubs; thumb↔slide sync via IntersectionObserver with reduced-motion respected.
   For an 877-line section: one cosmetic fix. Sol earned its keep.

### lp-media-accordion / lp-trust-wall / lp-comparison-table / lp-reviews (terra)
- Pattern sweep (comments, loading attrs, semantics): accordion uses native details/summary,
  comparison table is a semantic `<table>` with `scope`, no stray comments, no console noise.
- Deep visual verification deferred to the screenshot QA phase by design.

## Round 3 — Shopify's own validation as the third reviewer

The GitHub sync applied 17 of 18 theme files and **silently skipped
`lp-media-accordion.liquid`** (no error surfaced anywhere in the repo). Direct Asset API
upload of the template exposed the real message: *"Section type 'lp-media-accordion' does not
refer to an existing section file"* → uploading the section itself would have said: `url`
setting with `#anchor` default fails validation. Same spec bug as Round 1-2; this instance
hid from the review grep because the `default` sat 3 lines below the `type` (grep -A2). Two
lessons logged:

1. **Grep-based review misses layout variance — the scan should have been structural from the
   start.** Now it is: `verify_build`-style python over parsed schemas, not text matching.
2. **Push → platform-validate → read the rejection** is a legitimate extra review gate when
   the platform validates deterministically. The 422 told us in one line what three reviewers
   missed.

Also caught in the same pass: every `color_scheme` default said `scheme_1`; Dawn 15.5's real
ids are `scheme-N` (dashed). Invalid scheme ids don't error — they silently fall back, which
would have shown up as subtle color drift in visual QA. Fixed across schemas, fragments and
the template.

## Round 4 — visual QA (side-by-side screenshots, mobile 390px, 6 segments each)

Method: our page fetched with the storefront password and screenshotted from file:// (assets
are absolute CDN URLs); the original screenshotted from the snapshot the copy was transplanted
from (the live site rate-limits headless loads), overlay dialogs stripped. Colors sampled
by pixel from the original's screenshots: primary #486ced, border #87adf5, pale #e4f5ff,
green #078942, yellow #f5b313, navy #2f4158/#2c3e50.

**Structure verdict: section order, copy, science tabs, trust wall, accordions — match.**
Fix list handed to builders:

1. Hero: accent/CTA colors (ours drifted orange), CTA after media on mobile, sizes.
2. Accordions: bordered-card items, blue full-width CTA pill.
3. Buy box: selected-state colors (delivery + qty), default qty = 2 bottles, ATC label is
   actually "Add To Cart & View Gift" + cart icon, and THREE missing tail blocks: trust
   stamps, info accordions (Ingredients/Supplement Facts/Subscription Details), age-routing
   panel ("This Product is For Teens Ages 13–17" + Toddlers/Kids cards).
4. Urgency banner: yellow #f5b313 band + navy button, not a plain text strip.
5. Trust wall stats: rows with outlined oval values (we'd invented rings — spec bug, mine).
6. Reviews: blue stars, summary row layout, Verified chip, histogram mobile-hidden.
7. **Miss caught: FrontRow MD clinician reviews render on the real page** (lazy iframe —
   invisible to both DOM dumps, visible to a scrolled screenshot). New `lp-clinician-reviews`
   static section, content transplanted from the iframe's public URL. ASSUMPTIONS corrected
   (8 dead sections → 7 + 1 documented stub exception).
