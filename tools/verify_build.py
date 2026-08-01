#!/usr/bin/env python3
"""Automated review gates for the lp-* sections. Run before every commit of section work.

Gates:
1. Every {% schema %} parses as JSON; settings/blocks referenced by fragments exist in it.
2. Every template fragment parses; its `type` matches an existing section file.
3. Copy fidelity: every string value in a fragment must appear in the section's extraction
   JSON (whitespace-normalized) — catches invented/retyped copy, the failure mode that
   side-by-side screenshots can miss. URLs/anchors/scheme names are exempt.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEC = ROOT / "sections"
FRAG = ROOT / "docs" / "context" / "template-fragments"
CTX = ROOT / "docs" / "context" / "sections"

EXEMPT_KEYS = {"cta_link", "color_scheme", "anchor_id", "url", "video_url", "poster_url",
               "media_position", "image_position", "style", "product", "claims"}
URLISH = re.compile(r"^(gid://|https?:|//|/)|\.(png|jpg|jpeg|gif|webp|avif|svg|mp4|css|js)(\?|$)")


def norm(s):
    import html as _html
    s = _html.unescape(s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"[\s ‎]+", " ", s)
    return s.strip().lower()


def corpus_for(section_type):
    """extracted text+alt values concatenated IN NODE ORDER — multi-node sentences match"""
    parts = []
    for name in [f"{section_type}.json", f"{section_type}-live.json"]:
        p = CTX / name
        if not p.exists():
            continue
        data = json.load(open(p))
        for o in data.get("originals", []):
            for n in o.get("nodes", []):
                if n.get("type") == "text":
                    parts.append(n.get("text", ""))
                elif n.get("type") == "img" and n.get("alt"):
                    parts.append(n["alt"])
        # live-reviews file has its own shape
        for r in data.get("reviews", []):
            parts.extend(str(v) for v in r.values())
        for k in ("widget_heading", "product_avg", "product_count"):
            if k in data:
                parts.append(str(data[k]))
    return norm(" ".join(parts))


def iter_strings(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from iter_strings(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from iter_strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def main():
    fails, warns = [], []
    schemas = {}
    for f in sorted(SEC.glob("lp-*.liquid")):
        src = f.read_text(encoding="utf-8")
        m = re.search(r"{%\s*schema\s*%}(.*?){%\s*endschema\s*%}", src, re.S)
        if not m:
            fails.append(f"{f.name}: no schema block")
            continue
        try:
            schemas[f.stem] = json.loads(m.group(1))
        except json.JSONDecodeError as e:
            fails.append(f"{f.name}: schema JSON invalid — {e}")

    for f in sorted(FRAG.glob("*.json")):
        try:
            frag = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            fails.append(f"fragments/{f.name}: invalid JSON — {e}")
            continue
        stype = frag.get("type", "")
        if stype not in schemas:
            fails.append(f"fragments/{f.name}: type '{stype}' has no section file")
            continue
        schema = schemas[stype]
        setting_ids = {s.get("id") for s in schema.get("settings", []) if s.get("id")}
        block_types = {b.get("type"): {s.get("id") for s in b.get("settings", [])}
                       for b in schema.get("blocks", [])}
        for sid in frag.get("settings", {}):
            if sid not in setting_ids:
                fails.append(f"fragments/{f.name}: setting '{sid}' not in {stype} schema")
        for bid, block in frag.get("blocks", {}).items():
            if not isinstance(block, dict):
                warns.append(f"fragments/{f.name}: block '{bid}' is not an object ({block!r:.50})")
                continue
            bt = block.get("type")
            if bt not in block_types:
                fails.append(f"fragments/{f.name}: block '{bid}' type '{bt}' not in schema")
                continue
            for sid in block.get("settings", {}):
                if sid not in block_types[bt]:
                    fails.append(f"fragments/{f.name}: block '{bid}' setting '{sid}' not in '{bt}'")
        bo = frag.get("block_order", [])
        if set(bo) != set(frag.get("blocks", {})):
            fails.append(f"fragments/{f.name}: block_order mismatch")

        haystack = corpus_for(stype)
        if not haystack:
            warns.append(f"fragments/{f.name}: no extraction corpus for {stype}")
            continue
        for path, val in iter_strings(frag.get("settings", {})):
            key = path.rsplit(".", 1)[-1].split("[")[0]
            if key in EXEMPT_KEYS or URLISH.search(val) or len(norm(val)) < 4:
                continue
            if norm(val) not in haystack:
                warns.append(f"fragments/{f.name}: settings.{path} text not found in extraction: {val[:60]!r}")
        for bid, block in frag.get("blocks", {}).items():
            if not isinstance(block, dict):
                continue
            for path, val in iter_strings(block.get("settings", {})):
                key = path.rsplit(".", 1)[-1].split("[")[0]
                if key in EXEMPT_KEYS or URLISH.search(val) or len(norm(val)) < 4:
                    continue
                if norm(val) not in haystack:
                    warns.append(f"fragments/{f.name}: blocks.{bid}.{path} not found in extraction: {val[:60]!r}")

    print(f"sections with valid schema: {len(schemas)}/{len(list(SEC.glob('lp-*.liquid')))}")
    for x in fails:
        print("FAIL", x)
    for x in warns:
        print("WARN", x)
    print(f"\n{len(fails)} failures, {len(warns)} warnings")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
