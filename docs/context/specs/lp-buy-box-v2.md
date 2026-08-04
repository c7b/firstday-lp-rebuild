# `lp-buy-box-v2` — the PDP selector, rebuilt to match

## Why a second section rather than an edit

`lp-buy-box` is on the delivered page, the two variant funnels, and the page the panel
reviewed. Changing its markup to chase pixel parity would change all four. This is a separate
section so that:

- `lp-buy-box` stays exactly as reviewed — v1 intact, as instructed.
- The v2 template can swap one for the other by changing a `type` in a template file.
- The diff between the two is legible: it is two files, not a tangle of conditionals inside
  one.

The cost is duplication, and it is the right cost here. A section that renders two different
component structures behind a setting is worse to read and worse to delete later than two
sections that each do one thing.

## What "identical" means for this one

The instruction is explicit: identical presentation, and functionality is not the bar —
add-to-cart does not need to work. So the section reproduces the reference's:

- DOM structure, node for node, so the same CSS relationships hold
- every measured padding, margin, gap, size, border and radius, at 1440 and 390
- borders specifically: the reference gives some cards a border and others none, and changes
  it on selection. That difference is a finding in its own right and is reproduced, not
  averaged.
- icons and images: the reference's own SVG markup and its own asset URLs, self-hosted
- selected and unselected states for both the plan cards and the quantity tiers

It does **not** reproduce: cart behaviour, the subscription app's own scripts, or anything
that would require an app to be installed.

## Structure

Three components, in the reference's own order:

1. **Gallery** — main image, thumbnail track, prev/next arrows
2. **Frequency selector** — heading, Monthly and One-Time cards, prices, benefits, badge
3. **Quantity selector + cart summary** — heading, servings chip, tier grid, CTA, guarantee

Each was measured independently against the rendered reference rather than read out of a
stylesheet, because most of the reference's PDP CSS ships from its CDN and is not in the page
snapshot's inline styles.

## Editability

Still a real section: every string is a setting or a block, so the copy gate can check it and
a merchant can edit it. Pixel parity is not a reason to hardcode content — that would trade
the whole argument of this build for a screenshot.
