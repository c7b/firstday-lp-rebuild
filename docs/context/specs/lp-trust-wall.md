# Spec — sections/lp-trust-wall.liquid

Replaces `homepage_trust_section_YfPXT3` ("Life Changing Results from Doctors and Real
Customers"). Content: `docs/context/sections/lp-trust-wall.json`. A masonry-style wall mixing
doctor endorsements, UGC images/video thumbs, a press quote, and stat circles.

## Settings

- `heading` (inline_richtext — "Doctors" and "Real Customers" are styled spans in the original)
- `color_scheme`, `padding_top`, `padding_bottom`, `anchor_id`

## Blocks (order = display order; limit 16 total)

- `doctor_card`: `photo_url`/`photo` pair, `quote` (richtext), `name`, `credentials`
  (2 in content: Dr. Lei Chen / Yale, Dr. Ed Giovannucci / Harvard)
- `media_card`: `image_url`/`image` pair, `alt`, `is_video` (checkbox — renders a play badge
  overlay; the original shows video thumbnails, actual playback is out of scope/stub)
- `customer_card`: `avatar_url`/`avatar` pair, `quote` (richtext), `name`, `caption`
  ("Verified Purchaser")
- `press_quote`: `quote` (text), `logo_url`/`logo` pair ("As seen on" + Yahoo Finance logo)
- `stat_circle`: `value` ("95%"), `text` ("of parents see improved health & wellness")
  (3 in content: 95 / 82 / 97)

## Rendering

- Desktop: 3-column masonry (CSS columns is fine). Mobile: single column, natural order.
- Stat circles render as a ring (conic-gradient) with value centered.
- Cards: rounded corners, subtle shadow, consistent internal padding.

## Fragment to emit

- `trust-wall.json` — all 9+ cards in snapshot order with real copy/URLs.
