#!/usr/bin/env python3
"""Define + populate the PRODUCT metafields the buy box reads.

Why metafields here and metaobjects for science claims — the rule this repo follows:

  metaobject      -> a standalone content entity, reused across pages (a science claim)
  metafield       -> extra data that belongs to an existing resource (this product's serving
                     count, age range, supplement facts panel)
  section setting -> copy that is genuinely per-page (a variant's headline, its offer badge)

The buy box's product facts were section settings at first. That's wrong at scale: the same
product sells on ~18 behind-the-science LPs, so "30 Servings Per Bottle" would be retyped 18
times and drift. On the product, it's edited once and every LP follows.

Run from repo root with .env loaded.
"""
import json
import os
import urllib.request

API = "2024-10"
PRODUCT_HANDLE = "teens-multivitamin"

DEFS = [
    ("servings_per_bottle", "Servings per bottle", "single_line_text_field", "30 Servings Per Bottle"),
    ("age_range", "Age range note", "single_line_text_field", "This Product is For Teens Ages 13 - 17"),
    ("flavor", "Flavor", "single_line_text_field", "Flavor: 🍊 Orange"),
    ("subtitle", "Funnel subtitle", "single_line_text_field", "Daily Gummies For Improved Motivation & Mood"),
    ("short_description", "Short description", "multi_line_text_field",
     "A unique organic fruit and veggie blend, plus 12 key nutrients."),
]


def gql(query, variables=None):
    store = os.environ["SHOPIFY_FLAG_STORE"]
    req = urllib.request.Request(
        f"https://{store}.myshopify.com/admin/api/{API}/graphql.json",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"X-Shopify-Access-Token": os.environ["SHOPIFY_ADMIN_TOKEN"],
                 "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req))
    if out.get("errors"):
        raise RuntimeError(out["errors"])
    return out["data"]


DEF_CREATE = """
mutation($d: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $d) {
    createdDefinition { id key }
    userErrors { code field message }
  }
}
"""

SET = """
mutation($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key namespace }
    userErrors { field message }
  }
}
"""

PRODUCT_ID = """
query($q: String!) { products(first: 1, query: $q) { nodes { id title } } }
"""


def main():
    for key, name, mtype, _ in DEFS:
        res = gql(DEF_CREATE, {"d": {
            "name": name, "namespace": "custom", "key": key, "type": mtype,
            "ownerType": "PRODUCT",
            # only storefront access is ours to set here: the admin access of an
            # app-owned definition is fixed by the platform (verified empirically —
            # passing access.admin is rejected either way).
            "access": {"storefront": "PUBLIC_READ"},
        }})
        errs = res["metafieldDefinitionCreate"]["userErrors"]
        taken = errs and all(e.get("code") == "TAKEN" for e in errs)
        print(f"def {key}: {'already exists' if taken else ('ERROR ' + str(errs)) if errs else 'created'}")

    pid = gql(PRODUCT_ID, {"q": f"handle:{PRODUCT_HANDLE}"})["products"]["nodes"][0]["id"]
    res = gql(SET, {"metafields": [
        {"ownerId": pid, "namespace": "custom", "key": key, "type": mtype, "value": value}
        for key, _, mtype, value in DEFS
    ]})
    errs = res["metafieldsSet"]["userErrors"]
    print("values:", "ERROR " + str(errs) if errs else f"{len(res['metafieldsSet']['metafields'])} set on {pid}")


if __name__ == "__main__":
    main()
