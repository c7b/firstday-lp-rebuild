# PLAN.md — what didn't fit the timebox, and where this architecture goes

The brief asks for a detailed strategy for anything that ran out of time. Three kinds of items
below: what was cut at the timebox and then delivered afterwards, what is still genuinely open
(with strategy, estimate and a sequence), and the roadmap this architecture was designed for.

## Cut at the timebox, delivered after it

These were on the cut list when the `timebox` tag was placed. They are in the build now, so
the list is corrected rather than left flattering. `git diff timebox..main` is the evidence.

| Item | What shipped |
|---|---|
| **Real subscriptions (selling plans)** | Real `sellingPlanGroup` on the products; the buy box renders `product.selling_plan_groups`, and Monthly resolves to $23.40 from a 40%-off plan rather than a typed number. Adding the plan to the cart is the real selling-plan id. |
| **Image migration to Files** | Zero hotlinks left: 52 images, 4 videos and their posters are served from this store's own CDN via the Files API. Sections take `image_picker` values, so the operator gets a picker instead of a URL field. |
| **Gift progress + upsell add-ons (live cart math)** | Built against the real cart — the progress bar reads `/cart.js` and updates after every add, and upsells post to `/cart/add.js`. Then **switched off deliberately**: on the original both are app-driven, and a gift you cannot claim is theatre. The Liquid still renders them when their settings are filled, so restoring is content, not a deploy. See `ASSUMPTIONS.md`. |

## Still open — strategy, estimate, sequence

| Item | Why it's not in | How I'd do it | Est. |
|---|---|---|---|
| **Review app integration** | Reviews are Judge.me content; the rebuild renders the same UI natively from real extracted data. `lp-reviews` already accepts `@app` blocks, so the socket exists and the app does not | Install Judge.me and drop their app block into the section, or keep the native section and feed it from a metafield the app writes. The choice is theirs: native is faster and app-owned is truthful | ~1h |
| **Overlay dialogs (sale/OTP/upsell)** | Marketing-app overlays, not theme funnel content | Rebuild only if the funnel data says they earn their weight; otherwise leave them to the app that owns them | ~1–2h |
| **FAQ content** | The original's FAQ renders empty on the live page (verified in the rendered DOM) — there is nothing to transplant | `template-fragments/faq.json` is a ready third `lp-media-accordion`; paste real Q&A into blocks when the content exists | ~15min |
| **Video deferral** | The four science videos are the remaining page weight, and they load with the page | Swap the `<video>` sources for `data-src` and attach an `IntersectionObserver` on the tabs; the tab component already knows which panel is active | ~1h |
| **Two ad-carrying pages not in the 44** | The estate crawl defined a landing page as a sitemap handle ending in `-lp`. Two advertised pages do not match that pattern and one is not in the sitemap at all | Widen the crawl to any `/pages/` handle plus the ad-library destinations, and reconcile the two lists. Named in the appendix rather than hidden | ~2h |

**If I had one more day, in this order.** Video deferral first — it is the largest remaining
number on the page and it is an hour. Then the review app decision, because it is a
conversation with them, not a task. Then widen the estate crawl, since it changes what the
migration plan is ranked against. Overlays and FAQ are last: both wait on someone else's
answer, and building them before that answer arrives is how you get work that gets thrown away.

## Two things the brief names that this page deliberately does not do

**Checkout extensions.** The brief lists them as fair game ("can be anything, we use react"),
and the interview drew the opposite line: checkout and cart are off limits. Both are right —
the line is *this page*, and the distinction matters more than it looks:

> A checkout UI extension **cannot live in this repository.** It is not theme code. It ships
> inside an app: React from `@shopify/ui-extensions-react/checkout`, declared in
> `shopify.extension.toml` against a target such as `purchase.checkout.block.render`, built
> with Node and released with `shopify app deploy` — a different artifact, a different
> pipeline, a different review path from the theme's GitHub sync. Putting it here would be the
> wrong answer even if there were time.

Where one would genuinely earn its place is the promise this funnel already makes: **"FREE
Gift on orders +$75"** and the gift progress bar. Today that promise lives in the theme and
nothing carries it past the buy button. The complete shape:

| Piece | What it does | Where it lives |
|---|---|---|
| Checkout UI extension | shows the same threshold and gift state the LP showed, so the story doesn't break at the handoff | extension-only app |
| Shopify Function (cart transform / product discount) | actually adds the gift line at $75 — a UI extension can display, it cannot grant | same app |
| Product metafields | the threshold and gift product, read by both, so marketing changes them once | already modelled here (`custom.*`) |

