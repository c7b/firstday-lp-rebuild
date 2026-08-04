#!/usr/bin/env bash
# Capture a v2 render that provably matches the current commit, and keep it.
#
# Shopify's edge serves this page from a rotating set of nodes, some holding an older render,
# with no header or parameter that reliably selects the current one. Measuring the live URL is
# therefore non-deterministic: the same commit reads as 6 differences or 48 depending on which
# node answers. Capturing once — verified against selectors taken from the working tree — and
# then measuring that file makes the comparison reproducible, and puts both sides of the
# comparison on the same footing, since the reference is also a captured file.
set -uo pipefail
STORE="${SHOPIFY_FLAG_STORE:-firstday-lp-rebuild}"
PAGE="https://${STORE}.myshopify.com/pages/tdk-behind-the-science-lp-v2"
OUT="${1:-/home/lcam/firstday-assignment/inputs/v2-live.html}"
JAR="$(mktemp)"
curl -s -c "$JAR" -d "form_type=storefront_password&utf8=%E2%9C%93&password=${STOREFRONT_PASSWORD:-1234}" \
  -o /dev/null "https://${STORE}.myshopify.com/password"

# Markers come from the working tree, so this can never pass on a stale render.
MARKERS=$(grep -oE '^\.lp-[a-z0-9_-]+' sections/lp-fidelity-overrides.liquid | sort -u | tail -5 | tr -d '.')
for i in $(seq 1 "${CAPTURE_TRIES:-60}"); do
  curl -s -b "$JAR" "${PAGE}?_cap=${i}$(date +%s%N)" -o "$OUT"
  ok=1
  for m in $MARKERS; do grep -q "$m" "$OUT" || ok=0; done
  if [ "$ok" = "1" ]; then
    echo "  captured the current commit on attempt $i ($(wc -c < "$OUT") bytes) -> $OUT"
    rm -f "$JAR"; exit 0
  fi
  sleep 3
done
echo "  never caught a current render in ${CAPTURE_TRIES:-60} attempts"
rm -f "$JAR"; exit 1
