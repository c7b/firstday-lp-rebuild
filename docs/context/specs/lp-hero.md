# Spec — sections/lp-hero.liquid

Replaces BOTH Replo-exported heroes (`temp_replo_hero_RkYkXc` opener, `temp_replo_hero_3dPiJD`
closer). One section, two layouts via a `style` setting. Content: `docs/context/sections/lp-hero.json`
(nodes appear twice per hero: mobile + desktop variants of the same copy — dedupe; images differ:
square = mobile, landscape = desktop).

## Settings

- `style`: select `product` | `founder` (default `product`)
- `badge_text` (text) — e.g. "4.8 stars from 12,322+ reviewers" (product style shows it as a
  stars badge row)
- `heading` (inline_richtext) — the original styles a span inside ("Science-Backed Vitamin")
- `subheading` (richtext)
- `cta_label` (text), `cta_link` (url — default `#standalone-product-section`)
- `guarantee_text` (text) — "Exclusive First Day 45 Day Money Back Guarantee**"
- `image` / `image_url` pair (desktop) + `image_mobile` / `image_mobile_url` pair
- `image_position`: select left|right (desktop)
- `stat_badge_text` (text) — "6,646 Gummies Sold Every 24h" floating chip with the two gummy
  PNGs + gif (urls as settings: `stat_gif_url`, `stat_icon_1_url`, `stat_icon_2_url`)
- `color_scheme`, `padding_top`, `padding_bottom`, `anchor_id`

## Blocks

- `testimonial` (limit 2): `quote` (richtext), `author` (text), `avatar_url`/`avatar` pair —
  the opener shows one ("Alyssa Blossom") overlaid/below the hero media.
- `stat_card` (limit 4): `line_1` (text), `value` (text, big — "52 Credit Cards’"), `line_2`
  (text), `line_3` (text) — founder style renders 3 of these ("microplastics", "59% additives",
  "73% nutrients").

## Layouts

- `product`: badge row → h1 → subheading → CTA button → guarantee line → media (mobile square /
  desktop landscape) with stat chip + testimonial overlay. Text left, media right on desktop.
- `founder`: h2 headline → founder quote paragraph (subheading setting) → 3 stat_card blocks in
  a row (stack on mobile) → closing paragraphs → CTA. Founder photo (image pair) beside text.

## Presets

Two presets: "LP Hero — product" and "LP Hero — founder story".

## Fragments to emit

- `docs/context/template-fragments/hero-opener.json` (style=product, full copy from JSON)
- `docs/context/template-fragments/hero-closer.json` (style=founder, full copy from JSON)