**Two constraints to settle before estimating for real**, and this is exactly the kind of thing
worth surfacing early rather than discovering mid-sprint:

1. **Plan.** Extensions on the *checkout* page require Shopify Plus; the Thank-you and
   Order-status pages are available on every plan. If First Day isn't Plus, the gift reminder
   lands post-purchase, which is a different (still useful) feature — confirm the plan first.
2. **Ownership.** The gift is a promotions decision, not a developer's unilateral call. Whoever
   owns the offer decides whether the gift is a discount, a free line item, or an app's job.

Estimate once those are answered: ~1 day for the UI extension plus the function, plus review.
Until then it stays here rather than half-built in the theme.

**The quiz.** The brief says "the quiz needs to route all of these cleanly" — it isn't on this
page, but the same routing question is: the Toddlers/Kids/Teens tabs are the funnel-level
version of it. Right now the tabs carry their product as a block setting. The scalable shape is
one segment model — product line × age band — that both the quiz and these tabs read from, so
adding a segment doesn't mean editing links in 18 templates. That model is a metaobject
(`segment`) with the product reference on it; the tabs become "render the segments for this
product line". Half a day, and it's the prerequisite for the quiz work rather than a detour.

## The real roadmap: the variant factory (why the architecture looks like this)

Two counts appear in this repo and both are correct, so here is the difference before anyone
finds it. **44** handles end in exactly `-lp`; that is the set the estate crawl measured and
every number in the appendix refers to. **60** handles contain `-lp` anywhere, and **18** of
those are behind-the-science variants.

The 16 in the gap are the argument for this whole architecture, because of what they are named:

```
kde-behind-the-science-lp-40-off          kde-behind-the-science-lp-mystery
kde-behind-the-science-lp-gift-for-life   kde-behind-the-science-lp-one-month-free
kde-behind-the-science-lp-tt              kde-behind-the-science-lp-one-month-free-sub
```

Those are not different pages. They are **one page with a different offer**, hand-cloned six
times — and each clone is a Replo export that has to be rebuilt by hand when the brand, the
claims or the compliance line changes. With this architecture each is a template JSON with one
or two overrides. A new variant is:

1. **New template JSON** (`page.kde-behind-the-science-40-off.json`) — assembled by
   `tools/build_template.py` from fragments; no Liquid is written.
2. **Content entries** — `science_claim` metaobjects picked by handle (`product_scope` field
   already tags kde/tdk/wds/mcm); per-variant copy edited in the theme editor by whoever owns
   the funnel — CRO manager, not developer.
3. **A page** pointing at the template.

Next steps to make that fully self-serve, in order:

- **Sheet → variants pipeline (~half a day):** a Google Sheet (or CSV in the repo) with one
  row per variant (product, offer, headline overrides, metaobject handles) that a script turns
  into template JSON + metaobject entries + pages via Admin API. The seeding and assembly
  scripts in `tools/` are already the two halves of this; the sheet is the missing front-end.
  Marketing requests a variant by adding a row.
- **Spanish variants via the same pipeline (~half a day):** the sitemap shows `-spanish-lp`
  clones. Model translations as locale columns in the same sheet (or metaobject fields per
  locale) instead of separate hand-built pages. Worth checking how much of the current
  translation app's scope this quietly replaces.
- **Copy generation with guardrails (opt-in, later):** with claims in metaobjects and brand
  voice documented, drafting variant copy becomes an AI task with a human approval gate —
  drafts land as `draft` metaobject entries, a human publishes. One line here because it's
  roadmap, not scope: the structure is what makes it safe to do at all.

## How this process scales to the full site rebuild

This assignment ran as: deterministic extraction → per-section specs → parallel builder agents
→ cross-model review → automated gates → platform-validated deploy via the GitHub integration
(the same pipeline First Day production already uses). The full rebuild is the same loop with
a bigger inventory: audit the theme's sections, rank by traffic/revenue exposure, and migrate
page-type by page-type behind the existing GitHub sync — phased, never big-bang, each phase
shippable and reversible. The 3-4 hours here are the pilot of exactly that machine.

## Ecosystem note

firstday.com already serves **`/agents.md`** and an agentic-discovery entry in its sitemap —
the site is positioning for AI-agent commerce. Two cheap, high-signal follow-ups: keep
`agents.md` in sync with the real funnel URLs (the 60-LP list is exactly what an agent needs),
and consider the structured-data story on these LPs (product JSON-LD on funnel pages is thin
today). Native metaobject-backed content also sets up clean structured answers for
answer-engine traffic — the same single-source-of-truth argument, pointed outward.
