# ARCHITECTURE.md — why this replicates, duplicates, edits and translates easily

The exercise is one landing page. The sitemap says the real problem is **60 of them**, 18
sharing this exact funnel. So the test of this rebuild isn't "does the page look right" — it's
"what does the 19th variant cost?" Everything below exists to make that answer *near zero*.

## The four places content can live, and the question that picks one

| Store it as | The question it answers | Used here for | Who edits it |
|---|---|---|---|
| **Section setting / block** | "is this copy true only for this page?" | headlines, offer badges, CTA labels | CRO / growth, in the theme editor |
| **Product metafield** | "does this fact belong to the product?" | servings per bottle, age range, flavor, funnel subtitle | merchandising, once per product |
| **Metaobject** | "is this a content entity reused across pages?" | `science_claim` ×4, shared by all 18 behind-the-science LPs | content / compliance, once |
| **Theme asset** | "is this design, not content?" | `lp-brand.css` tokens, section CSS/JS | design / dev, once |

The mirror-image mistakes are equally real: per-page copy in metafields forces a developer into
every marketing edit; product facts in section settings get retyped 18 times and drift on the
first pack-size change. Neither layer is "more advanced".

## Replicate: a new variant is data, not code

`templates/page.kde-behind-the-science.json` is a second, live funnel
(`/pages/kde-behind-the-science-lp`) produced by `tools/build_template.py`:

```python
kids = variant(template, {"buy_box": {"settings": {"product": "kids-multivitamin"}}})
```

One override. The buy box then shows the Kids' product name, its serving count, age range and
flavor — because those come from **that product's** metafields, not from the page. No new
Liquid, no new CSS, no new section. Adding the Toddlers' or Spanish variant is the same three
steps in `README.md`.

## Duplicate: every section is generic and addable

All 11 `lp-*` sections ship a full `{% schema %}` with `presets`, so they appear in the theme
editor's "Add section" list for any page — this funnel's sections are the store's section
library, not one page's private markup. `enabled_on` scopes them to the templates where they
make sense.

## Modify: the editor does the work a developer used to do

- **`visible_if`** hides settings that don't apply — the hero's product-only fields disappear
  when the founder layout is selected, the accordion's image fields disappear when media is
  off. A CRO manager isn't reading Liquid to know which of 25 fields matter.
- **Colour schemes** drive neutral surfaces; brand colours are tokens in `lp-brand.css`. The
  hero's highlight colour is a per-instance setting because the original uses brand blue on the
  opening hero and red on the founder story.
- **`@app` blocks** on `lp-reviews` and `lp-clinician-reviews`: when Judge.me or FrontRow MD is
  installed on the real store, their block drops into the section we already built — the stub
  becomes the real widget **without a code change**.
- **Image settings come in pairs** (`image_picker` + URL fallback), so content can move from a
  hotlink to the store's own Files without touching a template.

## Translate: the LP is already localisable

The sitemap contains `-spanish-lp` clones — hand-built duplicates of pages that differ only in
language. That is the most expensive way to translate, and this architecture removes the need:

- **All visible copy lives in translatable resources.** Section settings in JSON templates,
  metaobject entries, and metafields are all first-class translatable content in Shopify —
  Translate & Adapt (or any translation app, or the Admin translations API) can localise the
  entire page without a developer, because nothing is hardcoded in Liquid.
- **Nothing renders language-specific markup.** No `{% if request.locale %}` branches, no
  duplicated sections per language.
- **Schema labels** stay in the theme's locale files pattern used by Dawn, so the editor UI
  itself translates for a Spanish-speaking operator.
- Consequence: a Spanish funnel is *the same template* under a locale, not a 19th cloned page.
  The clone disappears from the maintenance surface entirely.

## Verify: the loop that guards all of it

`tools/section_loop.py` runs analyze → build → verify with an objective gate in the middle:

1. **Analyst (Claude)** reads the original section's extracted content plus our implementation
   and writes machine-checkable acceptance tests to `docs/context/tests/<section>.json`.
2. **Builder (Codex/GPT)** — deliberately a different model — gets the spec and the failing
   assertions and edits only that section.
3. **Runner (Playwright, `tools/qa_interactions.mjs`)** executes the assertions against the
   real rendered page. Counts, copy, `video.currentTime > 0`, horizontal overflow, dead links.
4. **Verifier (Claude)** reads the runner output *and the diff*, so a test can't be satisfied by
   gaming it (deleting content, hiding an element). PASS keeps the round; FAIL explains why in
   the builder's language and loops.

Two models agreeing is still an opinion; `currentTime > 0` is a fact. That's why the runner
sits between them. Logs land in `docs/receipts/loop/`.
