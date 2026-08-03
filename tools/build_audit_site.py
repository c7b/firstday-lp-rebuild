#!/usr/bin/env python3
"""Assemble every measurement into one deployable page: dist/index.html

Nothing here computes anything new — it reads the receipts the audit tools already wrote and
lays them out so a person can see the estate rather than read about it. Full lists, not
summaries: every page, every product, every vendor, with its URL.

Run: python3 tools/build_audit_site.py  →  dist/index.html (self-contained)
"""
import base64
import json
import re
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R = ROOT / "docs" / "receipts"
DIST = ROOT / "dist"
ICONS = Path("/tmp/vendor-icons")

# vendor → (category, homepage for the favicon)
VENDOR_META = {
    "Judge.me": ("reviews", "judge.me"),
    "FrontRow MD": ("reviews", "thefrontrowhealth.com"),
    "Klaviyo": ("email", "klaviyo.com"),
    "Attentive": ("sms", "attentivemobile.com"),
    "Postscript": ("sms", "postscript.io"),
    "Intelligems": ("testing", "intelligems.io"),
    "Northbeam": ("analytics", "northbeam.io"),
    "Gorgias": ("support", "gorgias.com"),
    "Stay AI": ("subscriptions", "stay.ai"),
    "Replo": ("page builder", "replo.app"),
    "Weglot": ("translation", "weglot.com"),
    "Opensend": ("analytics", "opensend.com"),
    "Blotout EdgeTag": ("analytics", "blotout.io"),
    "Microsoft Clarity": ("analytics", "clarity.microsoft.com"),
    "Google Tag Manager": ("tag manager", "tagmanager.google.com"),
    "Google Analytics": ("analytics", "analytics.google.com"),
    "Impact.com": ("affiliates", "impact.com"),
    "Beam": ("donations", "beamimpact.com"),
    "Pandectes": ("consent", "pandectes.io"),
    "SavedBy": ("shipping", "savedby.io"),
    "CartHook": ("upsell", "carthook.com"),
    "Rebuy": ("recommendations", "rebuyengine.com"),
    "Meta pixel": ("pixel", "facebook.com"),
    "TikTok pixel": ("pixel", "tiktok.com"),
    "Pinterest tag": ("pixel", "pinterest.com"),
    "LinkedIn Insight": ("pixel", "linkedin.com"),
    "Microsoft Ads": ("pixel", "ads.microsoft.com"),
    "Shopify native": ("platform", "shopify.com"),
    "Recharge": ("subscriptions", "rechargepayments.com"),
    "Loop": ("returns", "loopreturns.com"),
    "Zendesk": ("support", "zendesk.com"),
    "Okendo": ("reviews", "okendo.io"),
    "Yotpo": ("reviews", "yotpo.com"),
}


def favicon(domain):
    """Fetch once, cache, inline as a data URI so the page needs no network."""
    ICONS.mkdir(exist_ok=True)
    cached = ICONS / f"{domain}.b64"
    if cached.exists():
        return cached.read_text() or None
    url = f"https://www.google.com/s2/favicons?domain={domain}&sz=64"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        if len(data) < 60:
            cached.write_text("")
            return None
        uri = "data:image/png;base64," + base64.b64encode(data).decode()
        cached.write_text(uri)
        return uri
    except Exception:
        cached.write_text("")
        return None


def load(name, default=None):
    p = R / name
    return json.loads(p.read_text()) if p.exists() else (default if default is not None else {})


def products():
    """Re-read the live catalogue so every SKU carries its real URL and price."""
    cache = Path("/tmp/fd-products.json")
    if cache.exists():
        return json.loads(cache.read_text())
    out = []
    for page in range(1, 4):
        try:
            req = urllib.request.Request(
                f"https://firstday.com/products.json?limit=250&page={page}",
                headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=40) as r:
                batch = json.load(r).get("products", [])
        except Exception:
            break
        if not batch:
            break
        out.extend(batch)
    cache.write_text(json.dumps(out))
    return out


