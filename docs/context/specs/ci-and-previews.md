# Spec — CI gates and per-PR previews

Every quality gate in this repo is currently something a human remembers to run. That is the
difference between "I did careful work" and "the standard survives me". Move them into CI.

## 1. `.github/workflows/quality.yml` — runs on pull_request and on push to main

Jobs, in this order, failing fast:

- **schema** — every `sections/lp-*.liquid` `{% schema %}` must be valid JSON, and every setting
  id referenced by a fragment must exist in its schema. This is `python3 tools/verify_build.py`,
  which already exits non-zero on failure. No secrets needed.
- **template** — run `python3 tools/build_template.py` and fail if `git diff --exit-code
  templates/` is dirty: the committed templates must match what the generator produces, so
  nobody hand-edits a generated file.
- **copy-fidelity** — the same `verify_build.py` run already covers it; surface its WARN lines in
  the job summary so a reviewer sees drift without digging.

Use `actions/setup-python@v5` (3.12). No network access needed for these three.

## 2. `.github/workflows/preview.yml` — per-PR preview theme

On `pull_request` (only when the PR is from this repo, not a fork):
- `actions/setup-node@v4`, install `@shopify/cli` locally
- `shopify theme push --unpublished --json --theme "PR #${{ github.event.number }}"` using
  `SHOPIFY_CLI_THEME_TOKEN` and `SHOPIFY_FLAG_STORE` from repo secrets
- capture the preview URL from the JSON and post it as a PR comment via `actions/github-script`
- a companion job on `pull_request: closed` deletes that theme so the library does not fill up

Guard everything with `if: ${{ secrets.SHOPIFY_CLI_THEME_TOKEN != '' }}` so the workflow is inert
in a fork or before secrets are set, and say so in the job name.

## 3. `.github/workflows/lighthouse.yml` — performance budget, on demand + weekly

- `workflow_dispatch` and a weekly `schedule`
- installs the repo's own devDependency Lighthouse, runs it against the preview URL of the live
  theme, and **fails if performance drops below 65 or total blocking time exceeds 900ms**
- writes the numbers into the job summary as a small table

Budgets live in `docs/receipts/perf-budget.json` so they are edited without touching workflow
YAML: `{"performance": 65, "total-blocking-time_ms": 900, "largest-contentful-paint_ms": 4500}`.

## 4. `docs/CI.md`

Short: what each workflow guards, which secrets it needs (`SHOPIFY_CLI_THEME_TOKEN`,
`SHOPIFY_FLAG_STORE`), how to add a gate, and the rule — **a gate that only a human remembers to
run is not a gate.**

Do not commit any secret. Do not weaken an existing check to make CI pass.
