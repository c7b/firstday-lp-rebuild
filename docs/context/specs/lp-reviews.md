# Spec — sections/lp-reviews.liquid

Replaces the hash-named section `1771530273b0a25f6d` — which is the Judge.me review widget
(client-side rendered; the snapshot ships its data as inline JSON, extracted to
`docs/context/sections/lp-reviews.json` under `jdgm_data`). **Static stub, documented in
ASSUMPTIONS: reviews are app content; this section renders the same UI from settings/blocks
so the page stands without the app.**

## Settings

- `heading` (text, default "Customer Reviews")
- `average_rating` (text, "4.75"), `review_count` (text, "11027" — format with comma in Liquid)
- `histogram_5`…`histogram_1` (5 × range 0–100, % values: 88 / 6 / 3 / 1 / 2 from jdgm data)
- `color_scheme`, `padding_top`, `padding_bottom`, `anchor_id`

## Blocks

- `review` (limit 12): `rating` (range 1–5), `title` (text), `body` (richtext), `author`
  (text), `date` (text), `verified` (checkbox → "Verified Buyer" chip).

## Rendering

- Summary header: big average + star row + total count + histogram bars (CSS width from
  settings), mirroring the Judge.me layout.
- Review cards: responsive grid (1-col mobile / 2–3 desktop), stars, title, body, author line.
- Stars: one inline SVG snippet reused, fill by rating.

## Fragment to emit

- `reviews.json` — real summary numbers + histogram from jdgm_data. For review cards: 3 blocks
  with `"_note": "placeholder — real card content pending live-page fetch"` and OBVIOUS
  placeholder copy (e.g. title "[review pending]") so nothing fake ships silently.
