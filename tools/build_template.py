#!/usr/bin/env python3
"""Assemble templates/page.tdk-behind-the-science.json from the reviewed template fragments.

The page IS this ordered list — a new LP variant is a new order + new fragments, zero new code.
Run: python3 tools/build_template.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAGMENTS = ROOT / "docs" / "context" / "template-fragments"
GENERATED_HEADER = """/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
"""

# visible order of the original page, dead sections dropped
ORDER = [
    ("hero_opener", "hero-opener.json"),
    ("clinicians_band", "clinicians-band.json"),
    ("accordion_nutrients", "accordion-nutrients.json"),
    ("science_tabs", "science-tabs.json"),
    ("buy_box", "buy-box.json"),
    ("urgency_banner", "urgency-banner.json"),
    ("trust_wall", "trust-wall.json"),
    ("accordion_raising_bar", "accordion-raising-bar.json"),
    ("comparison_table", "comparison-table.json"),
    ("clinician_reviews", "clinician-reviews.json"),
    ("reviews", "reviews.json"),
    ("hero_closer", "hero-closer.json"),
]


def variant(template, overrides):
    """A new LP variant is this function: same fragments, a few overrides, a new JSON file.

    overrides = {"<section key>": {"settings": {...}}} — deep-merged onto the base template.
    """
    import copy
    out = copy.deepcopy(template)
    for key, patch in overrides.items():
        if key not in out["sections"]:
            continue
        for group, values in patch.items():
            out["sections"][key].setdefault(group, {}).update(values)
    return out


def semantic_diff(path, produced):
    """Compare a committed template with freshly generated output AS DATA.

    The file has two writers: this generator and Shopify's GitHub sync, which rewrites it with
    its own key order whenever anyone touches the theme editor. Byte comparison flags that
    reordering as drift, which is noise. What must never differ is the content.
    """
    if not path.exists():
        return f"{path.name}: missing"
    committed = json.loads(re.sub(r"^/\*.*?\*/\s*", "", path.read_text(encoding="utf-8"), flags=re.S))
    fresh = json.loads(re.sub(r"^/\*.*?\*/\s*", "", produced, flags=re.S))
    if committed == fresh:
        return None
    diffs = []
    if committed.get("order") != fresh.get("order"):
        diffs.append("section order differs")
    cs, fs = committed.get("sections", {}), fresh.get("sections", {})
    for key in sorted(set(cs) | set(fs)):
        if key not in cs:
            diffs.append(f"{key}: only in generated output")
        elif key not in fs:
            diffs.append(f"{key}: only in the committed file")
        elif cs[key] != fs[key]:
            diffs.append(f"{key}: settings or blocks differ")
    return f"{path.name}: " + "; ".join(diffs or ["content differs"])


def main():
    check_only = "--check" in sys.argv
    sections, order, missing = {}, [], []
    for key, fname in ORDER:
        path = FRAGMENTS / fname
        if not path.exists():
            missing.append(fname)
            continue
        frag = json.loads(path.read_text(encoding="utf-8"))
        frag.pop("_note", None)
        if not frag.get("blocks"):
            frag.pop("blocks", None)
            frag.pop("block_order", None)
        sections[key] = frag
        order.append(key)

    template = {"sections": sections, "order": order}
    problems = []
    out = ROOT / "templates" / "page.tdk-behind-the-science.json"
    body = GENERATED_HEADER + json.dumps(template, indent=2, ensure_ascii=False) + "\n"
    if check_only:
        problems.append(semantic_diff(out, body))
    else:
        out.write_text(body, encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)} with {len(order)} sections")

    # --- variant demos: the Kids and Toddlers funnels. No new Liquid, no new CSS — a
    # different product, whose own metafields carry its facts. Everything else is the same
    # set of sections. This is what "a new LP variant" costs in this architecture.
    for product_handle, filename in [
        ("kids-multivitamin", "page.kde-behind-the-science.json"),
        ("toddlers-multivitamin", "page.toddlers-behind-the-science.json"),
    ]:
        v = variant(template, {"buy_box": {"settings": {"product": product_handle}}})
        vout = ROOT / "templates" / filename
        vbody = GENERATED_HEADER + json.dumps(v, indent=2, ensure_ascii=False) + "\n"
        if check_only:
            problems.append(semantic_diff(vout, vbody))
        else:
            vout.write_text(vbody, encoding="utf-8")
            print(f"wrote {vout.relative_to(ROOT)} (variant: {product_handle})")
    if missing:
        print(f"MISSING fragments (not included): {', '.join(missing)}")

    if check_only:
        real = [p for p in problems if p]
        if real:
            print("Committed templates differ from what the fragments produce:")
            for r in real:
                print("  -", r)
            sys.exit(1)
        print("templates match their fragments (compared as data, not as text)")


if __name__ == "__main__":
    main()
