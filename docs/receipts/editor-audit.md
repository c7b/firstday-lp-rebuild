# Theme-editor audit: `lp-*` sections

Counts below are top-level schema controls, excluding block controls. “Actually used” means the setting has a non-empty value in at least one matching file in `docs/context/template-fragments/`; numbers and booleans count as populated, blank strings do not. `lp-header`, `lp-footer`, and `lp-redirect` have no fragment. The header-group exception is noted. Rows are ranked by operator impact.

| Section | Settings count | Settings actually used | Verdict | Single most valuable change |
|---|---:|---:|---|---|
| `lp-buy-box` | 39 | 33 | SIMPLIFY | Derive prices, ratings, savings, gift threshold, and upsell presentation from commerce data; do not ask a CRO to keep display copy synchronized with checkout. |
| `lp-hero` | 21 | 20 | SIMPLIFY | Split product hero and founder story: they render different heading levels, copy fields, proof UI, and mutually inert block types. |
| `lp-science-tabs` | 6 | 3 | SIMPLIFY | Keep `claims`; remove the unused `claim` block fallback and its second copy of the same six fields. |
| `lp-reviews` | 8 | 6 | SIMPLIFY | Select a review source/product and derive `average_rating`, `review_count`, and verification instead of editing trust data by hand. |
| `lp-trust-wall` | 5 | 4 | SIMPLIFY | Merge `doctor_card` and `customer_card` into one person-quote block. |
| `lp-clinician-reviews` | 11 | 11 | SIMPLIFY | Remove the unused `@app` source path and make the static clinician-card model unambiguous. |
| `lp-comparison-table` | 11 | 10 | SIMPLIFY | Give each cell an outcome setting; the markup currently hardcodes every First Day cell to yes and every competitor cell to no. |
| `lp-clinicians-band` | 6 | 4 | SIMPLIFY | Replace `text_bold` + `text` with one rich-text body and remove the cross-section anchor matching. |
| `lp-media-accordion` | 13 | 13 | KEEP AS IS | Keep one section for FAQ and media accordions; add sidebar headers to make its valid variation controls legible. |
| `lp-urgency-banner` | 7 | 6 | KEEP AS IS | Add a campaign deadline/expiry source so the operator does not have to find and replace literal “July.” |
| `lp-header` | 3 | 0 in fragments; 1 in `header-group.json` | SIMPLIFY | Replace raw `logo_url` text entry with an image picker. |
| `lp-redirect` | 2 | 0 | SIMPLIFY | Make this a destination-only template utility, not an addable content section. |
| `lp-footer` | 3 | 0 | SIMPLIFY | Replace the single LP backlink with normal legal/navigation link blocks and a dynamic copyright year. |

All 13 section schemas currently contain **zero** `header` entries.

## 1. `lp-buy-box` — highest impact

Evidence: `sections/lp-buy-box.liquid`; `docs/context/template-fragments/buy-box.json`.

### Settings

- **EARNS — 16/39:** `product`; `sub_perks`; `sub_badge`; `ot_note`; `ot_warning`; `gift_heading`; `gift_sub`; `gift_image`; `gift_away_template`; `urgency_eyebrow`; `urgency_headline`; `urgency_offer`; `cta_label`; `color_scheme`; `padding_top`; `padding_bottom`.
- **DOES NOT — never non-empty in the fragment:** `subtitle`, `description`, `flavor_text`, `qty_note`, `ages_note`. Markup already falls back to product metafields for all five (`lp-buy-box.liquid:15-19`). Remove the editor overrides unless a real LP variant uses one.
- **DOES NOT — duplicated/manual trust data:** `rating_text`, `rating_stars`. They duplicate the review aggregate exposed again by `lp-reviews` and the hero badge.
- **DOES NOT — fixed interface labels:** `frequency_heading`, `sub_title`, `ot_title`, `quantity_heading`. These are locale/UI copy, not campaign decisions.
- **DOES NOT — commerce values the operator must not invent:** `sub_compare`, `sub_price`, `ot_compare`, `ot_price`, `gift_compare`, `gift_price`. The markup attempts to derive subscription/variant prices but also exposes manual fallbacks. `current_variant` is assigned after the `plan_variant` lookup (`lp-buy-box.liquid:29-39`), so the subscription fallback is especially likely to win.
- **DOES NOT — duplicated values that must match:** `gift_progress_text`, `gift_threshold`, `gift_threshold_amount`. The fragment repeats `$75` across these settings and `sub_perks`. `gift_threshold_amount` now drives the live cart bar, but still has to match the display label and the actual free-gift rule. Keep one authoritative numeric threshold and format all displayed amounts from it.
- **DOES NOT — never non-empty:** `gift_unlocked_text`.
- **DOES NOT — shared fact:** `guarantee_text`. The 45-day promise is independently editable here, in `lp-hero`, and in both populated media accordions.
- **DOES NOT — internal coupling:** `anchor_id`. Hero, accordion, and urgency CTA strings must match it exactly.

