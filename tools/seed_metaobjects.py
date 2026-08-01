#!/usr/bin/env python3
"""Seed science_claim metaobject entries from docs/context/metaobjects/science-claims.json.

Idempotent (metaobjectUpsert by handle) — rerunnable for new LP variants. Prints the GIDs to
wire into the template's science-tabs `claims` setting.

Env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_FLAG_STORE (store handle). Run from repo root:
    set -a; source ../.env; set +a; python3 tools/seed_metaobjects.py
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "2024-10"


def html_to_rich_text(html):
    """Shopify rich_text_field wants its JSON AST, not HTML. Handles <p> + <strong> + text."""
    children = []
    for p in re.findall(r"<p>(.*?)</p>", html, re.S):
        runs = []
        for part in re.split(r"(<strong>.*?</strong>)", p):
            if not part:
                continue
            if part.startswith("<strong>"):
                runs.append({"type": "text", "value": re.sub(r"</?strong>", "", part), "bold": True})
            else:
                runs.append({"type": "text", "value": part})
        children.append({"type": "paragraph", "children": runs})
    return json.dumps({"type": "root", "children": children}, ensure_ascii=False)


def absolutize(url):
    return "https:" + url if url.startswith("//") else url


def gql(query, variables):
    store = os.environ["SHOPIFY_FLAG_STORE"]
    req = urllib.request.Request(
        f"https://{store}.myshopify.com/admin/api/{API}/graphql.json",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={
            "X-Shopify-Access-Token": os.environ["SHOPIFY_ADMIN_TOKEN"],
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


UPSERT = """
mutation($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
  metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
    metaobject { id handle }
    userErrors { field message }
  }
}
"""


def main():
    claims = json.loads((ROOT / "docs/context/metaobjects/science-claims.json").read_text())
    gids = []
    for c in claims:
        handle = re.sub(r"[^a-z0-9]+", "-", c["label"].lower()).strip("-")
        fields = [
            {"key": "label", "value": c["label"]},
            {"key": "panel_heading", "value": c["panel_heading"]},
            {"key": "intro", "value": c["intro"]},
            {"key": "bullets", "value": html_to_rich_text(c["bullets"])},
            {"key": "video_url", "value": absolutize(c["video_url"])},
            {"key": "poster_url", "value": absolutize(c["poster_url"])},
            {"key": "product_scope", "value": "tdk"},
        ]
        res = gql(UPSERT, {
            "handle": {"type": "science_claim", "handle": handle},
            "metaobject": {"fields": fields},
        })
        payload = res.get("data", {}).get("metaobjectUpsert") or {}
        errs = payload.get("userErrors") or res.get("errors")
        if errs:
            print(f"FAIL {handle}: {errs}", file=sys.stderr)
            sys.exit(1)
        gid = payload["metaobject"]["id"]
        gids.append((handle, gid))
        print(f"ok {handle}: {gid}")
    print("\nclaims setting value for the template (metaobject_list settings in JSON")
    print("templates resolve by HANDLE — gids come back as an empty list):")
    print(json.dumps([h for h, _ in gids], indent=1))


if __name__ == "__main__":
    main()
