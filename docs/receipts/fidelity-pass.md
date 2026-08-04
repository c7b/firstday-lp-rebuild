# Fidelity pass — post-debrief

The panel's one substantive criticism was visual fidelity: font weights, image crops, and
twice, "was that purposeful?". This is the answer, and the shape of the answer matters as much
as the numbers: everything below was **measured**, not eyeballed, and where the measurement
turned out to be wrong that is written down too.

**The delivered page is untouched.** `/pages/tdk-behind-the-science-lp` and its template are
byte-identical to what the panel reviewed — that page is the "before". All corrections live on
a new page, `/pages/tdk-behind-the-science-lp-v2`, whose template loads one extra section
containing every fix. Nothing the reviewed page loads was edited.

---

## How it was measured

Two independent methods, because neither alone was enough — and proving that is one of the
findings.

**`tools/fidelity_audit.mjs`** reads `getComputedStyle` from the reference and from the rebuild
at 1440px and 390px, pairs elements by role rather than selector (the two builds share no class
names), and reports each difference as `property / reference value / our value`. It measures
typography, box properties and geometry, and reports an unresolvable pair as *unmatched* rather
than skipping it, since a comparison that quietly compared nothing is worse than none.

**`tools/fidelity_verify_codex.sh`** hands rendered screenshots of both pages to a different
model family and asks for a designer's acceptance verdict, explicitly ignoring header, footer,
nav and copy. It has no access to this repo or to the first method's output.

**The reference is `inputs/fd-lp.html`**, the page snapshot the brief supplied, served locally.
firstday.com returns `429 local_rate_limited` to this machine, and a reference that can change
between runs is not a reference. The snapshot renders with the real stylesheets from
`cdn.shopify.com` and the real Typekit faces, and cannot drift.

---

## What was found and closed

| Layer | Found | Closed | Open |
|---|---|---|---|
| Typography (properties) | 124 desktop · 121 mobile | all | 0 |
| Layout (geometry) | 42 desktop · 34 mobile | most | see below |
| Independent visual check | 13 desktop · 11 mobile objections | see below | see below |

### The findings that mattered most

**The page was drawing in Poppins.** Our CSS declared `sofia-pro` and the computed
`font-family` matched the reference exactly, so every property check passed — while the browser
resolved the stack down to Poppins and drew every heading in it. The same string measured 415px
wide against the reference's 447px. Fixed by copying the reference's own `@font-face` rules
verbatim, sofia-pro and gelica, roman and italic.

**The heading font was a serif.** `--lp-font-heading` was `gelica`; the reference sets
`sofia-pro` on headings as well as body. One token, five roles.

**The navy was one digit out.** `#2C3E50` against the reference's `#2C3D50`, on nearly every
element. And the correction had to go on the colour scheme's `--color-foreground`, not on our
own token, because that is what the text actually reads.

**The hero crops were swapped.** The reference's 2×2 grid is baked into the image, not built in
CSS. We already had both of its crops and had them the wrong way round — landscape on desktop,
square on mobile. The fix was two values, not a layout.

**The nutrient columns were reversed.** Wheel left and accordion right in the reference; ours
had it backwards. The property audit never compared those two containers to each other, so it
reported no difference at all. Only the visual check caught it.

**The mobile reading order put the proof before the hero.** The reference runs heading →
description → image → CTA → guarantee → proof → testimonial. It gets there by shipping a second
copy of the hero markup and hiding the desktop one; this build uses `order` on a single DOM
instead — same result on screen, one set of content for a screen reader, nothing to keep in
sync when copy changes. **This is a deliberate departure from the reference's implementation
while matching its output.**

**Layout gaps were in the parents, not the children.** Three separate investigations found the
same shape: our rules won their cascade and still never bound, because each element was a block
child of a grid track narrower than its own `max-width`, and `width: auto` simply fills the
track. Fixing the child again could not have worked.

---

## Open, with reasons

| Item | Why it is open |
|---|---|
| Buy-box column x offset (629 vs 668) | Matching both x and width requires the media column's target width, which was not in the measured set. Guessing it would move a number without knowing whether it was right. |
| Residual ~7px gutter offsets | The reference's own container is asymmetric — 129px left against 143px right — so matching x exactly would mean making ours asymmetric too. Recorded rather than forced. |
| Section heights (e.g. tabs panel 412 vs 364) | Heights are consequences of content and spacing, not properties to set. Setting an explicit height would fake the number without fixing the cause. |

---

## Where the measurement was wrong, and how

This is here because a measurement that has been wrong and says so is worth more than one that
has never been checked.

**It measured declarations, not rendering.** The type layer was reported closed while the page
drew in the wrong typeface. Computed `font-family` is what the CSS says, not what the browser
resolved. Fixed by asking `document.fonts` and by measuring rendered text width.

**It compared the wrong elements to each other.** The reference splits styling across a badge
wrapper and a text child; ours is one element. Comparing the full property list against either
alone invented twenty differences that were really "the other element has them".

**It reported five items as impossible that were not.** Four `font-weight: 708` and one
`"Sofia Sans"` family were recorded as unclosable. sofia-pro ships 400/700/800/900, so 708 and
700 draw with the same face — it was an odd declaration to match, not a missing resource. And
`"Sofia Sans"` has no `@font-face` anywhere in the reference and falls through to sofia-pro.

**It measured stale renders, three different ways.** The Asset API was silently overwritten by
the GitHub sync; Shopify's edge varied its page cache by User-Agent; and Chromium pools
connections at the browser level, so retrying inside one process kept reading the same stale
node. The same commit read as 6 differences or 48 depending on which node answered. Fixed by
capturing a render verified against a commit stamp and measuring that file — which also puts
both sides of the comparison on equal footing, since the reference was already a captured file.

**Its guard was too weak twice.** Checking for inline CSS proved only that the page was newer
than the asset era. Checking for class names proved nothing at all, since they exist in every
commit. Only a stamp carrying the commit sha changes every time.

**It only finds what it is pointed at.** 34 hand-paired roles cannot see reversed columns, a
differently composed image grid, or a card with a different structure. That is why the second
method exists, and why it returned FAIL on a page the first method scored at 11 differences.

---

## Reproducing this

```
python3 -m http.server 8777 --bind 127.0.0.1   # from inputs/, serves both sides
tools/capture_v2.sh                            # captures a render verified by commit stamp
node tools/fidelity_audit.mjs                  # property + geometry diff, both viewports
tools/fidelity_verify_codex.sh <ref.png> <ours.png> <label>
```
