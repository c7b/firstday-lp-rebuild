#!/usr/bin/env python3
"""Audit First Day landing pages, using a local HTML cache between runs.

Usage: python3 tools/audit_lp_estate.py [--limit N] [--delay SECONDS] [--refresh]
"""
import argparse
import json
import re
import time
import urllib.error
import urllib.request
import zipfile
from collections import Counter
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SITEMAP = Path("/home/lcam/firstday-assignment/inputs/firstday-sitemap.xlsx")
OUT_JSON = ROOT / "docs" / "receipts" / "lp-estate.json"
OUT_MD = ROOT / "docs" / "receipts" / "LP-ESTATE.md"
OUT_GRAPH = ROOT / "docs" / "receipts" / "lp-estate-graph.json"
CACHE = Path("/tmp/lp-estate-cache")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

REFERENCE = "tdk-behind-the-science-lp"
FAMILIES = ("kde", "tdk", "wds", "mcm", "kcm", "trmv", "mdp", "multi", "catalog")
FLAG_PATTERNS = (("one", "month", "free"), ("40", "off"), ("spanish",), ("tt",),
                 ("mystery",), ("gift",), ("sub",), ("alt",), ("old",), ("2",),
                 ("trusted",))
VENDOR_HINTS = {
    "judge.me": "Judge.me reviews", "thefrontrowhealth": "FrontRow MD",
    "klaviyo": "Klaviyo", "attentive": "Attentive", "intelligems": "Intelligems",
    "northbeam": "Northbeam", "gorgias": "Gorgias", "stay.ai": "Stay AI",
    "retextion": "Stay AI", "replo": "Replo", "weglot": "Weglot",
    "opensend": "Opensend", "blotout": "Blotout", "clarity.ms": "MS Clarity",
    "googletagmanager": "GTM", "impact.com": "Impact", "beamimpact": "Beam",
    "pandectes": "Pandectes", "savedby": "SavedBy",
}


def lp_handles():
    """Read the page handles directly from the supplied sitemap workbook."""
    z = zipfile.ZipFile(SITEMAP)
    namespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    out = []
    for row in root.iter(namespace + "row"):
        values = []
        for cell in row.iter(namespace + "c"):
            inline = cell.find(namespace + "is")
            if inline is not None:
                values.append("".join(node.text or "" for node in inline.iter(namespace + "t")))
            else:
                value = cell.find(namespace + "v")
                values.append(value.text if value is not None else "")
        if len(values) > 2 and values[0] == "pages" and values[2].endswith("-lp"):
            out.append(values[2])
    return sorted(set(out))


def fetch(url, tries=3):
    """Fetch one page. A 429 gets an increasing, deliberately conservative backoff."""
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read().decode("utf-8", "replace"), response.status
        except urllib.error.HTTPError as error:
            if error.code == 429:
                retry_after = error.headers.get("Retry-After", "")
                try:
                    retry_after_seconds = float(retry_after)
                except ValueError:
                    retry_after_seconds = 0
                time.sleep(max(20 * (attempt + 1), retry_after_seconds))
                continue
            return "", error.code
        except Exception:
            if attempt < tries - 1:
                time.sleep(5)
    return "", 0


def parse_family(handle):
    """Split a systematic LP handle into its product family, funnel, and offer modifiers."""
    stem = handle[:-3] if handle.endswith("-lp") else handle
    tokens = stem.split("-")
    family = tokens.pop(0) if tokens and tokens[0] in FAMILIES else "unknown"
    flags, funnel_tokens = [], []
    index = 0
    while index < len(tokens):
        matched = next((pattern for pattern in FLAG_PATTERNS
                        if tuple(tokens[index:index + len(pattern)]) == pattern), None)
        if matched:
            flags.append("-".join(matched))
            index += len(matched)
        else:
            funnel_tokens.append(tokens[index])
            index += 1
    return {"family": family, "funnel": "-".join(funnel_tokens) or "unknown", "offer_flags": flags}


def section_inventory(html):
    """Return theme-template and header/footer group IDs, plus empty template sections."""
    ids = re.findall(r"\bid=[\"']shopify-section-([^\"']+)[\"']", html, flags=re.I)
    template = [section_id for section_id in ids if section_id.startswith("template--")]
    # Shopify header/footer groups are emitted as sections--...__header/footer (or group IDs).
    groups = [section_id for section_id in ids if not section_id.startswith("template--")
              and re.search(r"(?:header|footer|group)", section_id, flags=re.I)]
    bounds = [(match.start(), match.group(1)) for match in re.finditer(
        r"\bid=[\"']shopify-section-(template--[^\"']+)[\"']", html, flags=re.I)]
    empty = 0
    for index, (start, _) in enumerate(bounds):
        end = bounds[index + 1][0] if index + 1 < len(bounds) else len(html)
        chunk = html[start:end]
        chunk = re.sub(r"<script.*?</script>|<style.*?</style>", " ", chunk,
                       flags=re.I | re.S)
        text = re.sub(r"<[^>]+>", " ", chunk)
        if len(re.sub(r"\s+", "", text)) < 40:
            empty += 1
    return template, groups, empty


