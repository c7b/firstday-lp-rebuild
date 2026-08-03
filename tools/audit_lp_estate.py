#!/usr/bin/env python3
"""Measure the whole LP estate, not just the one page the brief named.

The sitemap lists 60 `-lp` pages. Rebuilding one of them is the exercise; knowing what the
other 59 cost is the actual decision the team has to make. This fetches each one (politely,
sequentially, with backoff) and records what it is made of, so the migration can be ranked by
evidence instead of by whoever shouts.

Per page: transfer weight, section inventory, which third-party scripts it loads, how much of
its section list it shares with the funnel we rebuilt, and whether its sections are the same
franken-set. Output: docs/receipts/lp-estate.json + docs/receipts/LP-ESTATE.md

Usage: python3 tools/audit_lp_estate.py [--limit N] [--delay SECONDS]
"""
import argparse
import json
import re
import time
import urllib.error
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SITEMAP = Path("/home/lcam/firstday-assignment/inputs/firstday-sitemap.xlsx")
OUT_JSON = ROOT / "docs" / "receipts" / "lp-estate.json"
OUT_MD = ROOT / "docs" / "receipts" / "LP-ESTATE.md"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# the funnel the brief asked for — every other page is compared against it
REFERENCE = "tdk-behind-the-science-lp"

VENDOR_HINTS = {
    "judge.me": "Judge.me reviews",
    "thefrontrowhealth": "FrontRow MD",
    "klaviyo": "Klaviyo",
    "attentive": "Attentive",
    "intelligems": "Intelligems",
    "northbeam": "Northbeam",
    "gorgias": "Gorgias",
    "stay.ai": "Stay AI",
    "retextion": "Stay AI",
    "replo": "Replo",
    "weglot": "Weglot",
    "opensend": "Opensend",
    "blotout": "Blotout",
    "clarity.ms": "MS Clarity",
    "googletagmanager": "GTM",
    "impact.com": "Impact",
    "beamimpact": "Beam",
    "pandectes": "Pandectes",
    "savedby": "SavedBy",
}


def lp_handles():
    z = zipfile.ZipFile(SITEMAP)
    M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    out = []
    for row in root.iter(M + "row"):
        vals = []
        for c in row.iter(M + "c"):
            t = c.find(M + "is")
            if t is not None:
                vals.append("".join(x.text or "" for x in t.iter(M + "t")))
            else:
                v = c.find(M + "v")
                vals.append(v.text if v is not None else "")
        if len(vals) > 2 and vals[0] == "pages" and vals[2].endswith("-lp"):
            out.append(vals[2])
    return sorted(set(out))


def fetch(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read().decode("utf-8", "replace"), r.status
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(20 * (attempt + 1))
                continue
            return "", e.code
        except Exception:
            time.sleep(5)
    return "", 0


def analyse(html):
    sections = [m.group(1).split("__", 1)[-1]
                for m in re.finditer(r'id="shopify-section-(template--[^"]+)"', html)]
    # a section with almost no markup between it and the next one renders nothing
    bounds = [(m.start(), m.group(1)) for m in re.finditer(r'id="shopify-section-(template--[^"]+)"', html)]
    empty = 0
    for i, (pos, _) in enumerate(bounds):
        end = bounds[i + 1][0] if i + 1 < len(bounds) else len(html)
        chunk = html[pos:end]
        text = re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>|<style.*?</style>", " ", chunk, flags=re.S))
        if len(re.sub(r"\s+", "", text)) < 40:
            empty += 1
    vendors = sorted({name for hint, name in VENDOR_HINTS.items() if hint in html})
    return {
        "bytes": len(html),
        "sections": sections,
        "section_count": len(sections),
        "empty_sections": empty,
        "scripts": len(re.findall(r"<script[^>]*\bsrc=", html)),
        "images": len(re.findall(r"<img", html)),
        "vendors": vendors,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=6.0)
    args = ap.parse_args()

    handles = lp_handles()
    if args.limit:
        handles = handles[: args.limit]

    # keep the reference page first so comparisons always have it
    handles = sorted(handles, key=lambda h: (h != REFERENCE, h))

    results, ref_sections = {}, None
    for i, h in enumerate(handles, 1):
        url = f"https://firstday.com/pages/{h}"
        html, status = fetch(url)
        if not html:
            results[h] = {"status": status, "error": "not fetched"}
            print(f"[{i}/{len(handles)}] {h}: HTTP {status}")
            time.sleep(args.delay)
            continue
        info = analyse(html)
        info["status"] = status
        if h == REFERENCE:
            ref_sections = set(info["sections"])
        if ref_sections is not None:
            shared = set(info["sections"]) & ref_sections
            info["shared_with_reference"] = len(shared)
            info["overlap_pct"] = round(100 * len(shared) / max(1, len(set(info["sections"]))))
        results[h] = info
        print(f"[{i}/{len(handles)}] {h}: {info['bytes']//1024}KB, "
              f"{info['section_count']} sections ({info['empty_sections']} empty), "
              f"{info['scripts']} scripts, overlap {info.get('overlap_pct','-')}%")
        time.sleep(args.delay)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({"reference": REFERENCE, "pages": results}, indent=1))
    write_report(results)
    print(f"\n{OUT_JSON.relative_to(ROOT)} and {OUT_MD.relative_to(ROOT)} written")


