# PROCESS.md — How this was actually built

> This document is written **live, during the build** — not reconstructed afterwards. Each phase
> logs what the AI did, what context it was given, and what a human decided. The orchestration
> itself is part of the deliverable: the ask was "be specific with your process, with what context
> you're giving the AI."

## The setup

**Roles.** One human (Cristóbal) orchestrating three AI roles with distinct jobs:

| Role | Model | Job |
|---|---|---|
| Architect / reviewer | Claude (Fable 5, Claude Code CLI) | Analyze inputs, write per-section specs, review every diff before it lands |
| Builder | GPT (Codex CLI) | Implement sections from specs — cross-model on purpose |
| Extraction | Deterministic Python scripts | Copy/image extraction from the 2MB snapshot — **no LLM**, because parsing is a solved problem and hallucinated copy is the failure mode that matters most here |

**Why cross-model (Claude specs → GPT builds → Claude reviews)?** A model reviewing its own
output is systematically kind to it. A different model has no such loyalty. The review loop
consistently catches real issues (schema mismatches, missed settings, accessibility slips) that
same-model review waves through.

**Why not one giant prompt?** The naive version of this assignment is "here's a 2MB HTML file,
rebuild it in Liquid" pasted into a chat. That produces something that *looks* right and drifts
everywhere it matters: invented copy, one 800-line section, no schema, no reuse story. Every
decision below exists to close that gap. (Longer contrast at the end of this doc.)

## Phase log

### F0 — Scaffold (this section written 2026-07-31)

- `shopify theme init --clone-url https://github.com/Shopify/dawn` → **Dawn 15.5.0**, pinned and
  committed unmodified as the baseline commit. Rationale: every diff after this commit is *ours*,
  reviewable in isolation. First `theme init` run pulled Shopify's new skeleton theme — caught
  because the baseline was inspected before committing, kept Dawn per spec.
- Fresh git history (Dawn's upstream history dropped): the repo tells the story of this build,
  not Dawn's. `.env` ignored from commit 1 — credentials never enter the repo.
- Dev store: created a placeholder product (`teens-multivitamin`) via Admin API so the buy box
  has a real product object to render; exact price/images corrected in F3 from extracted content.
- Performance baseline: PageSpeed Insights anonymous quota was exhausted → switched to **local
  Lighthouse CLI (installed as repo devDependency) against both the original live page and the
  rebuild**, same machine, same throttling profile. Better methodology anyway: identical tooling
  on both sides of the comparison, and it can reach the password-protected dev store.

### F1 — Content extraction (deterministic, no LLM)

- `tools/extract_content.py` walks each original section's DOM and emits ordered
  text/image/link nodes → `docs/context/sections/*.json`. Copy is **transplanted from these
  files, never retyped by a model** — hallucinated copy is the one failure mode a side-by-side
  screenshot won't always catch.
- First run had a real bug worth logging: adjacent text nodes merged across tag boundaries,
  collapsing the comparison table's 13 content nodes into 9 blobs. Caught by inspecting the
  output against the section (the review step exists for the extractor too). Fixed with a
  tag-boundary sequence counter.
- Findings that shaped scope:
  - The reviews "section" is the Judge.me widget — zero DOM content; its data ships as inline
    `jdgm.data` JSON (4.75★, 11,027 store reviews). Extractor parses that JSON directly.
  - The FAQ section renders **empty** in the snapshot, like 7 other of the 19 original
    sections (`_dropped.json` documents each one). Dead weight in the current template.
  - The science module's four tabs are CDN-hosted mp4s, not images.
- Live-page verification (FAQ content, Judge.me cards, dead-section confirmation) queued
  behind a rate-limit: firstday.com started returning 429/`local_rate_limited` to our
  automated fetches. Deferred with backoff rather than hammering a production store.

### F2 — Section builds (the orchestration exhibit)

- Context per builder agent — exactly three files: `CONVENTIONS.md` (binding contract),
  `specs/lp-<name>.md` (settings/blocks/layout/fragments), `sections/lp-<name>.json` (the only
  legal source of copy). Specs were committed *before* builders ran, so the build diff is
  cleanly attributable.
- 8 builder agents in parallel (GPT via Codex CLI): 7 on the standard model, the buy box — the
  hardest section, 236KB of app-driven commerce UI — on the top-tier model.
- Cross-model on purpose: Claude wrote the specs and reviews every diff; GPT builds. Review
  loop results logged below when builds land.
- Store prep ran concurrently: `science_claim` metaobject definition created via Admin GraphQL
  (7 fields incl. `product_scope` for the multi-product LP family; storefront PUBLIC_READ).

- **Live-page verification came back** (rate limit cleared; one rendered-DOM dump, requests
  spaced): all 8 "dead" sections render nothing on the live page **with JS executed** — including
  the FAQ. The drop decision is now evidence-backed, not snapshot-inference. Bonus: the rendered
  DOM carried the Judge.me widget's product-level payload → 5 real review cards + true summary
  (4.74★, 1,394 product reviews, histogram 87/6/2/2/3) extracted to `lp-reviews-live.json`; the
  reviews builder uses these instead of placeholders.
- **Performance baseline landed** (local Lighthouse 12.x, emulated Moto G Power, mobile
  throttling, single run): original page scores **26/100 performance — LCP 8.4s, TBT 20.9s,
  Speed Index 37.5s, 32MB total transfer**. Receipt JSON kept for the README table.
- Infra note worth keeping: the box blocks unprivileged user namespaces (AppArmor), so the
  builder CLI's own sandbox (bwrap) can't start — first builder wave died instantly. Fix:
  builders run without their inner sandbox but inside the orchestrator's sandbox (single
  containment layer instead of nested). Diagnosed from the error, not by disabling things
  blindly.

*(F3–F5 appended as they happen.)*