def analyse(html):
    template, groups, empty = section_inventory(html)
    lower_html = html.lower()
    if template:
        build_type = "sections"
    elif "replo" in lower_html:
        build_type = "replo"
    else:
        build_type = "page-body"
    return {
        "bytes": len(html),
        "weight_kb": round(len(html) / 1024, 1),
        "sections": template,
        "template_sections": len(template),
        "group_sections": len(groups),
        "empty_sections": empty,
        "scripts": len(re.findall(r"<script[^>]*\bsrc=", html, flags=re.I)),
        "images": len(re.findall(r"<img\b", html, flags=re.I)),
        "vendors": sorted({name for hint, name in VENDOR_HINTS.items() if hint in lower_html}),
        "build_type": build_type,
    }


def failed_page(status):
    return {
        "status": status, "error": "not fetched", "bytes": 0, "weight_kb": 0,
        "sections": [], "template_sections": 0, "group_sections": 0,
        "empty_sections": 0, "scripts": 0, "images": 0, "vendors": [],
        "build_type": "unknown",
    }


def backlog_for(page):
    """Only add work items when the measured field in evidence supports them."""
    items = []
    if page["empty_sections"]:
        items.append({"id": "drop-empty-sections", "title": "Drop empty sections",
                      "impact": "medium", "effort": "S", "agent": "theme",
                      "evidence": {"empty_sections": page["empty_sections"]}})
    if page["build_type"] == "replo":
        items.append({"id": "migrate-off-page-builder", "title": "Migrate off page builder",
                      "impact": "high", "effort": "L", "agent": "migration",
                      "evidence": {"build_type": "replo"}})
    if page["weight_kb"] > 1500:
        items.append({"id": "reduce-page-weight", "title": "Reduce page weight",
                      "impact": "high", "effort": "M", "agent": "performance",
                      "evidence": {"weight_kb": page["weight_kb"]}})
    if page["scripts"] > 35:
        items.append({"id": "audit-third-party-scripts", "title": "Audit third-party scripts",
                      "impact": "medium", "effort": "M", "agent": "performance",
                      "evidence": {"scripts": page["scripts"]}})
    if page["overlap_pct"] >= 60:
        items.append({"id": "migrate-to-shared-sections", "title": "Migrate to shared sections",
                      "impact": "high", "effort": "S", "agent": "theme",
                      "evidence": {"overlap_pct": page["overlap_pct"]}})
    return items


def graph_nodes(results):
    nodes = []
    for handle, page in results.items():
        nodes.append({key: page[key] for key in (
            "handle", "url", "family", "funnel", "offer_flags", "build_type", "weight_kb",
            "template_sections", "empty_sections", "scripts", "vendors", "overlap_pct", "backlog")})
    return nodes


def graph_edges(results):
    """Create semantic edges and one section-sharing edge for each materially related pair."""
    edges = []
    for left_handle, right_handle in combinations(sorted(results), 2):
        left, right = results[left_handle], results[right_handle]
        if left["funnel"] != "unknown" and left["funnel"] == right["funnel"]:
            edges.append({"from": left_handle, "to": right_handle, "type": "same-funnel", "weight": 1})
        if left["family"] != "unknown" and left["family"] == right["family"]:
            edges.append({"from": left_handle, "to": right_handle, "type": "same-family", "weight": 1})
        shared = len(set(left["sections"]) & set(right["sections"]))
        if shared:
            edges.append({"from": left_handle, "to": right_handle,
                          "type": "shares-sections", "weight": shared})
    return edges


