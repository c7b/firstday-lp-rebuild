#!/usr/bin/env python3
"""Deterministic content extraction from the live-page snapshot (inputs/fd-lp.html).

Emits one JSON per *target* section under docs/context/sections/. Each JSON carries the
ordered DOM content (text nodes, images, links) of the original section(s) it replaces,
so builders transplant copy byte-for-byte instead of retyping it. No LLM touches this step.

Usage: python3 tools/extract_content.py <path-to-fd-lp.html>
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

# target section -> original shopify section ids (suffix after template--...__)
MAPPING = {
    "lp-hero": ["temp_replo_hero_RkYkXc", "temp_replo_hero_3dPiJD"],
    "lp-media-accordion": ["accordion_block_driBft", "accordion_block_QpghhN", "faq_yFdkhp"],
    "lp-science-tabs": ["temp_science_module_mqM7QH"],
    "lp-buy-box": ["standalone_product_PMRdVC"],
    "lp-urgency-banner": ["temp_sellout_notice_WQzDBM"],
    "lp-trust-wall": ["homepage_trust_section_YfPXT3"],
    "lp-comparison-table": ["pbfcm_comparison_table_iVgR7T"],
    "lp-reviews": ["1771530273b0a25f6d"],
    # dropped-by-decision sections, extracted anyway as evidence they render ~nothing:
    "_dropped": [
        "temp_marquee_VcwMAg", "custom_liquid_rkHyT8", "timeline_section_N69qEe",
        "image_with_text_Fc3pAp", "temp_a_plus_cards_xn333q", "temp_benefits_split_kngUgC",
        "frontrowmd_clinicians_reviews_z8btGd", "temp_css_XVHj4R",
    ],
}

VOID = {"img", "br", "hr", "input", "meta", "link", "source"}
SKIP = {"script", "style", "noscript", "svg"}


class SectionWalker(HTMLParser):
    """Walks one section subtree, emitting ordered content nodes with class-path context."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # (tag, class)
        self.skip_depth = 0
        self.nodes = []
        self.seq = 0             # bumps on every tag boundary; text merges only within one seq

    def _path(self):
        parts = []
        for tag, cls in self.stack[-4:]:
            parts.append(f"{tag}.{cls.split()[0]}" if cls else tag)
        return ">".join(parts)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.seq += 1
        if tag in SKIP:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag == "img":
            self.nodes.append({
                "type": "img",
                "src": a.get("src") or a.get("data-src") or "",
                "srcset": (a.get("srcset") or a.get("data-srcset") or "")[:500],
                "alt": a.get("alt") or "",
                "path": self._path(),
            })
            return
        if tag not in VOID:
            self.stack.append((tag, a.get("class") or ""))
        if tag == "a" and a.get("href"):
            self.nodes.append({"type": "a-open", "href": a["href"], "path": self._path()})

    def handle_endtag(self, tag):
        self.seq += 1
        if tag in SKIP:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.skip_depth:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.skip_depth:
            return
        text = re.sub(r"\s+", " ", data).strip()
        if not text:
            return
        last = self.nodes[-1] if self.nodes else None
        # merge only text split by the parser itself (entities), never across tag boundaries
        if last and last["type"] == "text" and last.get("seq") == self.seq:
            last["text"] += " " + text
        else:
            self.nodes.append({"type": "text", "text": text, "path": self._path(), "seq": self.seq})


def section_bounds(html):
    ids = [(m.start(), m.group(1)) for m in re.finditer(r'id="shopify-section-(template--[^"]+)"', html)]
    out = {}
    for i, (pos, sid) in enumerate(ids):
        end = ids[i + 1][0] if i + 1 < len(ids) else len(html)
        out[sid.split("__", 1)[1]] = html[pos:end]
    return out


def extract_jdgm(chunk):
    """The reviews section renders client-side; its data ships as inline jdgm.data JSON."""
    out = {}
    dec = json.JSONDecoder()
    for m in re.finditer(r"jdgm\.data\.(\w+)(?:\[(\d+)\])?\s*(?:\|\|)?=\s*\{", chunk):
        key = m.group(1) + (f"[{m.group(2)}]" if m.group(2) else "")
        try:
            obj, _ = dec.raw_decode(chunk[m.end() - 1:])
            out[key] = obj
        except ValueError:
            out[key] = {"error": "unparseable"}
    return out


def main():
    snapshot = Path(sys.argv[1])
    html = snapshot.read_text(encoding="utf-8", errors="replace")
    chunks = section_bounds(html)
    outdir = Path(__file__).resolve().parent.parent / "docs" / "context" / "sections"
    outdir.mkdir(parents=True, exist_ok=True)

    for target, originals in MAPPING.items():
        payload = {"target_section": target, "source_snapshot": snapshot.name, "originals": []}
        for name in originals:
            chunk = chunks.get(name)
            if chunk is None:
                payload["originals"].append({"original_id": name, "error": "not found"})
                continue
            # cut trailing content that belongs to footer/scripts on the last section
            walker = SectionWalker()
            walker.feed(chunk)
            entry = {
                "original_id": name,
                "raw_bytes": len(chunk),
                "nodes": walker.nodes,
            }
            if target == "lp-reviews":
                entry["jdgm_data"] = extract_jdgm(chunk)
            payload["originals"].append(entry)
        out = outdir / f"{target}.json"
        out.write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")
        counts = ", ".join(
            f"{o['original_id']}: {len(o.get('nodes', []))} nodes" for o in payload["originals"]
        )
        print(f"{out.name}  <-  {counts}")


if __name__ == "__main__":
    main()
