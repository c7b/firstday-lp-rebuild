# Spec — visual fixes round (side-by-side against the live original)

Each item comes from a screenshot comparison. Change ONLY what is described; do not touch copy.

## A. lp-clinicians-band — doctor avatars + padding
The original shows two small circular clinician photos immediately before "472 clinicians".
Add an `avatar` block type (limit 3) with an image_picker, rendered as 26px circles that
overlap slightly (margin-left -8px on the 2nd and 3rd), before the bold count. Increase the
band's vertical padding — it currently reads cramped. Files: sections/lp-clinicians-band.liquid.

## B. lp-media-accordion — centre the CTA, lift the guarantee contrast
The CTA and the guarantee line under it must be centred as a block on all breakpoints, and the
guarantee text needs more contrast (it is too light against white). Keep the copy in English.
Files: assets/lp-media-accordion.css.

## C. lp-science-tabs — even padding on the panel
The panel's left/right padding is visibly smaller than its top/bottom. Make the padding uniform
and generous (about 3.2rem desktop, 2rem mobile). Files: assets/lp-science-tabs.css.

## D. lp-buy-box — title and subtitle typography
1. The ™ in the product title renders raw and too large. Style it: `.lp-buy-box__title sup,
   .lp-buy-box__title` — wrap the trademark via CSS `font-feature-settings` is not possible,
   so add a small CSS rule targeting the title so the ™ sits as a superscript at ~0.5em,
   vertical-align super, no extra weight. Implement by post-processing the title in Liquid:
   replace "™" with `<sup class="lp-buy-box__tm">™</sup>` using a `replace` filter, and
   output with the appropriate filter so the tag renders.
2. The subtitle is one flat line. The original splits it: the leading words in dark bold, and
   the emphasis in BLUE ITALIC (var(--lp-blue)). Make the subtitle setting an `inline_richtext`
   so an operator marks the emphasis with italic, and style `.lp-buy-box__subtitle em` as blue
   italic. The product metafield fallback stays plain text.

## E. lp-buy-box — benefit percentage badge
The 95% / 83% / 82% figures render as plain text. The original puts each inside a pale blue
rounded box with the number large and blue. Style `.lp-buy-box__benefit-stat`: background
var(--lp-bg-alt), colour var(--lp-blue), font-size 2.2rem, font-weight 700, padding .8rem 1.2rem,
border-radius 1rem, min-width 6.4rem, text-align centre, and lay the benefit content out as a
two-column grid (badge, text). Files: assets/lp-buy-box.css.

## F. lp-buy-box — delivery frequency behaviour and layout
1. The subscription price must be GREEN (var(--lp-green)); the compare-at stays struck grey.
2. Right-align the whole price column of BOTH cards so the numbers line up on the right edge,
   including the "with code FIREWORKS" note under the one-time price.
3. The One-Time card must be COLLAPSED by default and visually smaller: only its title and price
   show. The two "You're missing out…" lines appear ONLY when that option is selected. Same for
   the Monthly card: its perks list and badge show only while Monthly is selected. Use the
   existing radio state — a sibling selector on `.lp-buy-box__choice-input:checked` — and no JS.
Files: sections/lp-buy-box.liquid (markup order if needed), assets/lp-buy-box.css.

## G. lp-buy-box — info items get icons
The original shows a small icon before "Ingredients", "Supplement Facts" and "Subscription
Details". Add an `icon` image_picker to the `info_item` block, rendered at 20px before the
title, and lay the summary out as a grid so the chevron stays right-aligned.

## H. lp-trust-wall — heading padding
The section heading has more space above than below. Make them equal and generous (about 4rem
each). Files: assets/lp-trust-wall.css.

## I. lp-urgency-banner — rebuild to match the original exactly
The original is a two-column card: media on the left, a yellow panel on the right. Its own CSS
variables, read from the live page: card background #f5b313, text #24364d, button background
#2f4158 with white text, radius 10px, max-width 600px for the card, media aspect ratio 38/27,
section padding-top 44px and padding-bottom 20px, and a soft shadow (0 6px 18px rgba(0,0,0,.08)).
The media is a looping muted autoplay video:
  video:  https://cdn.shopify.com/videos/c/vp/2e7dd77535bb4f0d8a3ff1e42b3dcbe6/2e7dd77535bb4f0d8a3ff1e42b3dcbe6.HD-720p-4.5Mbps-90596307.mp4
  poster: https://cdn.shopify.com/s/files/1/0773/6511/7120/files/preview_images/2e7dd77535bb4f0d8a3ff1e42b3dcbe6.thumbnail.0000000000.jpg?v=1785730422
Add `video_url` and `poster_url` text settings plus the layout. ALL the notice text is bold.
On mobile the media stacks above the panel. Files: sections/lp-urgency-banner.liquid,
assets/lp-urgency-banner.css.

Every section's {% schema %} must stay valid JSON. Do not run git.
