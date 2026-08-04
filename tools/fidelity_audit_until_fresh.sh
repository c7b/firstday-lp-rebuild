#!/usr/bin/env bash
# Run the audit until it measures the commit that is actually checked in.
#
# Roughly a third of Shopify's edge nodes serve the current render and the rest serve an older
# one. Chromium pools connections at the browser level, so a retry inside one process keeps
# talking to whichever node it first reached — twenty-five reloads against a stale node are
# twenty-five stale reads. Relaunching the process is what gets a new connection, so the retry
# lives out here rather than in the script.
#
# The audit exits 2 when it cannot confirm the commit, so a plain exit-code loop is enough.
set -uo pipefail
TRIES="${OUTER_TRIES:-25}"
for i in $(seq 1 "$TRIES"); do
  echo "== attempt $i/$TRIES =="
  if FIDELITY_TRIES="${FIDELITY_TRIES:-2}" node tools/fidelity_audit.mjs; then
    echo "== measured the current commit on attempt $i =="
    exit 0
  fi
  sleep "${OUTER_SLEEP:-15}"
done
echo "== gave up after $TRIES attempts — the edge never served this commit =="
exit 1