### Blocks

- `product_tab` — **used: 3**. Keep the repeatable block. `product`, `label`, `url` earn. `active` does not: it is repeated on every block, exactly one must be true, and it should be derived from `buy_product`.
- `benefit` — **configured: 3; fallback-only**. All four fields (`image`, `title`, `stat`, `text`) are populated, but markup uses `mf.benefits.value` first and reaches blocks only in the `else` branch (`lp-buy-box.liquid:261-345`). Choose the product metafield model and remove this duplicate block type.
- `qty_tier` — **used: 4**. The repeatable row earns a place, but its data model does not. `label` and `savings` should derive from an explicit quantity and product price; quantity currently equals block order. `selected` is a section-level `default_quantity` job, duplicated once per block, with “first true wins” behavior (`lp-buy-box.liquid:51-60`).
- `upsell` — **used and functional: 3**. `product` is populated on all three and earns; markup posts its selected variant through `/cart/add.js`. `image`, `title`, and `subtitle` still duplicate that selected product’s catalog presentation. `compare_price` and `price` are populated fallbacks but do not render when `product` resolves. `alt` is populated in all three blocks but never read; markup uses `image.alt`. Make `product` authoritative and remove the six manual presentation fields.
- `stamp` — **used: 3**. `image` earns. `alt` is populated but never read. `line_1` and `line_2` are populated but do not render because all three real blocks have images; they are image-missing fallbacks only.
- `info_item` — **used: 3**. Correct block job. `title` earns; optional `body` is non-empty on 2/3 and optional `image` on 1/3. Neither duplicates the other.
- `age_card` — **used: 2**, but duplicates the age navigation already modeled by `product_tab`. Its current `label`, `sub`, and `url` do not earn a second editing surface. Merge it into `product_tab`: add age-range copy there and render non-current tabs as the bottom cards.
- `carousel_image` — **configured: 11; fallback-only**. `image` is ignored whenever the selected product has media. `alt` is populated in all 11 blocks but never read; markup uses `image.alt`. Remove the block if product media is required, or clearly label it “Fallback gallery image.”

### Section-level

- **Deserves to exist:** yes; no other section owns product selection and add-to-cart.
- **Does not deserve eight independent content sources:** product, product metafields, selling plans, variants, section fallbacks, block fallbacks, static gift copy, and static upsell copy create an operator synchronization job.
- `product_tab` and `age_card` are the mergeable pair. `benefit` and `carousel_image` duplicate product-owned data.

### Editor noise

- Sidebar: **39 controls; about 13 realistically touched** (`product`, offer/perk copy, gift copy/image/progress copy, urgency copy, CTA).
- Add headers: **Product** before `product`; **Reviews** before `rating_text`; **Subscription offer** before `frequency_heading`; **One-time offer** before `ot_title`; **Quantity** before `quantity_heading`; **Gift** before `gift_heading`; **Urgency and checkout** before `urgency_eyebrow`; **Appearance** before `color_scheme`; **Advanced** before `anchor_id` after moving it to the end.

### Missing for the operator

- `gift_product`. The current gift has only image/copy/price display settings and a live threshold bar; no setting identifies the product that is unlocked.
- Catalog-derived upsell presentation. Upsell product selectors now make add-to-cart functional, but the operator must still duplicate each selected product’s image/title/subtitle in the same block.
- One campaign/offer source for discount, promo note, threshold, and expiry. The operator currently has to synchronize `sub_perks`, `ot_note`, gift fields, urgency fields, and checkout reality.

## 2. `lp-hero`

Evidence: `sections/lp-hero.liquid`; `hero-opener.json`; `hero-closer.json`.

### Settings

