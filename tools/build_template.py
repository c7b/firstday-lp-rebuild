#!/usr/bin/env python3
"""Assemble templates/page.tdk-behind-the-science.json from the reviewed template fragments.

The page IS this ordered list — a new LP variant is a new order + new fragments, zero new code.
Run: python3 tools/build_template.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAGMENTS = ROOT / "docs" / "context" / "template-fragments"

# visible order of the original page, dead sections dropped
ORDER = [
    ("hero_opener", "hero-opener.json"),
    ("accordion_nutrients", "accordion-nutrients.json"),
    ("science_tabs", "science-tabs.json"),
    ("buy_box", "buy-box.json"),
    ("urgency_banner", "urgency-banner.json"),
    ("trust_wall", "trust-wall.json"),
    ("accordion_raising_bar", "accordion-raising-bar.json"),
    ("comparison_table", "comparison-table.json"),
    ("reviews", "reviews.json"),
    ("hero_closer", "hero-closer.json"),
]


def main():
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
    out = ROOT / "templates" / "page.tdk-behind-the-science.json"
    out.write_text(json.dumps(template, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} with {len(order)} sections")
    if missing:
        print(f"MISSING fragments (not included): {', '.join(missing)}")


if __name__ == "__main__":
    main()
