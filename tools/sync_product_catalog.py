#!/usr/bin/env python3
"""Synchronize the three age products used by the in-place LP buy box.

The source storefront changes the whole product context when an age tab is clicked.  This
development store originally had placeholder products with no media, so every product fell
back to the Teens section blocks.  This script imports the reference gallery as real Shopify
product media and stores the extracted product copy/benefits on each product.

Idempotent: existing gallery items are recognized by their stable alt marker and metafields
are upserted. Run from the repository root with ../.env loaded.
"""
import json
import os
import time
import urllib.request

API = "2025-10"

PRODUCTS = {
    "toddlers-multivitamin": {
        "title": 'The "No Junk"™ Toddlers\' Multi',
        "source_handle": "the-no-junk-toddlers-multivitamin",
        "source_product_id": 7331745267810,
        "source_variant_id": 41869557334114,
        "subtitle": "Yummy Gummies For Supported Growth & Development",
        "description": (
            "Worried about your toddler’s eating habits? Meet the toddler multivitamin "
            "that’s giving little ones a nutrition boost! Made with 10 nutrients and a "
            "blend of 21 organic superfoods in a formula designed just for 2 & 3 year olds."
        ),
        "flavor": "Flavor: 🍓 Strawberry & 🍊 Orange",
        "age_range": "This Product is For Toddlers Ages 2 - 3",
        "images": [
            "https://firstday.com/cdn/shop/files/toddler-clean-label-badge.jpg?v=1775089140&width=1200",
            "https://firstday.com/cdn/shop/files/trmv_3_-_Gummies_Nutrients_-_Toddlers_Multi_result.webp?v=1785441420&width=1200",
            "https://firstday.com/cdn/shop/files/trmv_4_-_Ingredients_-_Toddlers_Multi_result.webp?v=1785441426&width=1200",
            "https://firstday.com/cdn/shop/files/ingredients-trmv.webp?v=1785441437&width=1200",
            "https://firstday.com/cdn/shop/files/trmv_6_-_Benefits_-_Toddlers_Multi_result.webp?v=1785441444&width=1200",
            "https://firstday.com/cdn/shop/files/trmv_7_-_Why_First_Day_-_Toddlers_Multi_result.webp?v=1785441450&width=1200",
            "https://firstday.com/cdn/shop/files/trmv_8_-_Social_Proof_-_Toddlers_Multi_result.webp?v=1785441461&width=1200",
            "https://firstday.com/cdn/shop/files/trmv_9_-_Nutrition_-_Toddlers_Multi_result.webp?v=1785441468&width=1200",
            "https://firstday.com/cdn/shop/files/trmv_2_-_Lifestyle_Image_-_Toddlers_Multi_result.webp?v=1785441475&width=1200",
            "https://firstday.com/cdn/shop/files/trmv_10_-_Back_Panel_-_Toddlers_Multi_result.webp?v=1785441482&width=1200",
        ],
        "benefits": [
            {"icon": "immunity", "title": "Enhanced Nutrition & Immunity", "stat": "95%", "text": "of parents say First Day vitamins support their child's overall health & immunity.†"},
            {"icon": "behavior", "title": "Improved Behavior", "stat": "83%", "text": "of customers say First Day vitamins support their child's overall mood & behavior.†"},
            {"icon": "sleep", "title": "Better Sleep Routines", "stat": "82%", "text": "said these vitamins are improving their child's overall bedtime routines & sleep quality.†"},
        ],
    },
    "kids-multivitamin": {
        "title": 'The "No Junk"™ Kids’ Multi',
        "source_handle": "kids-enrichment-vitamin",
        "source_product_id": 4526304198754,
        "source_variant_id": 32050881855586,
        "subtitle": "Daily Gummies For Improved Mood & Behavior",
        "description": "Deliciously nutritious daily multivitamin gummies packed with 21 organic superfoods and 9 essential vitamins.",
        "flavor": "Flavor: 🍓 Strawberry & 🍊 Orange",
        "age_range": "This Product is For Kids Ages 4 - 12",
        "images": [
            "https://firstday.com/cdn/shop/files/KDE-CLEAN-LABEL-FRONT-ROW.jpg?v=1784659630&width=1200",
            "https://firstday.com/cdn/shop/files/kde_3_-_Gummies_Nutrients_-_Kids_Multi_result.webp?v=1785441534&width=1200",
            "https://firstday.com/cdn/shop/files/ingredients-kde.webp?v=1785440913&width=1200",
            "https://firstday.com/cdn/shop/files/kde_6_-_Benefits_-_Kids_Multi_result.webp?v=1785441541&width=1200",
            "https://firstday.com/cdn/shop/files/kde_9_-_Nutrition_-_Kids_Multi_result.webp?v=1785441546&width=1200",
            "https://firstday.com/cdn/shop/files/kde-facts.webp?v=1785440901&width=1200",
            "https://firstday.com/cdn/shop/files/kde_7_-_Why_First_Day_-_Kids_Multi_result.webp?v=1785441554&width=1200",
            "https://firstday.com/cdn/shop/files/kde_8_-_Social_Proof_-_Kids_Multi_result.webp?v=1785441558&width=1200",
            "https://firstday.com/cdn/shop/files/kde_2_-_Lifestyle_Image_-_Kids_Multi_result.webp?v=1785441565&width=1200",
            "https://firstday.com/cdn/shop/files/10_-_Back_Panel_-_Kids_Multi_result.webp?v=1785440735&width=1200",
        ],
        "benefits": [
            {"icon": "immunity", "title": "Enhanced Nutrition & Immunity", "stat": "95%", "text": "of parents say First Day vitamins support their child's overall health & immunity.†"},
            {"icon": "behavior", "title": "Improved Behavior", "stat": "83%", "text": "of customers say First Day vitamins support their child's overall mood & behavior.†"},
            {"icon": "sleep", "title": "Better Sleep Routines", "stat": "82%", "text": "said these vitamins are improving their child's overall bedtime routines & sleep quality.†"},
        ],
    },
    "teens-multivitamin": {
        "title": 'The "No Junk"™ Teens’ Multi',
        "source_handle": "teens-kickstart-vitamin",
        "source_product_id": 6610526765154,
        "source_variant_id": 39463608516706,
        "subtitle": "Daily Gummies For Improved Motivation & Mood",
        "description": "A unique organic fruit and veggie blend, plus 12 key nutrients.",
        "flavor": "Flavor: 🍊 Orange",
        "age_range": "This Product is For Teens Ages 13 - 17",
        "images": [
            "https://firstday.com/cdn/shop/files/Teens_-_Multi_4963136b-8099-4d15-b592-15a9eb50d0b6.jpg?v=1781036994&width=1200",
            "https://firstday.com/cdn/shop/files/tdk_3_-_Gummies_Nutrients_-_Teens_Multi_result.webp?v=1785441253&width=1200",
            "https://firstday.com/cdn/shop/files/ingredients-tdk.webp?v=1785441244&width=1200",
            "https://firstday.com/cdn/shop/files/tdk_6_-_Benefits_-_Teens_Multi_result.webp?v=1785441225&width=1200",
            "https://firstday.com/cdn/shop/files/tdk_7_-_Why_First_Day_-_Teens_Multi_result.webp?v=1785441231&width=1200",
            "https://firstday.com/cdn/shop/files/tdk_8_-_Social_Proof_result.webp?v=1785441180&width=1200",
            "https://firstday.com/cdn/shop/files/tdk_9_-_Nutrition_-_Teens_Multi_result.webp?v=1785441188&width=1200",
            "https://firstday.com/cdn/shop/files/tdk_facts.webp?v=1785441199&width=1200",
            "https://firstday.com/cdn/shop/files/tdk_2_-_Lifestyle_Image_-_Teens_Multi_result.webp?v=1785441610&width=1200",
            "https://firstday.com/cdn/shop/files/tdk_10_-_Back_Panel_-_Teens_Multi_result.webp?v=1785441210&width=1200",
        ],
        "benefits": [
            {"icon": "health", "title": "Improve Overall Health & Nutrition", "stat": "98%", "text": "of parents say First Day vitamins support their teen's overall health & nutrition.†"},
            {"icon": "mood", "title": "Boost Mood & Motivation", "stat": "83%", "text": "of customers say First Day vitamins support their teens' overall mood & behavior, and saw improved motivation for school.†"},
            {"icon": "skin", "title": "Promote Clear Skin", "stat": "75%", "text": "said they saw an improvement to skin health, including reduced acne.†"},
        ],
    },
}


