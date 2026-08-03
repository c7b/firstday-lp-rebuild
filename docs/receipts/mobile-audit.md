# Mobile audit at 390px — findings and what happened to them

An adversarial pass over the rebuild at a 390px viewport, run against the build as it stood on
2 Aug 2026. It is kept in the repo because the findings were acted on, not because they are
still true. Line numbers below refer to the code **as audited**; several files have moved since.

**All 6 MAJOR findings are closed.** Verified against the current tree on 3 Aug 2026:

| # | Finding | Resolution |
|---|---|---|
| 1 | `.lp-comparison-table__table` forced horizontal scroll at 390px | `min-width: 510px` → `min-width: 0` |
| 2 | `.lp-buy-box__quantity-note` negative margin collided with the Quantity legend | `margin: -4rem 0 1.2rem auto` → `margin: 0 0 1.2rem auto` |
| 3 | "Write a review" was a non-interactive `<span role="none">` | now a real `<a href>` to the review app anchor |
| 4 | "Learn more" was a non-interactive `<span>` | now a real `<a href>` to the disclaimer anchor |
| 5 | Footer link tap target below 44px | `min-height` added |
| 6 | Urgency CTA 42px tall, below 44px | `min-height` added |

**MINOR findings: most closed, some open on purpose.** Spot-checked as closed: hero H1
line-height `.98` → `1.06`, accordion title `1.25` → `1.3`, trust-wall heading `1.05` → `1.12`.

Two groups stay open deliberately, and the reason matters more than the count:

- **The emoji rows.** Every 🍊 💊 🔥 🚨 🧠 🪄 🧬 flagged here is copy transplanted verbatim from
  the live page. Swapping them for SVG would be a copy change, which the brief puts out of
  scope and which `tools/verify_build.py` would reject. The finding is correct as a rendering
  observation and is the right call to raise with the client — it is not ours to make.
- **The gift-bar and upsell rows** (`__gift-price`, `__upsell-*`) are moot: those blocks are
  switched off in this build, so the type never renders. See `docs/ASSUMPTIONS.md`.

The original table follows, unedited, so the fixes above can be checked against what was found.

