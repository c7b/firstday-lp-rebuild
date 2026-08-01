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

*(Phases F1–F5 appended as they happen.)*
