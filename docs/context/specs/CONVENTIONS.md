# Build conventions — all LP sections

Shared contract for every `lp-*` section in this theme. Section specs reference this file;
deviations require a written reason in the section's spec.

## Files & naming

- One section = `sections/lp-<name>.liquid` + `assets/lp-<name>.css` (+ `assets/lp-<name>.js`
  ONLY if the section genuinely needs JS — most don't).
- CSS loaded via `{{ 'lp-<name>.css' | asset_url | stylesheet_tag }}` at the top of the section.
  JS via `<script src="{{ 'lp-<name>.js' | asset_url }}" defer="defer"></script>`.
- Every class is prefixed `.lp-<name>__` (BEM-ish). No styles may leak outside the section.
  No `!important` unless overriding an inline style you can't remove.

## Copy & content — the #1 rule

- **Copy is transplanted, never authored.** Every visible string comes from
  `docs/context/sections/lp-<name>.json` (extracted from the live page). Do not fix typos, do
  not "improve" wording, do not translate. Emoji are content — keep them.
- Section files stay **generic**: schema `default`s may hold the real copy for convenience, but
  the source of truth for instance content is the template fragment (below).
- Alt text comes from the extraction JSON. Images with empty alt in the original get `alt=""`
  (decorative), not invented descriptions.

## Template fragments

Besides the section, emit `docs/context/template-fragments/<instance>.json` — the exact
`{ "type": "lp-<name>", "settings": {...}, "blocks": {...}, "block_order": [...] }` object for
each instance of this section on the target page, with the real copy/images filled in. These get
merged into `templates/page.tdk-behind-the-science.json` in the template phase. A section used
3× on the page = 3 fragment files.

## Images & video

- Image settings come in pairs: `image` (`type: image_picker`, takes precedence when set) and
  `image_url` (`type: text`, default = the firstday CDN URL from the extraction JSON). Render:
  picker image via `image_tag` with proper `widths`/`sizes`; else plain `<img>` with the URL,
  `loading="lazy"` (except above-the-fold hero media), explicit `width`/`height` when known.
- CDN URLs keep their `?v=` and `&width=` params exactly as extracted.
- Video: `<video>` with the extracted CDN mp4 `src`, `muted playsinline loop autoplay
  preload="metadata"` + `poster`. Wrap autoplay in a `prefers-reduced-motion` check (JS: don't
  autoplay when reduced motion is requested).

## Schema

- Full `{% schema %}`: `name`, `tag: "section"`, `class`, `settings`, `blocks` (with sane
  `limit`s), at least one `preset` so the section is addable in the theme editor.
- Every piece of content an operator might change per-LP-variant is a setting or block — no
  hardcoded copy in Liquid. Use `inline_richtext` for headings with styled spans, `richtext`
  for body copy, `url` for links, `color_scheme` for palette.
- Include a `custom_css`-free design: colors via Dawn color schemes
  (`{% render 'section-color-scheme' %}` pattern — i.e. `class="color-{{ section.settings.color_scheme }}"`),
  spacing via `padding_top`/`padding_bottom` range settings (Dawn convention, 0–100px, step 4).
- Anchor: every section renders `id="{{ section.settings.anchor_id | default: section.id }}"`
  — the original page links between sections with `#standalone-product-section` etc.

## Accessibility & semantics

- One `h2` per section (hero may use `h1`). Accordions = native `<details>/<summary>`.
  Tabs = buttons with `role="tab"`/`aria-selected` + panels `role="tabpanel"`. Buttons that do
  things are `<button>`, navigation is `<a>`.
- Interactive targets ≥44px. Visible focus states. Decorative images `alt=""` + `aria-hidden`
  where appropriate.

## JS

- Vanilla ES6+, no libraries, no globals beyond one custom element or one IIFE per section.
  Prefer CSS-only (scroll-snap carousels, details/summary) before reaching for JS.
- Custom elements follow Dawn's pattern (`class LpX extends HTMLElement` + `customElements.define`).

## Out of scope for every section

- No checkout/cart logic beyond a standard `{% form 'product' %}` add-to-cart.
- No third-party scripts, no app embeds, no tracking.
- Don't touch Dawn's own files (layout, snippets, existing sections/assets) unless the spec
  says so explicitly.

## Mobile

- Mobile-first CSS; the original page is a mobile-heavy ad funnel. Breakpoint: 750px
  (Dawn's convention), `990px` for wide-desktop refinements when needed.
