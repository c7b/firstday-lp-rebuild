# Spec — sections/lp-buy-box.liquid

Replaces `standalone_product_PMRdVC` (236KB, the purchase module). Content:
`docs/context/sections/lp-buy-box.json`. The original is driven by a subscription app +
gift-progress + upsell logic. **Scope decision (documented in ASSUMPTIONS): visual parity + a
real one-time add-to-cart; subscription pricing, gift progress bar and upsell add-ons are
static UI stubs.** No cart drawer logic, no fetch to /cart beyond the standard product form.

## Settings

- `product` (type product) — the dev store's `teens-multivitamin`
- `anchor_id` default **`standalone-product-section`** (every other section's CTA targets this)
- `subtitle` (text): "Daily Gummies For Improved Motivation & Mood"
- `rating_text` (text): "1394 reviews" + `rating_stars` (text, "4.7")
- `description` (text): "A unique organic fruit and veggie blend, plus 12 key nutrients."
- `flavor_text` (text): "Flavor: 🍊 Orange"
- Delivery cards (static stub): `sub_title` "Monthly", `sub_compare` "$39", `sub_price`
  "$23.40", `sub_perks` (richtext: FREE Gift / FREE Shipping / Cancel anytime), `sub_badge`
  "Lowest Price Anywhere!", `ot_title` "One-Time", `ot_compare` "$39", `ot_price` "$27.30",
  `ot_note` "with code FIREWORKS", `ot_warning` (richtext, the "missing out" copy)
- Gift banner: `gift_heading` "Unlock Your Free Gift", `gift_sub` "12 Servings of Electrolyte
  Drink Mix For The Whole Family.", `gift_compare` "$25.00", `gift_price` "FREE",
  `gift_progress_text` "You are $75 away, keep going!", `gift_threshold` "$75"
- Footer: `urgency_text` "🔥 Limited-Time Offer 🔥 Flash Sale Ending Soon Get Up To 52% Off",
  `guarantee_text` "45 Day Money Back Guarantee", `cta_label` "Add To Cart"
- `color_scheme`, `padding_top`, `padding_bottom`

## Blocks

- `product_tab` (limit 4): `label` ("Toddlers'"/"Kids'"/"Teens'"), `url`, `active` (checkbox)
  — link pills above the title (they navigate to other LPs; only Teens' is active here).
- `benefit` (limit 4): `image_url`/`image` pair, `title`, `stat` ("98%"), `text` — the three
  "Improve Overall Health…" stat rows.
- `qty_tier` (limit 4): `label` ("1 Bottle"), `savings` ("" or "Save $15.80"), `selected`
  (checkbox) — radio-style quantity selector UI; sets the form quantity via JS (1–4 by index).
- `upsell` (limit 4): `image_url`/`image` pair, `title`, `subtitle`, `compare_price`, `price` —
  static add-on rows with a non-functional "+" (stub; real add-ons are app territory).
- `carousel_image` (limit 12): `image_url`/`image` pair, `alt` — media carousel fallback when
  the product has no images (our dev product starts bare; fragments carry the CDN urls).

## Rendering

- Two-column desktop: media carousel left (thumbnails below, scroll-snap, JS custom element
  `lp-buy-box` for thumb→main sync + qty radio wiring; `assets/lp-buy-box.js` allowed), buy
  column right. Mobile: carousel then buy column.
- Media: use `product.media` when present, else `carousel_image` blocks.
- Buy form: `{% form 'product', product %}` + hidden variant id + quantity (wired to qty_tier
  selection) + submit = `cta_label`. Delivery cards are radio-styled but only affect nothing —
  visually selected state works, price shown per card (stub; document with an HTML comment).
- "30 Servings Per Bottle" mini-label above qty tiers (setting `qty_note`).

## Fragment to emit

- `buy-box.json` — full instance: all settings + blocks with real copy and the 11 carousel CDN
  urls (in snapshot order), benefit rows, 4 qty tiers, 3 upsells (Brain Support / Nighttime
  Reset Magnesium / 3-in-1 Probiotic with their prices).