| severity | file:line | selector/element | defect | suggested fix |
|---|---|---|---|---|
| MAJOR | assets/lp-comparison-table.css:70 | `.lp-comparison-table__table` | `min-width: 510px` exceeds the 350px content width at a 390px viewport (`20px` container padding on each side), forcing horizontal table scrolling. | Use a mobile single-column/card layout, or remove the fixed minimum and let columns wrap/condense. |
| MAJOR | assets/lp-buy-box.css:441 | `.lp-buy-box__quantity-note` | `margin: -4rem 0 1.2rem auto` pulls the “30 Servings Per Bottle” note upward into the preceding `Quantity` legend at 390px. | Put legend and note in a flex row, or remove the negative margin. |
| MAJOR | sections/lp-reviews.liquid:44 | `.lp-reviews__write-review` | The visible “Write a review” CTA is a noninteractive `<span role="none">`; it has no tap or keyboard action. | Render a real `<a>`/`<button>` and connect it to the review flow. |
| MAJOR | sections/lp-clinician-reviews.liquid:70 | `.lp-clinician-reviews__learn-more` | The visible “Learn more” control is a noninteractive `<span>`; mobile users cannot tap it. | Use an `<a>` or `<button>` with the intended destination/modal behavior. |
| MAJOR | sections/lp-footer.liquid:24 | `.lp-footer__link` | Inline footer link has no min-size or padding; its hit area is only its ~18px text line, below 44px. | Make it `inline-flex` with `min-height/min-width: 4.4rem` and padding. |
| MAJOR | assets/lp-urgency-banner.css:27 | `.lp-urgency-banner__cta` | At the live 15px inherited font size, `line-height: 1.2` plus `1.2rem` top/bottom padding makes a 42px-high link, below 44px. | Add `min-height: 4.4rem` (and center with flex). |
| MINOR | assets/lp-hero.css:120 | `.lp-hero__stat-badge` | Absolutely positioned bottom-right badge overlays the hero image at every mobile width, obscuring image content. | Reserve a separate badge row below the image, or ensure the mobile asset has a dedicated safe area. |
| MINOR | assets/lp-trust-wall.css:100 | `.lp-trust-wall__play-badge` | The 56px absolutely positioned play badge is centered over each media-card image at 390px. | Keep it only if the media has a safe center; otherwise reserve a caption/control area. |
| MINOR | assets/lp-buy-box.css:533 | `.lp-buy-box__gift-price` | Absolutely positioned price sticker overlays the lower-right of the 100px gift image. | Place the price beside/below the image on mobile, or use a safe-area asset. |
| MINOR | assets/lp-hero.css:142 | `.lp-hero__stat-icons img` | `margin-left: -.8rem` makes each subsequent stat icon overlap the prior icon by 8px. | Use a non-negative gap or deliberately clip the stack in a bounded wrapper. |
| MINOR | assets/lp-buy-box.css:378 | `.lp-buy-box__price-note` | Live “with code FIREWORKS” copy is 1.05rem with 1.2 line-height, below the 1.2rem/1.3 text thresholds. | Use at least `1.2rem` and `line-height: 1.3`. |
| MINOR | assets/lp-buy-box.css:422 | `.lp-buy-box__delivery-badge` | Badge text is 1.1rem with `line-height: 1`. | Use at least `1.2rem` and `line-height: 1.3`. |
| MINOR | assets/lp-buy-box.css:438 | `.lp-buy-box__quantity-note` | Live “30 Servings Per Bottle” copy is 1.05rem with 1.2 line-height. | Use at least `1.2rem` and `line-height: 1.3`. |
| MINOR | assets/lp-buy-box.css:532 | `.lp-buy-box__gift-price` | “$25.00 / FREE” price copy is 1rem with 1.15 line-height. | Use at least `1.2rem` and `line-height: 1.3`. |
| MINOR | assets/lp-buy-box.css:615 | `.lp-buy-box__upsell-subtitle` | Upsell body copy is 1.05rem. | Increase to at least `1.2rem`. |
| MINOR | assets/lp-buy-box.css:628 | `.lp-buy-box__upsell-prices` | Upsell price copy is 1.1rem with 1.2 line-height. | Use at least `1.2rem` and `line-height: 1.3`. |
| MINOR | assets/lp-buy-box.css:725 | `.lp-buy-box__stamp` | At 390px, `clamp(0.85rem, 2.3vw, 1.05rem)` resolves to `0.897rem`; line-height is 1.15. | Set a 1.2rem mobile minimum and at least 1.3 line-height. |
| MINOR | assets/lp-buy-box.css:859 | `.lp-buy-box__age-copy small` | Age-card supporting copy is 1.1rem. | Increase to at least `1.2rem`. |
| MINOR | assets/lp-clinician-reviews.css:196 | `.lp-clinician-reviews__disclaimer` | The live FDA/medical-advice disclaimer is 1.15rem. | Increase to at least `1.2rem`. |
| MINOR | assets/lp-buy-box.css:636 | `.lp-buy-box__upsell-prices s` | 1.1rem struck-through price uses `rgba(var(--color-foreground), .55)`; on the live white scheme this is about 4.14:1, below 4.5:1 for normal text. | Use a darker color/greater opacity or increase text to large-text size. |
| MINOR | assets/lp-clinician-reviews.css:138 | `.lp-clinician-reviews__sources` | Citation text uses `rgba(23, 42, 69, .62)` on the white card; about 4.30:1, below 4.5:1 at 1.2rem. | Increase opacity to at least `.64` or use an opaque darker color. |
| MINOR | assets/lp-clinician-reviews.css:196 | `.lp-clinician-reviews__disclaimer` | Disclaimer uses `rgba(23, 42, 69, .58)` on white; about 3.82:1 at 1.15rem. | Use a darker opaque color that reaches 4.5:1. |
| MINOR | assets/lp-buy-box.css:123 | `.lp-buy-box__product-tab` | Text control line-height is `1`, below 1.3. | Set `line-height: 1.3`. |
| MINOR | assets/lp-buy-box.css:212 | `.lp-buy-box__benefit-heading` | Accordion-summary text line-height is 1.25. | Set `line-height: 1.3` or higher. |
| MINOR | assets/lp-buy-box.css:373 | `.lp-buy-box__price` | Price text line-height is `1`. | Set `line-height: 1.3` or higher. |
| MINOR | assets/lp-buy-box.css:456 | `.lp-buy-box__quantity-label`, `.lp-buy-box__savings` | Quantity label and savings text use 1.2 line-height. | Set `line-height: 1.3` or higher. |
| MINOR | assets/lp-buy-box.css:507 | `.lp-buy-box__gift-heading` | Gift heading line-height is 1.15. | Set `line-height: 1.3` or higher. |
| MINOR | assets/lp-buy-box.css:609 | `.lp-buy-box__upsell-title` | Upsell title line-height is 1.25. | Set `line-height: 1.3` or higher. |
| MINOR | assets/lp-hero.css:42 | `.lp-hero__heading` | H1 line-height is `.98`, which risks clipped/overlapping ascenders and descenders on mobile font rendering. | Use at least `1.05` (preferably 1.1–1.2). |
| MINOR | assets/lp-hero.css:196 | `.lp-hero__stat-card p` | Stat-card copy line-height is 1.25. | Set `line-height: 1.3` or higher. |
| MINOR | assets/lp-media-accordion.css:17 | `.lp-media-accordion__heading` | Section heading line-height is 1.03. | Set `line-height: 1.1` or higher. |
| MINOR | assets/lp-media-accordion.css:99 | `.lp-media-accordion__title` | Accordion-summary text line-height is 1.25. | Set `line-height: 1.3` or higher. |
| MINOR | assets/lp-science-tabs.css:36 | `.lp-science-tabs__tab` | Tab label line-height is 1.2. | Set `line-height: 1.3` or higher. |
| MINOR | assets/lp-trust-wall.css:9 | `.lp-trust-wall__heading` | Heading line-height is 1.05. | Set `line-height: 1.1` or higher. |
| MINOR | sections/lp-clinicians-band.liquid:11 | `.lp-clinicians-band__title` | Decorative unicode laurels `❧` and `☙` are used as title icons and can render as emoji/glyph substitutions. | Replace with SVG/CSS decoration. |
| MINOR | sections/lp-clinician-reviews.liquid:94 | `heading` default | Medical symbol `⚕` is used as an icon in “⚕ Clinician Reviews” and may render as emoji. | Replace with an SVG icon. |
| MINOR | sections/lp-buy-box.liquid:544 | `.lp-buy-box__age-arrow` | Unicode arrow `→` is used as the age-card icon. | Replace with the existing/another SVG arrow. |
| MINOR | sections/lp-hero.liquid:129 | `cta_label` default | Unicode emoji `🍊` and `💊` are used as CTA icons and render differently by platform. | Use controlled SVG assets. |
| MINOR | sections/lp-buy-box.liquid:600 | `flavor_text` default | Unicode emoji `🍊` is used as the flavor icon. | Use a controlled SVG/image asset. |
| MINOR | sections/lp-buy-box.liquid:737 | `urgency_eyebrow` default | Unicode emoji `🔥` is used as the urgency icon. | Use a controlled SVG/image asset. |
| MINOR | sections/lp-urgency-banner.liquid:37 | `text_before` default | Unicode emoji `🚨` is used as the urgency icon. | Use a controlled SVG/image asset. |
| MINOR | sections/lp-science-tabs.liquid:195 | `benefits` default | Unicode emoji `🧠`, `🪄`, and `🧬` are used as benefit icons. | Use controlled SVG/image assets. |
