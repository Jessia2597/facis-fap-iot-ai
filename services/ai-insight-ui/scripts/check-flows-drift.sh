#!/usr/bin/env bash
# Detect drift between the committed AI Insight UI flows and the deployed ORCE pod.
#
# The committed repo is the source of truth. If the deployed pod's flows.json
# contains tabs (e.g. "Recovered Nodes", "Configuration") that are not in the
# committed flows.full.json, that is drift introduced via the editor and must
# be cleaned up by re-deploying the committed flows.
#
# Usage:
#   ./scripts/check-flows-drift.sh                 # uses current kubectl context
#   POD=orce-0 NS=orce ./scripts/check-flows-drift.sh
#
# Exits 0 if no drift, 1 if drift detected, 2 on tooling/access error.
set -euo pipefail

POD="${POD:-orce-0}"
NS="${NS:-orce}"
REPO_FLOWS="$(dirname "$0")/../flows/flows.full.json"

if ! command -v kubectl >/dev/null; then echo "kubectl not found" >&2; exit 2; fi
if ! command -v jq      >/dev/null; then echo "jq not found"      >&2; exit 2; fi
if [[ ! -f "$REPO_FLOWS" ]]; then echo "missing $REPO_FLOWS" >&2; exit 2; fi

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

if ! kubectl exec -n "$NS" "$POD" -- cat /data/flows.json > "$TMP" 2>/dev/null; then
  echo "failed to read /data/flows.json from $NS/$POD" >&2
  exit 2
fi

REPO_TABS=$(jq -r '.[] | select(.type=="tab") | .label' "$REPO_FLOWS" | LC_ALL=C sort)
POD_TABS=$(jq -r  '.[] | select(.type=="tab") | .label' "$TMP"        | LC_ALL=C sort)

if diff <(echo "$REPO_TABS") <(echo "$POD_TABS") >/dev/null; then
  echo "no drift: deployed tabs match committed flows.full.json"
  exit 0
fi

echo "DRIFT DETECTED between committed flows and deployed pod $NS/$POD:"
echo "----- only in repo -----"
comm -23 <(echo "$REPO_TABS") <(echo "$POD_TABS") | sed 's/^/  - /' || true
echo "----- only on pod (drift to clean up) -----"
comm -13 <(echo "$REPO_TABS") <(echo "$POD_TABS") | sed 's/^/  + /' || true
echo
echo "to clean up: redeploy committed flows from this repo (see ops-runbook)"
exit 1
