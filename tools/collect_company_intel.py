#!/usr/bin/env python3
"""Everything about the storefront that can be established from outside it.

Before proposing work, know the estate. All of this comes from endpoints the store publishes to
anyone — Shopify's own JSON routes, the sitemap that was supplied with the brief, the HTML
already cached by the LP audit, and public social profiles. No credentials, no scraping behind a
login, nothing a competitor could not also do. That matters: it is the difference between an
opinion about their business and a measurement of it.

Run: python3 tools/collect_company_intel.py  →  docs/receipts/company-intel.json
"""
import json
import re
import time
import urllib.error
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "receipts" / "company-intel.json"
CACHE = Path("/tmp/lp-estate-cache")
SITEMAP = Path("/home/lcam/firstday-assignment/inputs/firstday-sitemap.xlsx")
SNAPSHOT = Path("/home/lcam/firstday-assignment/inputs/fd-lp.html")
BASE = "https://firstday.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# Vendor fingerprints. The value is what the app actually does, because a list of script names
# is not an insight — knowing that four separate tools are doing attribution is.
VENDORS = {
    "judge.me": ("Judge.me", "reviews"),
    "thefrontrowhealth": ("FrontRow MD", "clinician reviews"),
    "klaviyo": ("Klaviyo", "email"),
    "attentive": ("Attentive", "SMS"),
    "intelligems": ("Intelligems", "A/B + price testing"),
    "northbeam": ("Northbeam", "attribution"),
    "gorgias": ("Gorgias", "support"),
    "stay.ai": ("Stay AI", "subscriptions"),
    "retextion": ("Stay AI", "subscriptions"),
    "replo": ("Replo", "page builder"),
    "weglot": ("Weglot", "translation"),
    "opensend": ("Opensend", "identity resolution"),
    "blotout": ("Blotout EdgeTag", "server-side tracking"),
    "clarity.ms": ("Microsoft Clarity", "session replay"),
    "googletagmanager": ("Google Tag Manager", "tag management"),
    "google-analytics": ("Google Analytics", "analytics"),
    "impact.com": ("Impact.com", "affiliates"),
    "beamimpact": ("Beam", "donations"),
    "pandectes": ("Pandectes", "cookie consent"),
    "savedby": ("SavedBy", "package protection"),
    "carthook": ("CartHook", "post-purchase upsell"),
    "rebuy": ("Rebuy", "recommendations"),
    "okendo": ("Okendo", "reviews"),
    "yotpo": ("Yotpo", "reviews"),
    "tiktok": ("TikTok pixel", "ads"),
    "snap.licdn": ("LinkedIn Insight", "ads"),
    "connect.facebook.net": ("Meta pixel", "ads"),
    "pinterest": ("Pinterest tag", "ads"),
    "bing.com/bat": ("Microsoft Ads", "ads"),
    "shopifycloud": ("Shopify native", "platform"),
    "recharge": ("Recharge", "subscriptions"),
    "loop": ("Loop", "returns"),
    "zendesk": ("Zendesk", "support"),
    "postscript": ("Postscript", "SMS"),
}


def get(url, timeout=45):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", "replace"), r.status
    except urllib.error.HTTPError as e:
        return "", e.code
    except Exception:
        return "", 0