def gql(query, variables=None):
    store = os.environ["SHOPIFY_FLAG_STORE"]
    request = urllib.request.Request(
        f"https://{store}.myshopify.com/admin/api/{API}/graphql.json",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={
            "X-Shopify-Access-Token": os.environ["SHOPIFY_ADMIN_TOKEN"],
            "Content-Type": "application/json",
        },
    )
    output = json.load(urllib.request.urlopen(request))
    if output.get("errors"):
        raise RuntimeError(output["errors"])
    return output["data"]


GET_PRODUCT = """
query($query: String!) {
  products(first: 1, query: $query) {
    nodes {
      id handle title
      options { id name optionValues { id name } }
      variants(first: 1) { nodes { id price } }
      media(first: 50) { nodes { id alt status } }
    }
  }
}
"""

UPDATE_VARIANTS = """
mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id price }
    userErrors { field message }
  }
}
"""

UPDATE_PRODUCT = """
mutation($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title }
    userErrors { field message }
  }
}
"""

UPDATE_OPTION = """
mutation($productId: ID!, $option: OptionUpdateInput!, $values: [OptionValueUpdateInput!]) {
  productOptionUpdate(
    productId: $productId,
    option: $option,
    optionValuesToUpdate: $values
  ) {
    product { id options { id name values } }
    userErrors { field message }
  }
}
"""

