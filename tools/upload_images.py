#!/usr/bin/env python3
"""Migrate hotlinked firstday.com CDN images into THIS store's Files (own CDN).

Why: URL-text settings were a timebox tradeoff; the proper operator experience is the
image_picker. This script makes the store self-contained:

1. Scans every template fragment for firstday.com image URLs.
2. Uploads each via Admin GraphQL `fileCreate` with `originalSource` = the ORIGINAL-RES url
   (width params stripped — Shopify fetches server-side, keeps the source quality).
3. Polls until files are READY, records old→new mapping in docs/context/image-map.json.
4. Rewrites fragments: where the schema has an image_picker paired with the *_url setting,
   the picker gets `shopify://shop_images/<filename>` (picker wins in Liquid); the *_url
   value is then replaced with our own CDN url as belt-and-braces fallback.

Idempotent: filenames repeat → fileCreate dedupes are handled by reusing the existing map.
Run from repo root with .env loaded. AVIF sources are uploaded as-is; if Shopify rejects a
format it's logged and that URL keeps the (now self-hosted-preferred) fallback chain.
"""
import json
import os
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAG = ROOT / "docs" / "context" / "template-fragments"
MAP_PATH = ROOT / "docs" / "context" / "image-map.json"
API = "2024-10"

IMG_RE = re.compile(r"^(?:https?:)?//firstday\.com/cdn/shop/[^\s\"']+\.(?:png|jpe?g|gif|webp|avif|svg)(\?[^\s\"']*)?$", re.I)


def gql(query, variables=None):
    store = os.environ["SHOPIFY_FLAG_STORE"]
    req = urllib.request.Request(
        f"https://{store}.myshopify.com/admin/api/{API}/graphql.json",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"X-Shopify-Access-Token": os.environ["SHOPIFY_ADMIN_TOKEN"],
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        out = json.load(r)
    if out.get("errors"):
        raise RuntimeError(out["errors"])
    return out["data"]


FILE_CREATE = """
mutation($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files { id fileStatus ... on MediaImage { image { url } } }
    userErrors { field message }
  }
}
"""

FILE_QUERY = """
query($ids: [ID!]!) {
  nodes(ids: $ids) { id ... on MediaImage { fileStatus image { url } } }
}
"""


def collect_urls():
    urls = {}
    for f in sorted(FRAG.glob("*.json")):
        frag = json.loads(f.read_text())
        def walk(obj):
            if isinstance(obj, dict):
                for v in obj.values():
                    walk(v)
            elif isinstance(obj, list):
                for v in obj:
                    walk(v)
            elif isinstance(obj, str) and IMG_RE.match(obj.strip()):
                urls.setdefault(obj.strip(), []).append(f.name)
        walk(frag)
    return urls


def source_fullres(url):
    u = "https:" + url if url.startswith("//") else url
    # strip width/height resize params, keep the version param
    u = re.sub(r"[&?](width|height)=\d+", "", u)
    if "?" not in u and "&" in u:
        u = u.replace("&", "?", 1)
    return u


def main():
    prev = json.loads(MAP_PATH.read_text()) if MAP_PATH.exists() else {}
    urls = collect_urls()
    print(f"{len(urls)} unique image urls in fragments")

    pending = {}
    for url in urls:
        if url in prev and prev[url].get("cdn_url"):
            continue
        src = source_fullres(url)
        try:
            data = gql(FILE_CREATE, {"files": [{
                "originalSource": src,
                "contentType": "IMAGE",
                "alt": "",
            }]})
            fc = data["fileCreate"]
            if fc["userErrors"]:
                print(f"ERR {url}: {fc['userErrors']}")
                prev[url] = {"error": str(fc["userErrors"])}
                continue
            fid = fc["files"][0]["id"]
            pending[url] = fid
            print(f"up  {src.rsplit('/',1)[-1][:60]}")
        except Exception as e:
            print(f"ERR {url}: {e}")
            prev[url] = {"error": str(e)}
        time.sleep(0.3)

    # poll until ready
    for attempt in range(30):
        if not pending:
            break
        data = gql(FILE_QUERY, {"ids": list(pending.values())})
        still = {}
        for node in data["nodes"]:
            if not node:
                continue
            url = next(u for u, i in pending.items() if i == node["id"])
            if node["fileStatus"] == "READY" and node.get("image"):
                cdn = node["image"]["url"]
                fname = cdn.split("/")[-1].split("?")[0]
                prev[url] = {"cdn_url": cdn, "file_id": node["id"],
                             "shopify_ref": f"shopify://shop_images/{fname}"}
            elif node["fileStatus"] == "FAILED":
                prev[url] = {"error": "processing FAILED (format unsupported?)"}
            else:
                still[url] = node["id"]
        pending = still
        if pending:
            time.sleep(4)
    for url, fid in pending.items():
        prev[url] = {"error": f"timeout waiting for {fid}"}

    MAP_PATH.write_text(json.dumps(prev, indent=1, ensure_ascii=False))
    ok = sum(1 for v in prev.values() if v.get("cdn_url"))
    print(f"map saved: {ok} ready, {len(prev)-ok} failed — docs/context/image-map.json")


if __name__ == "__main__":
    main()
