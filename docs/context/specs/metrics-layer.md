# Spec — funnel metrics layer (assets/lp-analytics.js)

The variant factory is worthless if nobody can tell which variant wins. This emits semantic
events for the analytics the store already has — no new vendor, no PII, no per-variant developer
work.

## Contract

One small module, loaded once from the layout after the section assets. It emits to BOTH:
- `window.dataLayer.push({...})` — picked up by GTM, which they already run
- a DOM `CustomEvent` on `document` named `lp:analytics` with the same payload, so any other tool
  can subscribe without touching this file

Every payload carries the same envelope so events from any LP are comparable:

```js
{ event: 'lp_<name>', lp_handle, lp_template, lp_variant, product_handle, section, ts }
```

`lp_handle` from `window.location.pathname`, `lp_template` and `lp_variant` from a
`<script type="application/json" id="lp-analytics-context">` block the theme renders (see below).

## Events, and only these

| event | fires when | extra fields |
|---|---|---|
| `lp_view` | once on load | `sections` (count) |
| `lp_section_view` | a section is 50% visible for 1s, once per section | `section` |
| `lp_tab_change` | science tab or age tab changes | `section`, `from`, `to` |
| `lp_product_switch` | the buy box swaps product in place | `from_product`, `to_product` |
| `lp_cta_click` | any `[data-lp-cta]` is clicked | `section`, `label`, `href` |
| `lp_add_to_cart` | the product form submits or an upsell adds | `product_handle`, `variant_id`, `source: 'main'\|'upsell'` |
| `lp_gift_threshold` | the gift bar reaches 100%, once per page view | `threshold` |
| `lp_scroll_depth` | 25/50/75/100% reached, once each | `depth` |

Nothing else. No mouse tracking, no dwell heatmaps, no identifiers of any kind.

## Theme side

- `snippets/lp-analytics-context.liquid` renders the JSON context block: template name, page
  handle, the buy box's current product handle.
- Add `data-lp-cta` to the CTA anchors that already exist in `lp-hero`, `lp-media-accordion`,
  `lp-urgency-banner` and the buy box's add-to-cart. Do not add new markup beyond that attribute.
- A theme setting `enable_analytics` (checkbox, default true) in `config/settings_schema.json`
  under a new "LP analytics" header, so it can be switched off without a deploy.

## Rules

- If `window.dataLayer` does not exist, create it — never throw.
- Respect `navigator.doNotTrack === '1'` and skip everything.
- Zero dependencies, under 4KB, `defer`.
- Guard every listener so a missing section never breaks the page.

## Docs

`docs/METRICS.md`: the event table above, the envelope, how to add an event, and one paragraph on
why these events and not others — every event maps to a decision someone actually makes about a
funnel (does the offer get seen, does the switcher get used, where do people stop).