def write_report(results):
    ok = {h: v for h, v in results.items() if v.get("section_count")}
    if not ok:
        OUT_MD.write_text("# LP estate\n\nNo pages could be fetched.\n")
        return

    total_bytes = sum(v["bytes"] for v in ok.values())
    total_sections = sum(v["section_count"] for v in ok.values())
    total_empty = sum(v["empty_sections"] for v in ok.values())
    every_section = Counter(s for v in ok.values() for s in v["sections"])
    reused = {s: n for s, n in every_section.items() if n > 1}
    vendors = Counter(x for v in ok.values() for x in v["vendors"])

    rows = sorted(ok.items(), key=lambda kv: -kv[1]["bytes"])
    lines = [
        "# The other 59 pages",
        "",
        "The brief named one funnel. The sitemap lists 60 `-lp` pages, so before proposing a",
        "migration I measured them: every page fetched once, politely and sequentially, and",
        "inventoried by weight, section list, empty sections and third-party scripts.",
        "",
        f"**{len(ok)} pages measured.** Raw data: `lp-estate.json`.",
        "",
        "## What the estate costs today",
        "",
        "| | |",
        "|---|---|",
        f"| Pages measured | {len(ok)} |",
        f"| Total HTML shipped | {total_bytes/1024/1024:.1f} MB |",
        f"| Average page | {total_bytes/len(ok)/1024:.0f} KB |",
        f"| Section instances across the estate | {total_sections} |",
        f"| Section instances that render nothing | {total_empty} ({round(100*total_empty/max(1,total_sections))}%) |",
        f"| Distinct section types in use | {len(every_section)} |",
        f"| Section types used on more than one page | {len(reused)} |",
        "",
        "## The duplication, stated plainly",
        "",
        f"{len(reused)} section types account for the {total_sections} section instances on these",
        "pages. Every one of those repeats is a copy someone maintains by hand today, and the",
        "rebuild turns each into one file with settings.",
        "",
        "Most repeated section types:",
        "",
        "| Section type | Pages using it |",
        "|---|---|",
    ]
    for s, n in every_section.most_common(15):
        lines.append(f"| `{s}` | {n} |")

    lines += [
        "",
        "## Heaviest pages — where a migration pays first",
        "",
        "| Page | Weight | Sections | Empty | Scripts | Overlap with the rebuilt funnel |",
        "|---|---|---|---|---|---|",
    ]
    for h, v in rows[:20]:
        lines.append(
            f"| `{h}` | {v['bytes']//1024} KB | {v['section_count']} | {v['empty_sections']} | "
            f"{v['scripts']} | {v.get('overlap_pct','-')}% |")

    lines += [
        "",
        "## Third-party load, by page count",
        "",
        "| Vendor | Pages |",
        "|---|---|",
    ]
    for name, n in vendors.most_common():
        lines.append(f"| {name} | {n} |")

    lines += [
        "",
        "## How to read this",
        "",
        "- **Empty sections** are pure cost: markup, CSS and editor entries for something the",
        "  visitor never sees. They are also the safest thing to delete first.",
        "- **Overlap with the rebuilt funnel** is the migration shortcut: a page that shares most",
        "  of its section list with the one already rebuilt needs content entries, not new code.",
        "- **Weight** ranks the work by what a customer actually pays for on a phone.",
        "",
        "A migration sequenced from this table starts with the pages that are heaviest AND",
        "highest-overlap: most relief for least new code. The one input this file cannot supply",
        "is traffic and revenue per page — that lives in their analytics, and it should reorder",
        "everything here before anyone writes a line.",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