- **EARNS — 12/21:** `heading`, `subheading`, `closing_text`, `cta_label`, `image`, `image_mobile`, `image_position`, `stat_badge_text`, `highlight_color`, `color_scheme`, `padding_top`, `padding_bottom`. After the required split, each style keeps only its applicable subset.
- **DOES NOT — structural mode switch:** `style`. Product mode renders an `h1`, review badge, guarantee, stat badge, and `testimonial` blocks; founder mode renders an `h2`, two closing fields, and `highlight` blocks (`lp-hero.liquid:18-102`). This is two section jobs, not one CRO choice.
- **DOES NOT — duplicated field:** `closing_text_2`. It renders identically and consecutively with `closing_text`; one rich-text value supports multiple paragraphs.
- **DOES NOT — duplicated/manual review fact:** `badge_text`.
- **DOES NOT — shared internal destination:** `cta_link`; both fragments use `#standalone-product-section` and must match the buy-box `anchor_id`.
- **DOES NOT — shared fact:** `guarantee_text`; the guarantee duration is repeated across sections.
- **DOES NOT — design-system decoration:** `stat_gif`, `stat_icon_1`, `stat_icon_2`. These are three asset decisions for one sales badge and should ship with its component.
- **DOES NOT — internal id:** `anchor_id`; blank in both fragments.

### Blocks

- `testimonial` — **used: 1**; `quote`, `author`, `avatar` all earn in product mode.
- `highlight` — **used: 3**; `text` earns in founder mode.
- They are not mergeable; they are mutually exclusive content models. In the current single section, the operator can add either block type to either style, but the wrong type silently does not render. Split the sections and keep one block type in each.

### Section-level

- **Split, do not add more style settings.** The opener is a page hero (`h1`, eager image); the closer is a founder-story content section (`h2`, lazy image). The two real fragments prove both variants are used, but not that one operator should transform into the other.

### Editor noise

- Sidebar: **21 controls; about 9 realistically touched per instance**. Conditional visibility hides some top-level fields, but it does not prevent incompatible block types.
- If temporarily kept together, add **Mode**, **Copy**, **CTA**, **Media**, **Social proof**, **Appearance**, and **Advanced** headers before `style`, `heading`, `cta_label`, `image`, `stat_badge_text`, `highlight_color`, and `anchor_id` respectively.

### Missing for the operator

- A style-specific block picker. Shopify schema cannot make the current block types safely interchangeable; separate sections are the concrete fix.

## 3. `lp-science-tabs`

Evidence: `sections/lp-science-tabs.liquid`; `science-tabs.json`.

### Settings

- **EARNS — 3/6:** `heading`, `claims`, `color_scheme`.
- **DOES NOT — absent from the fragment:** `padding_top`, `padding_bottom`.
- **DOES NOT — internal id:** `anchor_id`; explicitly blank.

### Blocks

- `claim` — **used: 0**. All six block settings are unused: `label`, `panel_heading`, `intro`, `bullets`, `video_url`, `poster_url`.
- It duplicates the `claims` metaobject list field-for-field. When `claims` has entries, markup ignores every block (`lp-science-tabs.liquid:4-11`). Remove the block model; do not make the operator choose between two places to edit the same claim.

### Section-level

- **Deserves to exist:** yes. It is not a variation of another LP section.
- **One source only:** the real fragment selects four `science_claim` metaobjects and has no blocks.

### Editor noise

- Sidebar: **6 controls; 2 realistically touched** (`heading`, `claims`). No headers needed after removal of the three non-content controls.

### Missing for the operator

- None evidenced. `claims` already provides selection and ordering; the problem is the redundant fallback model.

## 4. `lp-reviews`

Evidence: `sections/lp-reviews.liquid`; `reviews.json`.

### Settings

- **EARNS — 4/8:** `heading`, `color_scheme`, `padding_top`, `padding_bottom`.
- **DOES NOT — manually duplicated trust data:** `average_rating`, `review_count`. They can disagree with the five review blocks, the buy-box rating, the hero badge, or an app.
- **DOES NOT — unused conditional control:** `write_a_review`. It is absent from the fragment and only renders when an `@app` block exists; no app block is configured.
- **DOES NOT — internal id:** `anchor_id`; blank.

### Blocks

- `review` — **used: 5**. `rating`, `title`, `body`, and `author` earn. `date` does not earn as labeled: “Date” does not tell the operator the required `YYYY-MM-DD` value; retain only with format help. `verified` does not earn: a CRO should not self-certify a buyer; derive it from the review source.
- `@app` — **used: 0**. It overlaps the static review source. If added, markup renders static cards and app output together, not one or the other. Remove it or add an explicit source mode with mutually exclusive UI.

### Section-level