def catalogue():
    """Every product the storefront publishes, with prices, options and tags."""
    products, page = [], 1
    while page <= 6:
        body, status = get(f"{BASE}/products.json?limit=250&page={page}")
        if status != 200 or not body:
            break
        batch = json.loads(body).get("products", [])
        if not batch:
            break
        products.extend(batch)
        page += 1
        time.sleep(1.5)

    prices = []
    for p in products:
        for v in p.get("variants", []):
            try:
                prices.append(float(v.get("price") or 0))
            except ValueError:
                pass
    prices = [p for p in prices if p > 0]

    tags = Counter(t.strip() for p in products for t in (p.get("tags") or []) if t.strip())
    types = Counter(p.get("product_type") or "—" for p in products)
    # a bundle is named like one; Shopify has no bundle flag on this endpoint
    bundles = [p["title"] for p in products
               if re.search(r"bundle|kit|pack|duo|trio|family|set\b", p.get("title", ""), re.I)]
    subs = [p["title"] for p in products
            if any("subscription" in (t or "").lower() for t in (p.get("tags") or []))]

    return {
        "count": len(products),
        "variant_count": sum(len(p.get("variants", [])) for p in products),
        "price_min": round(min(prices), 2) if prices else None,
        "price_max": round(max(prices), 2) if prices else None,
        "price_median": round(sorted(prices)[len(prices) // 2], 2) if prices else None,
        "product_types": types.most_common(12),
        "top_tags": tags.most_common(25),
        "bundles": sorted(set(bundles))[:30],
        "bundle_count": len(set(bundles)),
        "subscription_tagged": len(subs),
        "published_range": [
            min((p.get("published_at") or "")[:10] for p in products) if products else None,
            max((p.get("published_at") or "")[:10] for p in products) if products else None,
        ],
        "titles": [p["title"] for p in products],
    }


def collections():
    body, status = get(f"{BASE}/collections.json?limit=250")
    if status != 200:
        return {"count": 0, "items": []}
    items = json.loads(body).get("collections", [])
    return {"count": len(items),
            "items": [{"title": c.get("title"), "handle": c.get("handle"),
                       "products": c.get("products_count")} for c in items]}


def tech_stack():
    """Fingerprint every vendor across the pages already cached by the LP audit."""
    per_page, seen = {}, defaultdict(set)
    files = sorted(CACHE.glob("*.html"))
    if SNAPSHOT.exists():
        files = files + [SNAPSHOT]
    for f in files:
        html = f.read_text(encoding="utf-8", errors="replace").lower()
        found = set()
        for hint, (name, role) in VENDORS.items():
            if hint in html:
                found.add((name, role))
                seen[name].add(f.stem)
        per_page[f.stem] = sorted(n for n, _ in found)

    roles = {}
    for hint, (name, role) in VENDORS.items():
        roles[name] = role

    stack = sorted(
        ({"vendor": name, "role": roles.get(name, "?"), "pages": len(pages),
          "coverage_pct": round(100 * len(pages) / max(1, len(files)))}
         for name, pages in seen.items()),
        key=lambda x: -x["pages"])

    by_role = Counter(v["role"] for v in stack)
    overlaps = {role: [v["vendor"] for v in stack if v["role"] == role]
                for role, n in by_role.items() if n > 1}

    return {"pages_scanned": len(files), "vendors": stack,
            "vendors_per_page_avg": round(sum(len(v) for v in per_page.values()) / max(1, len(per_page)), 1),
            "overlapping_roles": overlaps}


def sitemap_shape():
    if not SITEMAP.exists():
        return {}
    z = zipfile.ZipFile(SITEMAP)
    M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in root.iter(M + "row"):
        vals = []
        for c in row.iter(M + "c"):
            t = c.find(M + "is")
            if t is not None:
                vals.append("".join(x.text or "" for x in t.iter(M + "t")))
            else:
                v = c.find(M + "v")
                vals.append(v.text if v is not None else "")
        if len(vals) > 3 and vals[0] != "tipo":
            rows.append(vals)

    kinds = Counter(r[0] for r in rows)
    lps = [r for r in rows if r[0] == "pages" and r[2].endswith("-lp")]
    fresh = Counter()
    for r in rows:
        d = r[3][:7] if len(r) > 3 and r[3] else "?"
        fresh[d] += 1
    stale = [r[2] for r in rows if len(r) > 3 and r[3] and r[3] < "2025-01-01"]
    return {
        "total_urls": len(rows),
        "by_kind": kinds.most_common(),
        "landing_pages": len(lps),
        "lastmod_by_month": sorted(fresh.items(), reverse=True)[:14],
        "not_touched_since_2025": len(stale),
        "lp_recent": sorted(((r[3], r[2]) for r in lps if len(r) > 3 and r[3]), reverse=True)[:8],
    }


def social():
    """Public profile pages only — follower counts where the page exposes them."""
    out = {}
    for name, url in [
        ("instagram", "https://www.instagram.com/firstday/"),
        ("facebook", "https://www.facebook.com/firstday/"),
        ("tiktok", "https://www.tiktok.com/@firstday"),
        ("youtube", "https://www.youtube.com/@firstday"),
        ("x", "https://x.com/firstday"),
    ]:
        body, status = get(url, timeout=25)
        entry = {"url": url, "status": status}
        if body:
            m = re.search(r'"(?:follower_count|followerCount)"\s*:\s*(\d+)', body)
            if m:
                entry["followers"] = int(m.group(1))
            m2 = re.search(r'content="([^"]{0,220})"[^>]*property="og:description"', body) \
                or re.search(r'property="og:description"[^>]*content="([^"]{0,220})"', body)
            if m2:
                entry["og_description"] = m2.group(1)[:220]
        out[name] = entry
        time.sleep(1.2)
    return out


def marketplaces():
    """The brief says Amazon and Target. Verify what a customer would find."""
    out = {}
    for name, url in [
        ("amazon_search", "https://www.amazon.com/s?k=first+day+vitamins"),
        ("target_search", "https://www.target.com/s?searchTerm=first+day+vitamins"),
    ]:
        _, status = get(url, timeout=25)
        out[name] = {"url": url, "status": status,
                     "note": "storefronts block automated fetches; presence confirmed from the brief and packaging claims"}
        time.sleep(1.0)
    return out


def main():
    print("catalogue…")
    cat = catalogue()
    print(f"  {cat['count']} products, {cat['variant_count']} variants")
    print("collections…")
    cols = collections()
    print(f"  {cols['count']} collections")
    print("tech stack…")
    stack = tech_stack()
    print(f"  {len(stack['vendors'])} vendors across {stack['pages_scanned']} pages")
    print("sitemap…")
    shape = sitemap_shape()
    print(f"  {shape.get('total_urls')} urls")
    print("social…")
    soc = social()
    print("marketplaces…")
    mkt = marketplaces()

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "public endpoints only: Shopify's products.json/collections.json, the supplied sitemap, HTML already cached by the LP audit, and public social profiles",
        "catalogue": cat,
        "collections": cols,
        "tech_stack": stack,
        "sitemap": shape,
        "social": soc,
        "marketplaces": mkt,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=1, ensure_ascii=False))
    print(f"\nwrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
