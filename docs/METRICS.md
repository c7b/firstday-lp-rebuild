# LP metrics

Every event has this envelope: `{ event, lp_handle, lp_template, lp_variant, product_handle, section, ts }`. `lp_handle` is the path; the template and variant come from the analytics context rendered by the theme.

| Event | When | Extra fields |
| --- | --- | --- |
| `lp_view` | Once on load | `sections` |
| `lp_section_view` | A section is 50% visible for one second, once | `section` |
| `lp_tab_change` | A science or age tab changes | `section`, `from`, `to` |
| `lp_product_switch` | The buy box swaps product in place | `from_product`, `to_product` |
| `lp_cta_click` | A `data-lp-cta` control is clicked | `section`, `label`, `href` |
| `lp_add_to_cart` | The main product form submits or an upsell adds | `product_handle`, `variant_id`, `source: 'main'\|'upsell'` |
| `lp_gift_threshold` | Gift progress reaches 100%, once | `threshold` |
| `lp_scroll_depth` | 25%, 50%, 75%, or 100% is reached, once each | `depth` |

To add an event, first add it to the contract above, then emit it through the module's `emit` helper so it retains the envelope and reaches both `dataLayer` and the `lp:analytics` DOM event. Keep additions decision-oriented: these events measure whether the offer is seen, the switcher is used, and where people stop, rather than collecting interaction noise that cannot change a funnel decision.