- **Deserves to exist:** yes; customer reviews are not a style of the trust wall’s mixed proof mosaic.
- Simplify to one review source. Do not merge with `lp-clinician-reviews`; the card fields and verification sources differ materially.

### Editor noise

- Sidebar: **8 controls; 1 realistically touched** (`heading`) once aggregates are derived. Blocks remain the content editing surface.
- Add **Review summary** before `heading`, **Appearance** before `color_scheme`, and **Advanced** before `anchor_id` if the current schema remains.

### Missing for the operator

- A `product`/review-source selector that pulls aggregates and verification. The current editor asks for numbers and “Verified buyer” assertions instead.

## 5. `lp-trust-wall`

Evidence: `sections/lp-trust-wall.liquid`; `trust-wall.json`.

### Settings

- **EARNS — 4/5:** `heading`, `color_scheme`, `padding_top`, `padding_bottom`.
- **DOES NOT — internal id:** `anchor_id`; blank.

### Blocks

- `doctor_card` — **used: 2**. `photo`, `quote`, `name`, `credentials` all earn.
- `customer_card` — **used: 1**. `avatar`, `quote`, `name`, `caption` all earn.
- These two block types are nearly identical: same person layout, quote, name, and caption slot. Merge to `person_quote` with `image`, `quote`, `name`, `byline`, plus a clearly labeled `person_type` only if styling requires it.
- `media_card` — **used: 5**: two images and three videos. `image` and `video_label` earn. `alt` is populated on 4/5 but static-image markup ignores it and uses `image.alt`; it does not earn as implemented. `is_video` does not earn because it must match `video_url`; infer media type or split image/video blocks. Raw-text `video_url` does not earn; use a hosted-video picker.
- `press_quote` — **used: 1**. `quote`, `label`, `logo` all earn; distinct job.
- `stat_circle` — **used: 3**. `value`, `text` both earn; distinct job. Markup always moves all stats below the wall regardless of drag order.

### Section-level

- **Deserves to exist:** yes. It intentionally mixes five proof formats; it is not a variant of reviews or clinician evaluations.
- Merge only the two person-card block types.

### Editor noise

- Sidebar: **5 controls; 1 realistically touched** (`heading`). No top-level headers needed.
- Inside `media_card`, add **Image** before `image` and **Video** before the video control, with conditional visibility.

### Missing for the operator

- A working per-card accessible text path: the existing `alt` control is ineffective for static images.
- A hosted-video picker; raw CDN URLs are a developer task.

## 6. `lp-clinician-reviews`

Evidence: `sections/lp-clinician-reviews.liquid`; `clinician-reviews.json`.

### Settings

- **EARNS — 5/11:** `intro`, `disclaimer`, `color_scheme`, `padding_top`, `padding_bottom`.
- **DOES NOT AS LABELED:** `heading` renders as the laurel eyebrow, not the main heading; rename to “Eyebrow.” `subheading` renders as the `h2`; rename to “Main heading.”
- **DOES NOT AS LABELED:** `learn_more_label` links to the disclaimer; rename to “Disclaimer link label” or use locale copy.
- **DOES NOT — split fixed attribution:** `footer_text`, `footer_brand`. They render one “powered by” line and the vendor is not a CRO decision. Keep one fixed/vendor-managed attribution.
- **DOES NOT — internal id:** `anchor_id`. It must equal the clinician-band link target.

### Blocks

- `clinician_card` — **used: 2**. `avatar`, `name`, `specialty`, `years`, `highlights` earn. `verified_label` is fixed status copy and should not be edited per card. `title`, `body`, and `sources_note` are needed but do not earn their current vague labels; rename them “Evaluation headline,” “Full evaluation,” and “Cited sources.”
- `@app` — **used: 0**. It duplicates the source job. If installed, app output appears in addition to the two static cards. Remove it or choose one source explicitly.

### Section-level

- **Deserves to exist:** yes; it is a detailed evaluation section, not a variation of the compact clinician band.
- Do **not** merge with `lp-clinicians-band`: the real template places the band near the top (`templates/page.tdk-behind-the-science.json:49-57`) and evaluations much later (`:780-794`). One section cannot occupy both positions.

### Editor noise

- Sidebar: **11 controls; about 4 realistically touched** (eyebrow/main heading, intro, disclaimer).
- Add **Introduction** before `heading`, **Attribution and disclaimer** before `learn_more_label`, **Appearance** before `color_scheme`, and **Advanced** before `anchor_id`.
- In `clinician_card` (9 controls), add **Profile** before `avatar`, **Evaluation** before `title`, and **Evidence** before `sources_note`.

