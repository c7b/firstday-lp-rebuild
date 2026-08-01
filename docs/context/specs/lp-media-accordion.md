# Spec — sections/lp-media-accordion.liquid

ONE section covering three instances: the two accordion blocks
(`accordion_block_driBft` "Most Kids Are Missing Key Nutrients", `accordion_block_QpghhN`
"Raising the Bar on Your Child's Nutrition") and the FAQ (`faq_yFdkhp` — renders empty in the
snapshot; ships as a text-only instance whose items get filled once live content is verified).
Content: `docs/context/sections/lp-media-accordion.json`.

## Settings

- `heading` (inline_richtext — original styles the "Missing Key Nutrients" span)
- `show_media` (checkbox, default true) — FAQ instance sets false
- `image`/`image_url` pair (the product-wheel / bottle-holding images; same image used mobile+desktop)
- `media_position`: select left|right (desktop)
- `first_open` (checkbox, default true) — first item expanded on load
- `exclusive` (checkbox, default true) — opening one closes the others (use `name` attr on
  `<details>`, plus small JS fallback only if needed)
- `cta_label`, `cta_link` (default `#standalone-product-section`), `guarantee_text`
- `color_scheme`, `padding_top`, `padding_bottom`, `anchor_id`

## Blocks

- `item` (limit 12): `icon`/`icon_url` pair (40–72px icon), `title` (text), `body` (richtext).

## Rendering

- Native `<details><summary>` per item; summary = icon + title + chevron; body animates open
  (CSS grid-template-rows trick or interpolate-size where supported — no JS height hacks).
- Desktop: media column + accordion column (position per setting). Mobile: heading, media,
  then items stacked.

## Fragments to emit

- `accordion-nutrients.json` (7 items, wheel image, CTA "Shop Now")
- `accordion-raising-bar.json` (6 items, bottle image, CTA "Start Today")
- `faq.json` (show_media=false, heading "Frequently Asked Questions", items: leave an empty
  `blocks` object with a `"_note"` key explaining content is pending live-page verification)
