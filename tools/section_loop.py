#!/usr/bin/env python3
"""Analyze → build → verify loop for one LP section, with an objective gate in the middle.

The shape Cristóbal asked for, and the shape this repo already used by hand:

    ANALYST (Claude)  reads the ORIGINAL page for this section and writes a test spec:
                      every element, icon, format and behaviour it must reproduce.
                      Output: docs/context/tests/<section>.json  (machine-checkable)
        │
        ▼
    BUILDER (GPT/Codex)  gets the spec + the current files + the failing assertions,
                         and edits ONLY that section's files.
        │
        ▼
    RUNNER (Playwright)  executes the spec against the real rendered page. No opinions.
        │
        ▼
    VERIFIER (Claude)  reads the runner output AND the diff. PASS → keep and stop.
                       FAIL → explain WHY in the builder's language and loop.

Why a different model on each side: a model reviewing its own work is systematically kind to
it. Why a runner in the middle: two models agreeing is still an opinion; `currentTime > 0` is
a fact. The loop stops on PASS, or after --max-rounds with the reasons recorded.

Usage:
    set -a; source ../.env; set +a
    python3 tools/section_loop.py lp-science-tabs            # full loop
    python3 tools/section_loop.py lp-hero --analyze-only     # just write the test spec
    python3 tools/section_loop.py --all --max-rounds 2

Requires: claude CLI (analyst/verifier), codex CLI (builder), node + playwright (runner).
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "docs" / "context" / "tests"
LOGS = ROOT / "docs" / "receipts" / "loop"
SNAPSHOT = Path("/home/lcam/firstday-assignment/inputs/fd-lp.html")

SECTION_SOURCES = {
    "lp-hero": ["temp_replo_hero_RkYkXc", "temp_replo_hero_3dPiJD"],
    "lp-media-accordion": ["accordion_block_driBft", "accordion_block_QpghhN"],
    "lp-science-tabs": ["temp_science_module_mqM7QH"],
    "lp-buy-box": ["standalone_product_PMRdVC"],
    "lp-urgency-banner": ["temp_sellout_notice_WQzDBM"],
    "lp-trust-wall": ["homepage_trust_section_YfPXT3"],
    "lp-comparison-table": ["pbfcm_comparison_table_iVgR7T"],
    "lp-reviews": ["1771530273b0a25f6d"],
    "lp-clinician-reviews": ["frontrowmd_clinicians_reviews_z8btGd"],
}

ANALYST_PROMPT = """You are the ANALYST in a build loop for a Shopify landing page rebuild.

Target section: {section}
It replaces these sections of the ORIGINAL page: {originals}

Read, in this order:
1. docs/context/sections/{section}.json — the deterministic extraction of the ORIGINAL section
   (ordered text/image/link nodes). This is ground truth for content.