### Missing for the operator

- Structured citation URLs. `sources_note` is one rich-text blob, so an operator cannot manage individual source title/publication/link records safely.

## 7. `lp-comparison-table`

Evidence: `sections/lp-comparison-table.liquid`; `comparison-table.json`.

### Settings

- **EARNS — 8/11:** `heading`, `subheading`, `competitor_label`, `image_desktop`, `image_mobile`, `color_scheme`, `padding_top`, `padding_bottom`.
- **DOES NOT — fixed brand identity:** `brand_label`, `brand_logo`. A CRO should not redefine First Day’s table identity per section.
- **DOES NOT — internal id:** `anchor_id`; blank.

### Blocks

- `feature_row` — **used: 5**; correct repeatable-row job.
- `label` earns. `us_note` and `them_note` are explicitly empty on all 5/5 real rows, so neither earns its place.
- The block is missing the decision that matters: markup hardcodes yes for First Day and no for the competitor on every row. Add `us_result` and `them_result` selects (`yes`, `no`, `neutral`) or document that this section only supports that claim shape.

### Section-level

- **Deserves to exist:** yes; no merge candidate.

### Editor noise

- Sidebar: **11 controls; about 5 realistically touched** (heading, subheading, competitor label, two decorative images).
- Add **Introduction** before `heading`, **Column labels** before `brand_label`, **Decorative media** before `image_desktop`, **Appearance** before `color_scheme`, and **Advanced** before `anchor_id`.

### Missing for the operator

- Per-cell result/status. Notes cannot change the hardcoded check/cross and are unused anyway.

## 8. `lp-clinicians-band`

Evidence: `sections/lp-clinicians-band.liquid`; `clinicians-band.json`.

### Settings

- **EARNS — 1/6:** `title`.
- **DOES NOT — split sentence formatting:** `text_bold`, `text`. They are one sentence split only to force the first fragment bold. Replace both with one inline-rich-text body.
- **DOES NOT AS LABELED:** `more_label` is populated, but “More label (stub)” does not tell the operator that it links to full clinician reviews. Rename to “Review link label.”
- **DOES NOT — absent/internal match:** `more_link` is absent from the fragment and defaults to `#clinician-reviews`; `anchor_id` is blank. The destination must match `lp-clinician-reviews.anchor_id` exactly.

### Blocks

- None; appropriate for a compact band.

### Section-level

- **Deserves to exist separately:** yes. It is an early-page summary/CTA; clinician reviews are a later detailed destination. Their placement proves they are not one section variation.

### Editor noise

- Sidebar: **6 controls; about 3 realistically touched** (title, body copy, link label). No headers needed after consolidation.

### Missing for the operator

- No new control. The missing behavior is automatic destination wiring to the clinician-review section, not another anchor setting.

## 9. `lp-media-accordion`

Evidence: `sections/lp-media-accordion.liquid`; `accordion-nutrients.json`; `accordion-raising-bar.json`; `faq.json`.

### Settings

- **EARNS — 10/13:** `heading`, `show_media`, `image`, `media_position`, `first_open`, `exclusive`, `cta_label`, `color_scheme`, `padding_top`, `padding_bottom`.
- **DOES NOT — shared internal destination:** `cta_link`. Populated media variants use the same buy-box anchor string.
- **DOES NOT — shared fact:** `guarantee_text`; the guarantee is repeated in other sections.
- **DOES NOT — internal id:** `anchor_id`, despite two populated values. Other links must know and exactly match it.

### Blocks

- `item` — **used: 13** across the two populated accordions; `icon`, `title`, `body` all earn. Correct repeatable-content job; not a setting candidate.
- FAQ uses the same section with `show_media: false` and currently has zero items because content is explicitly pending. That is evidence the section variation belongs in `show_media`, not a separate FAQ section.

### Section-level

- **Keep as one section.** The real fragments validate its two intended modes without adding different content models.

### Editor noise

- Sidebar: **13 controls; about 6 realistically touched** (heading, media visibility/image/position, first-open choice, CTA label). The flat list is the problem, not the setting model.
- Add **Content** before `heading`, **Media** before `show_media`, **Accordion behavior** before `first_open`, **CTA** before `cta_label`, **Appearance** before `color_scheme`, and **Advanced** before `anchor_id`.

### Missing for the operator

