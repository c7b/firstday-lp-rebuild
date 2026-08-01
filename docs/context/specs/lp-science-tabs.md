# Spec — sections/lp-science-tabs.liquid

Replaces `temp_science_module_mqM7QH` ("The Science Behind Our Multivitamin", 4 tabs:
Focus in Class / Boosted Energy / Balanced Moods / Clear Skin — each = video + "How This Helps*"
+ intro + 3 nutrient bullets). Content: `docs/context/sections/lp-science-tabs.json` (video mp4
CDN urls are in the spec below; poster thumbs in the JSON).

**This is the metaobject-backed section.** Primary content source: a `metaobject_list` setting
over type `science_claim`; block fallback so the section also works standalone.

## Metaobject `science_claim` (defined in the store separately — render fields by these keys)

- `label` (single_line_text) — tab label
- `panel_heading` (single_line_text) — "How This Helps*"
- `intro` (multi_line_text)
- `bullets` (rich_text) — 3 lines, each "emoji **Nutrient** text"
- `video_url` (url), `poster_url` (url)

## Settings

- `heading` (inline_richtext)
- `claims` (type `metaobject_list`, `metaobject_type: "science_claim"`, limit 6)
- `color_scheme`, `padding_top`, `padding_bottom`, `anchor_id`

## Blocks (fallback when `claims` empty)

- `claim` (limit 6): `label`, `panel_heading`, `intro` (textarea), `bullets` (richtext),
  `video_url` (text), `poster_url` (text).

Liquid: `{% assign claims = section.settings.claims | default: section.blocks %}` won't work
directly — branch explicitly: if metaobject list has entries render from it, else from blocks.

## Rendering

- Tab bar (pill buttons, active state) + one panel: video left (9:16-ish, rounded), text right.
- Tabs: `role="tablist"`/`tab`/`tabpanel`, arrow-key navigation, JS custom element
  `lp-science-tabs` (this section DOES need `assets/lp-science-tabs.js`).
- Videos: per CONVENTIONS (muted loop autoplay playsinline + poster + reduced-motion). Only the
  active panel's video plays; pause on tab switch. `preload="none"` for inactive.

Video URLs (from snapshot, in tab order):
1. Focus: `//firstday.com/cdn/shop/videos/c/vp/a80235b58deb4ad08c567013e029e0a4/a80235b58deb4ad08c567013e029e0a4.HD-720p-4.5Mbps-79391373.mp4?v=0`
2. Energy: `//firstday.com/cdn/shop/videos/c/vp/9e9ff2355ccf4cc9b95da1f7f7c943e3/9e9ff2355ccf4cc9b95da1f7f7c943e3.HD-720p-2.1Mbps-79391370.mp4?v=0`
3. Moods: `//firstday.com/cdn/shop/videos/c/vp/cc10ff9ae6804bdf9ff1723916a187ac/cc10ff9ae6804bdf9ff1723916a187ac.HD-720p-1.6Mbps-79391372.mp4?v=0`
4. Skin: `//firstday.com/cdn/shop/videos/c/vp/434e19b2f80f4966a32568ff377de125/434e19b2f80f4966a32568ff377de125.HD-720p-4.5Mbps-79391371.mp4?v=0`

## Fragments to emit

- `science-tabs.json` — settings only (heading + anchor); ALSO emit
  `docs/context/metaobjects/science-claims.json`: an array of 4 objects with the full field
  values (label, panel_heading, intro, bullets as HTML, video_url, poster_url) extracted from
  the content JSON — this file seeds the metaobject entries via Admin API in the template phase.