2. sections/{section}.liquid and assets/{section}.css (and .js if present) — our rebuild.
3. docs/context/template-fragments/*.json — the instance content used on the page.

Your job is NOT to fix anything. Your job is to write the acceptance tests that decide whether
the rebuild reproduces the original: every element, icon, layout format and BEHAVIOUR.

Write the file docs/context/tests/{section}.json with exactly this shape:

{{
  "section": "{section}",
  "notes": "<2-3 sentences: what this section is, what the original does that is easy to miss>",
  "assertions": [
    {{"id": "kebab-id", "type": "exists",  "selector": ".css-selector", "min": 1, "why": "..."}},
    {{"id": "...", "type": "count",  "selector": "...", "equals": 4, "why": "..."}},
    {{"id": "...", "type": "text",   "selector": "body", "contains": "exact copy from the extraction", "why": "..."}},
    {{"id": "...", "type": "video-playing", "selector": "...", "why": "..."}},
    {{"id": "...", "type": "no-horizontal-overflow", "why": "..."}},
    {{"id": "...", "type": "no-broken-links", "why": "..."}}
  ]
}}

Rules:
- Only those six assertion types exist. The runner is tools/qa_interactions.mjs — read it so
  every assertion you write is one it can actually evaluate.
- Copy in "contains" must be transplanted byte-for-byte from the extraction JSON, never retyped.
- 8-16 assertions. Cover: structural elements, the exact counts the original has, the key copy,
  any interactive behaviour, and layout safety at 390px.
- Be strict about things a screenshot hides: counts, behaviour, overflow.

Write ONLY that file. Do not edit any other file. Do not run git. Print the file path when done.
"""

BUILDER_PROMPT = """You are the BUILDER in a build loop for a Shopify landing page rebuild.

Section: {section}. You may edit ONLY these files:
  sections/{section}.liquid, assets/{section}.css, assets/{section}.js,
  docs/context/template-fragments/*.json (only entries whose "type" is "{section}")

Binding context, read first:
1. docs/context/specs/CONVENTIONS.md — the contract (copy is TRANSPLANTED, never authored)
2. docs/context/tests/{section}.json — the acceptance tests you must satisfy
3. docs/context/sections/{section}.json — the original's extracted content (source of all copy)

{failures}

Fix the causes, not the symptoms. Do not weaken or delete tests. Do not touch other sections.
Do not run git. Print a one-line summary of what you changed.
"""

VERIFIER_PROMPT = """You are the VERIFIER in a build loop. A different model just edited a
Shopify section. Decide whether the round PASSES.

Section: {section}

Objective runner output (Playwright against the live rendered page):
{runner}

The builder's diff:
{diff}

Judge on evidence, not intent:
- Every assertion in docs/context/tests/{section}.json must pass. A passing runner is
  necessary but not sufficient: also check the diff did not satisfy a test by gaming it
  (deleting content, hardcoding text a test greps for, hiding an element).
- Copy must still be byte-identical to docs/context/sections/{section}.json.
- No other section's files may be touched.

Reply with a single JSON object and nothing else:
{{"verdict": "PASS" | "FAIL", "reasons": ["..."], "next_instructions": "what the builder must do differently, empty if PASS"}}
"""


def run(cmd, timeout=1800, cwd=ROOT):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, shell=isinstance(cmd, str))


def claude(prompt, timeout=1800):
    """Analyst / verifier — the model that did not write the code."""
    r = run(["claude", "-p", prompt, "--permission-mode", "acceptEdits"], timeout=timeout)
    return (r.stdout or "") + (r.stderr or "")


def codex(prompt, timeout=2400, model="gpt-5.6-terra"):
    """Builder — deliberately a different model family from the analyst/verifier."""
    r = run(["codex", "exec", "-s", "danger-full-access", "--skip-git-repo-check",
             "-m", model, prompt], timeout=timeout)
    return (r.stdout or "") + (r.stderr or "")


def runner(section):
    spec = TESTS / f"{section}.json"
    if not spec.exists():
        return {"error": f"no test spec at {spec}"}
    r = run(["node", "tools/qa_interactions.mjs", "--tests", str(spec)], timeout=900)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return {"error": "runner did not return JSON", "stdout": r.stdout[-1500:], "stderr": r.stderr[-1500:]}


def diff_for(section):
    r = run(["git", "diff", "--", f"sections/{section}.liquid", f"assets/{section}.css",
             f"assets/{section}.js", "docs/context/template-fragments/"])
    return (r.stdout or "")[:12000] or "(no changes)"


def loop_section(section, max_rounds, analyze_only=False):
    TESTS.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    log = {"section": section, "rounds": []}
    originals = ", ".join(SECTION_SOURCES.get(section, []))

    if not (TESTS / f"{section}.json").exists():
        print(f"[{section}] analyst: writing acceptance tests…")
        out = claude(ANALYST_PROMPT.format(section=section, originals=originals))
        log["analyst"] = out[-2000:]
        if not (TESTS / f"{section}.json").exists():
            print(f"[{section}] analyst produced no spec — stopping")
            log["result"] = "NO_SPEC"
            (LOGS / f"{section}.json").write_text(json.dumps(log, indent=1))
            return "NO_SPEC"

    if analyze_only:
        return "SPEC_ONLY"

    failures_text = "Nothing has been reported broken yet: make the section satisfy every test."
    for rnd in range(1, max_rounds + 1):
        print(f"[{section}] round {rnd}: runner…")
        result = runner(section)
        failed = [r for r in result.get("results", []) if not r.get("pass")]
        if not result.get("error") and not failed:
            print(f"[{section}] all assertions pass before building — nothing to do")
            log["result"] = "PASS_NO_CHANGE"
            break

        failures_text = "The runner reports these failures:\n" + json.dumps(
            failed or result, indent=1)[:4000]
        print(f"[{section}] round {rnd}: builder ({len(failed)} failing)…")
        build_out = codex(BUILDER_PROMPT.format(section=section, failures=failures_text))

        print(f"[{section}] round {rnd}: runner (post-build)…")
        result2 = runner(section)
        verdict_raw = claude(VERIFIER_PROMPT.format(
            section=section, runner=json.dumps(result2, indent=1)[:4000], diff=diff_for(section)))
        try:
            verdict = json.loads(verdict_raw[verdict_raw.index("{"):verdict_raw.rindex("}") + 1])
        except Exception:
            verdict = {"verdict": "FAIL", "reasons": ["verifier did not return JSON"],
                       "next_instructions": verdict_raw[-800:]}

        log["rounds"].append({"round": rnd, "builder": build_out[-1200:],
                              "runner": result2, "verdict": verdict})
        print(f"[{section}] round {rnd}: {verdict['verdict']} — {'; '.join(verdict.get('reasons', []))[:200]}")

        if verdict["verdict"] == "PASS":
            log["result"] = "PASS"
            break
        failures_text = ("Previous round was REJECTED by the verifier:\n"
                         + json.dumps(verdict, indent=1)[:2500])
    else:
        log["result"] = "FAIL_MAX_ROUNDS"

    (LOGS / f"{section}.json").write_text(json.dumps(log, indent=1, ensure_ascii=False))
    print(f"[{section}] → {log.get('result')} (log: docs/receipts/loop/{section}.json)")
    return log.get("result")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sections", nargs="*", default=[])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--max-rounds", type=int, default=3)
    ap.add_argument("--analyze-only", action="store_true")
    args = ap.parse_args()

    targets = list(SECTION_SOURCES) if args.all else args.sections
    if not targets:
        ap.error("name at least one section, or pass --all")

    summary = {}
    for s in targets:
        started = time.time()
        summary[s] = loop_section(s, args.max_rounds, args.analyze_only)
        print(f"[{s}] {summary[s]} in {int(time.time() - started)}s\n")
    print(json.dumps(summary, indent=1))
    sys.exit(0 if all(v in ("PASS", "PASS_NO_CHANGE", "SPEC_ONLY") for v in summary.values()) else 1)


if __name__ == "__main__":
    main()
