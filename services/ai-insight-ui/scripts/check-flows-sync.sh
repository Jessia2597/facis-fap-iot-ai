#!/usr/bin/env bash
# Verify that services/ai-insight-ui/flows/flows.full.json is the exact concatenation
# of services/ai-insight-ui/flows/tabs/*.json.
#
# Why this exists: flows.full.json is the consolidated file most tooling reads;
# tabs/*.json is the per-tab source for editing/version control. Manual jq
# merges keep them in sync today (see commits 71565f1, ba20521, etc.). This
# script catches drift before it lands.
#
# Usage:
#   ./scripts/check-flows-sync.sh        # exit 0 if in sync, 1 if drift
#   ./scripts/check-flows-sync.sh --fix  # rewrite flows.full.json from tabs/
#
# Recommended as a pre-commit hook or CI gate.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLOWS_DIR="$SCRIPT_DIR/../flows"
FULL="$FLOWS_DIR/flows.full.json"
TABS_DIR="$FLOWS_DIR/tabs"

if ! command -v jq >/dev/null; then echo "jq not found" >&2; exit 2; fi
if [[ ! -f "$FULL" ]]; then echo "missing $FULL" >&2; exit 2; fi
if [[ ! -d "$TABS_DIR" ]]; then echo "missing $TABS_DIR" >&2; exit 2; fi

# Build the expected merge: concatenate every tabs/*.json into one array,
# normalised by sorting on .id so order doesn't matter. Portable shell —
# no mapfile (bash-4 only); use find -print0 + xargs to be safe.
TAB_FILES=$(find "$TABS_DIR" -name '*.json' -type f | LC_ALL=C sort)
TAB_COUNT=$(printf '%s\n' "$TAB_FILES" | grep -c .)
if [[ "$TAB_COUNT" -eq 0 ]]; then echo "no tab files in $TABS_DIR" >&2; exit 2; fi

EXPECTED=$(printf '%s\n' "$TAB_FILES" | xargs jq -s 'add | sort_by(.id)')
ACTUAL=$(jq 'sort_by(.id)' "$FULL")

if [[ "${1:-}" == "--fix" ]]; then
  # Preserve original ordering: concatenate in sorted-filename order, no .id sort.
  printf '%s\n' "$TAB_FILES" | xargs jq -s 'add' > "$FULL.tmp"
  mv "$FULL.tmp" "$FULL"
  echo "rewrote $FULL from $TAB_COUNT tab files"
  exit 0
fi

if [[ "$EXPECTED" == "$ACTUAL" ]]; then
  echo "in sync: $TAB_COUNT tab files match flows.full.json"
  exit 0
fi

echo "DRIFT detected between flows.full.json and tabs/*.json"
echo "----- nodes only in tabs/ -----"
diff <(echo "$ACTUAL" | jq -r '.[] | .id') <(echo "$EXPECTED" | jq -r '.[] | .id') | grep '^>' | sed 's/^> /  + /' || true
echo "----- nodes only in flows.full.json -----"
diff <(echo "$ACTUAL" | jq -r '.[] | .id') <(echo "$EXPECTED" | jq -r '.[] | .id') | grep '^<' | sed 's/^< /  - /' || true
echo
echo "to resolve: ./scripts/check-flows-sync.sh --fix"
exit 1
