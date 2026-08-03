# CI and previews

`quality.yml` runs on every pull request and every push to `main`. Its ordered jobs verify Liquid
section schemas and setting references, regenerate templates and reject drift, then verify copy
fidelity while putting every `WARN` line in the job summary.

`preview.yml` pushes an unpublished Shopify theme for each same-repository pull request, comments
with its preview URL, and deletes the theme when the pull request closes. It needs the repository
secrets `SHOPIFY_CLI_THEME_TOKEN` and `SHOPIFY_FLAG_STORE`. Forks cannot use these secrets, and the
workflow's steps are inert when the theme token is absent. Never put either secret in a workflow,
tracked file, command argument, or log.

`lighthouse.yml` runs manually and weekly against the live theme preview. It installs the
repository's pinned Lighthouse dev dependency, reads thresholds from
`docs/receipts/perf-budget.json`, fails regressions, and writes the measured performance score,
total blocking time, and largest contentful paint to the job summary. It needs no secrets.

To add a gate, make the check a deterministic command that exits non-zero on failure, add it as an
ordered job or step in the appropriate workflow, and put reviewer-facing diagnostics in the job
summary. Keep thresholds and other editable policy in a receipt file when practical; do not weaken
an existing check to make a run pass.

**A gate that only a human remembers to run is not a gate.**
