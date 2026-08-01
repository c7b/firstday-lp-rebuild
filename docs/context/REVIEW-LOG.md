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