- `image_mobile` for a deliberate mobile crop. Hero and comparison already expose separate mobile media; this section forces one image at all breakpoints.

## 10. `lp-urgency-banner`

Evidence: `sections/lp-urgency-banner.liquid`; `urgency-banner.json`.

### Settings

- **EARNS — 5/7:** `text`, `cta_label`, `color_scheme`, `padding_top`, `padding_bottom`.
- **DOES NOT — internal destination:** `cta_link`; it repeats the buy-box anchor.
- **DOES NOT — internal id:** `anchor_id`; blank.

### Blocks

- None; appropriate.

### Section-level

- **Keep as is.** One rich-text `text` field correctly owns the sentence and emphasis; it is not a variation of another section.

### Editor noise

- Sidebar: **7 controls; 2 realistically touched** (`text`, `cta_label`). No headers needed.

### Missing for the operator

- Campaign `deadline`/`expires_at`. The schema default and real fragment both contain literal “July”; nothing prevents stale urgency copy.

## 11. `lp-header`

Evidence: `sections/lp-header.liquid`; no fragment; `sections/header-group.json` sets only `logo_url`.

### Settings

- **EARNS under fragment rule — 0/3.**
- **DOES NOT — developer-shaped input:** `logo_url`. It is the only explicitly configured group value, but requires a raw CDN URL. Replace with `image_picker` `logo`.
- **DOES NOT — never configured:** `logo_width`, `link`. `link` is also too vague and its default points to one LP while the anchor’s fixed accessible name says “First Day home.”

### Blocks

- None; appropriate for the minimal LP header.

### Section-level

- **Deserves to exist:** yes, as the header-group section; do not merge it with page content.

### Editor noise

- Sidebar: **3 controls; 2 realistically touched** (logo and destination). No headers needed.

### Missing for the operator

- A media-library logo picker and a clearly labeled “Logo destination.” No menu/CTA gap is evidenced by this intentionally minimal markup.

## 12. `lp-redirect`

Evidence: `sections/lp-redirect.liquid`; no fragment; `templates/index.json` includes it with empty settings.

### Settings

- **EARNS under fragment rule — 0/2.**
- **DOES NOT AS LABELED:** `target` is never configured and “Target” does not tell a CRO “Redirect destination.” If retained, use a URL-shaped control and explicit label.
- **DOES NOT — never configured/transient:** `message`. Outside design mode, `location.replace` runs immediately; the message is fallback/editor copy.

### Blocks

- None; appropriate.

### Section-level

- **Deserves to exist only as a template utility.** Its preset makes a destructive navigation behavior addable like content. Remove the preset/restrict placement; do not merge it with a visual LP section.

### Editor noise

- Sidebar: **2 controls; 1 realistically touched** (`target`). No headers needed.

### Missing for the operator

- None. The fix is a safer, clearer destination control and restricted availability, not more settings.

## 13. `lp-footer`

Evidence: `sections/lp-footer.liquid`; no fragment; `sections/footer-group.json` includes it with empty settings.

### Settings

- **EARNS under fragment rule — 0/3.**
- **DOES NOT AS LABELED/never configured:** `text` (“Text”), `link` (“Link”), `label` (“Link label”). The defaults create one copyright string plus one LP-specific backlink; no supplied real configuration changes any of them.

### Blocks

- None. This is too restrictive for a footer: repeatable legal/navigation links are a block job.

### Section-level

- **Deserves to exist:** yes, as the footer-group section; it is not another content-section variation.

### Editor noise

- Sidebar: **3 controls; about 2 realistically touched** (copyright/links). No headers needed.

### Missing for the operator

- Repeatable link blocks for Privacy, Terms, accessibility, and contact destinations.
- Dynamic year output; the operator should not maintain `© First Day` manually.

## Ranked actions

1. **Buy box:** remove manual commerce/trust fallbacks and duplicate product presentation; make product/catalog data authoritative.
2. **Hero:** split product hero from founder story so settings and blocks cannot silently disappear after a style change.
3. **Science tabs:** delete the unused block fallback; keep metaobjects as the only claim source.
4. **Reviews:** choose one authoritative source and derive aggregates/verification.
5. **Trust wall:** merge duplicate person blocks; replace raw/ineffective media controls.
6. **Clinician proof:** keep band and detailed reviews separate, but remove anchor matching, duplicate app paths, split attribution, and vague labels.
7. **All long schemas:** add the concrete `header` groupings above; currently none exists anywhere in `lp-*`.
