#!/usr/bin/env bash
# Independent 1:1 verification of the fidelity pass by a different model family.
#
# The measurement harness only finds what its pair list points at, and the first version of it
# reported a page as nearly closed while it was visibly not. A second pair of eyes that has
# never seen this repo, judging rendered pixels rather than selectors, catches the class of
# miss a selector list cannot: something absent, something in the wrong place, something the
# pair list never named.
#
# It returns a verdict and a list. Anything on the list comes back to the builder.
#
# Usage: tools/fidelity_verify_codex.sh <reference.png> <ours.png> <label>
set -euo pipefail

REF="${1:?reference screenshot}"
OURS="${2:?our screenshot}"
LABEL="${3:-viewport}"
MODEL="${CODEX_MODEL:-gpt-5.6-sol}"

read -r -d '' PROMPT <<'EOF' || true
You are verifying a pixel-fidelity rebuild. Image 1 is the REFERENCE page. Image 2 is the
REBUILD that is supposed to match it.

Compare them as a designer doing acceptance, not as a summariser. Go section by section from
top to bottom. For every difference, name it concretely and say where it is.

Report ONLY differences in layout and presentation. Ignore entirely:
- differences in the site header, promo bar, navigation and footer (out of scope by the brief)
- the exact photographs used, EXCEPT their arrangement, count, crop and aspect ratio
- any difference in the words themselves (copy is fixed and must not change)

Care about: element widths and wrapping, whether a heading breaks across lines where the
reference keeps it on one, column proportions, vertical rhythm and spacing, alignment (ranged
left vs centred), image grid composition, whether something is present in one and missing in
the other, and order of elements.

Answer in exactly this shape:

VERDICT: PASS or FAIL
DIFFERENCES:
1. <section> — <what is different, with the direction: reference does X, rebuild does Y>
2. ...

If there are no differences worth a designer's objection, write VERDICT: PASS and
DIFFERENCES: none. Be strict: the bar is pixel-perfect.
EOF

echo "== verifying ${LABEL} with ${MODEL} =="
codex exec \
  --model "${MODEL}" \
  --sandbox read-only \
  --skip-git-repo-check \
  -i "${REF}" "${OURS}" \
  -- "${PROMPT}" \
  < /dev/null
