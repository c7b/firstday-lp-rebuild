# Spec — sections/lp-urgency-banner.liquid

Replaces `temp_sellout_notice_WQzDBM`. Tiny settings-only section, no blocks, no JS.
Content: `docs/context/sections/lp-urgency-banner.json`.

## Settings

- `text_before` (text): "🚨 Due to the high demand,"
- `text_highlight` (text): "July" (bold/underlined in original — style distinctly)
- `text_after` (text): "has a very high risk of selling out!"
- `cta_label` (text): "Claim Yours Now!" + `cta_link` (url, default `#standalone-product-section`)
- `color_scheme`, `padding_top`, `padding_bottom`, `anchor_id`

## Rendering

Single centered strip: sentence + inline CTA link (underlined). Compact — this is a notice bar
between sections, not a full banner.

## Fragment to emit

- `urgency-banner.json`

## Note for ASSUMPTIONS (include as HTML comment in the section)

"July" is hardcoded month text in the original. As a setting it's editable; PLAN.md notes the
dynamic-month option (`{{ 'now' | date: '%B' }}`) that was deliberately NOT implemented —
copy changes are out of scope.
