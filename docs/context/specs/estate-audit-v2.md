# Spec — estate audit v2 (tools/audit_lp_estate.py)

v1 measured 44 of their LPs and got `0 sections` on most of them. That was not a bug in their
site — it is the finding. Verified by hand on `wds-wellness-bundle-lp`: zero Shopify sections,
625 references to Replo. Their LP estate has at least two build shapes, and telling them apart
is the whole point of the audit.

## What v2 must add

1. **Cache the HTML.** Save each fetched page under `/tmp/lp-estate-cache/<handle>.html` and
   reuse it when present unless `--refresh`. Re-running analysis must not re-crawl their site.
2. **Classify `build_type` per page:**
   - `sections` — has `id="shopify-section-template--..."` entries (editable in the theme editor)
   - `replo` — no template sections and the body references Replo (a page-builder export)
   - `page-body` — no template sections, no Replo: raw HTML in the page record
   - `unknown` — anything else; say so rather than guessing
   Count `template_sections` and `group_sections` separately (group = header/footer groups).
3. **Parse the handle into a family**, because the naming is systematic:
   product prefix (`kde|tdk|wds|mcm|kcm|trmv|mdp|multi|catalog`), the funnel name, and flags for
   `-spanish`, `-tt`, `-40-off`, `-one-month-free`, `-mystery`, `-gift`, `-sub`, `-alt`, `-old`,
   `-2`, `-trusted`. Emit `family`, `funnel`, `offer_flags`.
4. **Backlog per page** — this is what the dashboard consumes. For each page emit a list of
   concrete, machine-actionable items derived ONLY from measured facts:
   - empty sections present → `drop-empty-sections` (effort S, impact medium)
   - `build_type: replo` → `migrate-off-page-builder` (effort L, impact high)
   - weight over 1500KB → `reduce-page-weight` (effort M, impact high)
   - scripts over 35 → `audit-third-party-scripts` (effort M, impact medium)
   - `overlap_pct >= 60` with the reference → `migrate-to-shared-sections` (effort S, impact high)
   Each item: `{id, title, impact: high|medium|low, effort: S|M|L, agent, evidence}` where
   `evidence` is the measured number that justifies it. Never emit an item without evidence.
5. **Edges** for the graph: `{from, to, type: "same-funnel"|"same-family"|"shares-sections", weight}`.
   Two pages share a funnel when their parsed `funnel` matches.
6. Keep the markdown report, add build-type and backlog totals to it.

Output stays `docs/receipts/lp-estate.json` + `docs/receipts/LP-ESTATE.md`, plus a new
`docs/receipts/lp-estate-graph.json` shaped as `{generated, nodes: [...], edges: [...]}` where a
node carries: handle, url, family, funnel, offer_flags, build_type, weight_kb, template_sections,
empty_sections, scripts, vendors, overlap_pct, backlog[].

Politeness is non-negotiable: sequential, `--delay` default 7s, back off on 429. This hits a
production store.