def write_report(results):
    measured = {handle: page for handle, page in results.items() if page["status"] == 200}
    build_types = Counter(page["build_type"] for page in results.values())
    backlog = Counter(item["id"] for page in results.values() for item in page["backlog"])
    total_bytes = sum(page["bytes"] for page in measured.values())
    total_sections = sum(page["template_sections"] for page in measured.values())
    total_empty = sum(page["empty_sections"] for page in measured.values())
    every_section = Counter(section for page in measured.values() for section in page["sections"])
    vendors = Counter(vendor for page in measured.values() for vendor in page["vendors"])
    rows = sorted(measured.items(), key=lambda item: -item[1]["bytes"])

    lines = [
        "# LP estate audit", "",
        "Pages were measured sequentially; fetched HTML is cached in `/tmp/lp-estate-cache` for repeatable analysis.",
        "", f"**{len(measured)} of {len(results)} pages fetched successfully.** Raw data: `lp-estate.json`.",
        "", "## Build types", "", "| Build type | Pages |", "|---|---|",
    ]
    for build_type in ("sections", "replo", "page-body", "unknown"):
        lines.append(f"| {build_type} | {build_types[build_type]} |")
    lines += [
        "", "## Estate totals", "", "| Metric | Value |", "|---|---|",
        f"| HTML shipped | {total_bytes / 1024 / 1024:.1f} MB |",
        f"| Average fetched page | {total_bytes / max(1, len(measured)) / 1024:.0f} KB |",
        f"| Template section instances | {total_sections} |",
        f"| Header/footer group sections | {sum(page['group_sections'] for page in measured.values())} |",
        f"| Empty template sections | {total_empty} |",
        "", "## Backlog totals", "", "| Item | Pages |", "|---|---|",
    ]
    if backlog:
        for item_id, count in backlog.most_common():
            lines.append(f"| `{item_id}` | {count} |")
    else:
        lines.append("| None | 0 |")
    lines += [
        "", "## Heaviest pages", "", "| Page | Build type | Weight | Template sections | Empty | Scripts | Reference overlap |",
        "|---|---|---|---|---|---|---|",
    ]
    for handle, page in rows[:20]:
        lines.append(f"| `{handle}` | {page['build_type']} | {page['weight_kb']:.1f} KB | "
                     f"{page['template_sections']} | {page['empty_sections']} | {page['scripts']} | "
                     f"{page['overlap_pct']}% |")
    lines += ["", "## Most reused template sections", "", "| Section type | Pages using it |", "|---|---|"]
    if every_section:
        for section, count in every_section.most_common(15):
            lines.append(f"| `{section}` | {count} |")
    else:
        lines.append("| None | 0 |")
    lines += ["", "## Third-party load", "", "| Vendor | Pages |", "|---|---|"]
    if vendors:
        for vendor, count in vendors.most_common():
            lines.append(f"| {vendor} | {count} |")
    else:
        lines.append("| None detected | 0 |")
    OUT_MD.write_text("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--delay", type=float, default=7.0)
    parser.add_argument("--refresh", action="store_true", help="Ignore cached HTML and fetch again.")
    args = parser.parse_args()
    handles = lp_handles()
    if args.limit:
        handles = handles[:args.limit]
    handles = sorted(handles, key=lambda handle: (handle != REFERENCE, handle))
    CACHE.mkdir(parents=True, exist_ok=True)

    results = {}
    for index, handle in enumerate(handles, 1):
        url = f"https://firstday.com/pages/{handle}"
        cache_file = CACHE / f"{handle}.html"
        cached = cache_file.exists() and not args.refresh
        if cached:
            html, status = cache_file.read_text(errors="replace"), 200
        else:
            html, status = fetch(url)
            if html:
                cache_file.write_text(html)
        if html:
            page = analyse(html)
            page["status"] = status
            page["source"] = "cache" if cached else "network"
        else:
            page = failed_page(status)
            page["source"] = "network"
        page.update({"handle": handle, "url": url, **parse_family(handle)})
        results[handle] = page
        print(f"[{index}/{len(handles)}] {handle}: {page['weight_kb']:.1f}KB, "
              f"{page['build_type']}, {page['template_sections']} template / "
              f"{page['group_sections']} group sections, {page['scripts']} scripts"
              f" ({page['source']})")
        if not cached and index < len(handles):
            time.sleep(args.delay)

    reference_sections = set(results.get(REFERENCE, {}).get("sections", []))
    for page in results.values():
        shared = len(set(page["sections"]) & reference_sections)
        page["shared_with_reference"] = shared
        page["overlap_pct"] = round(100 * shared / max(1, len(set(page["sections"]))))
        page["backlog"] = backlog_for(page)

    generated = datetime.now(timezone.utc).isoformat()
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({"generated": generated, "reference": REFERENCE,
                                   "pages": results}, indent=2) + "\n")
    write_report(results)
    OUT_GRAPH.write_text(json.dumps({"generated": generated, "nodes": graph_nodes(results),
                                    "edges": graph_edges(results)}, indent=2) + "\n")
    print(f"\n{OUT_JSON.relative_to(ROOT)}, {OUT_MD.relative_to(ROOT)}, and "
          f"{OUT_GRAPH.relative_to(ROOT)} written")
    print("Build types: " + ", ".join(
        f"{build_type}={count}" for build_type, count in sorted(Counter(
            page["build_type"] for page in results.values()).items())))


if __name__ == "__main__":
    main()
