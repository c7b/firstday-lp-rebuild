# Spec — sections/lp-comparison-table.liquid

Replaces `pbfcm_comparison_table_iVgR7T` ("Why Should You Choose First Day?"). Content:
`docs/context/sections/lp-comparison-table.json`. Original renders a two-column compare
(First Day vs Other Multis) with brand logo, check/cross marks, and decorative product imagery
(desk/mob background images in the JSON).

## Settings

- `heading` (inline_richtext)
- `subheading` (richtext): "Made for modern families…"
- `brand_label` (text, "First Day") + `brand_logo_url`/`brand_logo` pair (round logo)
- `competitor_label` (text, "Other Multis")
- `image_desktop_url`/`image_desktop` pair + `image_mobile_url`/`image_mobile` pair
  (the decorative product shots flanking the table)
- `color_scheme`, `padding_top`, `padding_bottom`, `anchor_id`

## Blocks

- `feature_row` (limit 10): `label` (text). Rendered: ✓ for First Day column, ✗ for
  competitor. Add optional `us_note`/`them_note` (text, default empty) for flexibility.
  5 rows in content: Clean Label Certified / Research Backed / Surprise Gift with Purchase /
  No Fillers or Fake Ingredients / Vegan, Gluten-Free, Non-GMO.

## Rendering

- Semantic `<table>` with proper `<th scope>`: rows = features, columns = First Day / Other
  Multis. First Day column visually elevated (brand color header with logo, highlighted column
  background). Marks are inline SVG (accessible label "Yes"/"No"), not images.
- Decorative side imagery desktop-only; mobile shows the mobile image above the table.

## Fragment to emit

- `comparison-table.json`