SET_METAFIELDS = """
mutation($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key }
    userErrors { field message }
  }
}
"""

CREATE_MEDIA = """
mutation($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media { id alt status }
    mediaUserErrors { field message }
  }
}
"""


def check_errors(label, payload, key="userErrors"):
    errors = payload.get(key) or []
    if errors:
        raise RuntimeError(f"{label}: {errors}")


def sync_product(handle, config):
    nodes = gql(GET_PRODUCT, {"query": f"handle:{handle}"})["products"]["nodes"]
    if not nodes:
        raise RuntimeError(f"Missing product {handle}")
    product = nodes[0]
    product_id = product["id"]
    variant = product["variants"]["nodes"][0]

    updated = gql(UPDATE_PRODUCT, {"input": {"id": product_id, "title": config["title"]}})["productUpdate"]
    check_errors(handle, updated)

    updated = gql(UPDATE_VARIANTS, {
        "productId": product_id,
        "variants": [{"id": variant["id"], "price": "39.00", "compareAtPrice": None}],
    })["productVariantsBulkUpdate"]
    check_errors(handle, updated)

    option = product["options"][0]
    option_value = option["optionValues"][0]
    if option["name"] != "Number of Bottles" or option_value["name"] != "1 Bottle":
        updated = gql(UPDATE_OPTION, {
            "productId": product_id,
            "option": {"id": option["id"], "name": "Number of Bottles"},
            "values": [{"id": option_value["id"], "name": "1 Bottle"}],
        })["productOptionUpdate"]
        check_errors(handle, updated)

    values = {
        "servings_per_bottle": ("single_line_text_field", "30 Servings Per Bottle"),
        "age_range": ("single_line_text_field", config["age_range"]),
        "flavor": ("single_line_text_field", config["flavor"]),
        "subtitle": ("single_line_text_field", config["subtitle"]),
        "short_description": ("multi_line_text_field", config["description"]),
        "benefits": ("json", json.dumps(config["benefits"])),
        "reference_config": ("json", json.dumps({
            "source_handle": config["source_handle"],
            "source_product_id": config["source_product_id"],
            "source_variant_id": config["source_variant_id"],
            "base_price": 39.00,
            "monthly_price": 23.40,
            "one_time_price": 27.30,
            "subscription_discount_percent": 40,
            "source_selling_plan_id": 3896967266,
            "option": {"name": "Number of Bottles", "value": "1 Bottle"},
            "one_time_code": "FIREWORKS",
            "servings_per_bottle": 30,
            "quantities": [1, 2, 3, 4],
            "subscription_savings": [15.80, 31.59, 47.39, 63.18],
            "one_time_savings": [11.70, 23.40, 35.10, 46.80],
        })),
    }
    result = gql(SET_METAFIELDS, {"metafields": [
        {"ownerId": product_id, "namespace": "custom", "key": key, "type": kind, "value": value}
        for key, (kind, value) in values.items()
    ]})["metafieldsSet"]
    check_errors(handle, result)

    existing = {}
    for item in product["media"]["nodes"]:
        existing.setdefault(item.get("alt"), []).append(item.get("status"))
    missing = []
    for index, source in enumerate(config["images"], 1):
        alt = f"LP reference gallery: {handle} {index:02d}"
        # A failed import is not a successful dedupe match: a later run must be able to
        # self-heal it. UPLOADED/PROCESSING are retained so an immediate rerun does not
        # create duplicates while Shopify is still processing the image.
        if not any(status != "FAILED" for status in existing.get(alt, [])):
            missing.append({"originalSource": source, "mediaContentType": "IMAGE", "alt": alt})
    if missing:
        result = gql(CREATE_MEDIA, {"productId": product_id, "media": missing})["productCreateMedia"]
        check_errors(handle, result, "mediaUserErrors")
        time.sleep(1)
    print(f"{handle}: $39.00, {len(config['images']) - len(missing)} existing + {len(missing)} imported media")


def main():
    for handle, config in PRODUCTS.items():
        sync_product(handle, config)


if __name__ == "__main__":
    main()