def main():
    graph = load("lp-estate-graph.json", {"nodes": [], "edges": []})
    intel = load("company-intel.json")
    ads = load("ad-destinations.json", {"destinations": []})

    nodes = graph.get("nodes", [])
    ad_by_handle = defaultdict(int)
    for d in ads.get("destinations", []):
        if d.get("handle"):
            ad_by_handle[d["handle"]] += d["occurrences"]
    for n in nodes:
        n["ad_occurrences"] = ad_by_handle.get(n["handle"], 0)
        n["advertised"] = n["ad_occurrences"] > 0
        n["migrated"] = n["handle"] in {"tdk-behind-the-science-lp", "kde-behind-the-science-lp"}

    # vendors, with a real icon and a category
    vendors = []
    for v in intel.get("tech_stack", {}).get("vendors", []):
        cat, domain = VENDOR_META.get(v["vendor"], ("other", None))
        vendors.append({**v, "category": cat, "icon": favicon(domain) if domain else None,
                        "domain": domain})
    vendors.sort(key=lambda v: (v["category"], -v["pages"]))

    # products: everything, flagged
    prods = []
    for p in products():
        v = (p.get("variants") or [{}])[0]
        title = p.get("title", "")
        prods.append({
            "title": title,
            "handle": p.get("handle"),
            "url": f"https://firstday.com/products/{p.get('handle')}",
            "type": p.get("product_type") or "—",
            "price": v.get("price"),
            "compare": v.get("compare_at_price"),
            "variants": len(p.get("variants") or []),
            "published": (p.get("published_at") or "")[:10],
            "is_test": (p.get("product_type") or "") == "Test",
            "is_bundle": bool(re.search(r"bundle|kit|pack|duo|trio|family|set\b", title, re.I)),
            "tags": (p.get("tags") or [])[:6],
        })

    payload = {
        "nodes": nodes,
        "edges": graph.get("edges", []),
        "vendors": vendors,
        "products": prods,
        "ads": ads.get("destinations", []),
        "sitemap": intel.get("sitemap", {}),
        "collections": intel.get("collections", {}).get("items", []),
        "generated": intel.get("generated", ""),
    }

    stats = {
        "pages": len(nodes),
        "replo": sum(1 for n in nodes if n["build_type"] == "replo"),
        "sections": sum(1 for n in nodes if n["build_type"] == "sections"),
        "mb": round(sum(n["weight_kb"] for n in nodes) / 1024),
        "advertised": sum(1 for n in nodes if n["advertised"]),
        "vendors": len(vendors),
        "products": len(prods),
        "tests": sum(1 for p in prods if p["is_test"]),
        "bundles": sum(1 for p in prods if p["is_bundle"]),
        "urls": intel.get("sitemap", {}).get("total_urls", 0),
        "stale": intel.get("sitemap", {}).get("not_touched_since_2025", 0),
        "backlog": sum(len(n.get("backlog", [])) for n in nodes),
        "pct_sections": (ads.get("totals", {}) or {}).get("pct_lp_links_to_sections_pages", 0),
    }

    html = (ROOT / "tools" / "audit_site_template.html").read_text()
    html = html.replace("__DATA__", json.dumps(payload, separators=(",", ":"), ensure_ascii=False))
    html = html.replace("__STATS__", json.dumps(stats))
    DIST.mkdir(exist_ok=True)
    (DIST / "index.html").write_text(html, encoding="utf-8")

    # Keep this out of search results. The meta tag in the template covers a rendered page;
    # these two cover everything else — a crawler that never renders, and one that only reads
    # robots.txt. The page is public because a link is the simplest way to hand it over, not
    # because it should be findable by someone who was not handed one.
    (DIST / "_headers").write_text(
        "/*\n  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet\n", encoding="utf-8")
    (DIST / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
    print(f"wrote dist/index.html — {stats['pages']} pages, {stats['vendors']} vendors, "
          f"{stats['products']} products, {len(payload['ads'])} ad destinations")
    print(f"  size: {(DIST / 'index.html').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
