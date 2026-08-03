# Spec — the estate graph (tools/build_estate_dashboard.py → docs/receipts/estate.html)

## What this is, and why it is not a chart

The audit produces facts about 60 landing pages. A table of 60 rows is a report nobody reads
twice. What the team actually needs is a **map of work**: every LP as a node, the relationships
between them visible, and every node carrying a queue of concrete jobs that an agent can pick up.

The claim this dashboard has to make visible in one screen:

> These 60 pages are not 60 problems. They are a handful of funnels cloned many times, and the
> work is already itemised and waiting to be picked up.

## Data

Input: `docs/receipts/lp-estate-graph.json` (nodes + edges + backlog per node), written by
`tools/audit_lp_estate.py`. The dashboard EMBEDS that JSON at build time so the HTML is
self-contained and opens from a file, a preview theme, or a phone with no server.

If the JSON is missing, the tool must fail loudly rather than render an empty graph.

## Layout — three regions, no scrolling required to understand it

1. **Header strip**: the four numbers that matter — pages measured, total MB shipped, backlog
   items open, and pages already migrated. Plus one sentence stating the claim above.
2. **The graph** (the centre, and most of the viewport): force-directed, canvas-rendered.
   - one node per LP, radius by page weight, colour by `build_type`
     (`sections` = the accent, `replo` = warning, `page-body` = neutral, migrated = success)
   - edges between pages of the same funnel, thin and low-contrast — they are context, not content
   - the rebuilt funnel and its two live variants are marked as done and pinned near the centre;
     everything else orbits, which makes the migration read as "pull them in"
   - hover: highlight the node, its edges and its family; dim the rest
   - click: the node opens in the side panel and stays selected
3. **Side panel**: the selected LP — handle, family, build type, weight, section counts, vendors,
   and its **backlog as a checklist**, each item showing impact, effort, the agent that would run
   it, and the measured evidence that produced it. Nothing in the panel is hand-written; it all
   comes from the JSON.

Above the graph: filter chips for build type and for impact, and a search box that filters by
handle. Filters dim rather than remove nodes, so the shape of the estate never changes under you.

## Interaction rules

- Canvas, not SVG, and not a library — 60 nodes with a simple velocity-Verlet layout is a hundred
  lines and stays under the CSP with zero dependencies.
- Stop the simulation when it settles (alpha threshold) and on `prefers-reduced-motion` render the
  settled layout immediately without animating.
- Keyboard: the node list in the side panel is a real list of buttons, so the whole thing is
  operable without the canvas. The canvas is an enhancement, not the only path.
- Every number shown must exist in the JSON. No estimates invented in the renderer.

## Visual direction

This is an operations map, not a marketing page. Dark ground so the graph reads, one accent for
"ours / migrated", warning hue reserved for the page-builder pages that are the expensive ones,
mono type for numbers and handles, sans for prose. Light theme supported through tokens, same as
the rest of the repo's docs.

## Output

`docs/receipts/estate.html`, self-contained, and it must render correctly opened as a local file.
