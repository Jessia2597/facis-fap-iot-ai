#!/usr/bin/env bash
# CI guard for the AI Insight UI: enforces transport contract and topic-path
# discipline at the grep level (defense-in-depth alongside ESLint).
#
# Usage:  scripts/lint-transport.sh
# Exit 0 = clean, Exit 1 = violation.
#
# Run from ui/app/ as cwd. Intended to be wired in CI after lint+typecheck.
set -euo pipefail

cd "$(dirname "$0")/.."

fail=0

# Phase 5 guard: legacy topic-based dispatch must trend down. Baseline
# (.topic-baseline) lists each existing call site in `path:lineno` form.
# CI fails when a NEW site appears that isn't in the baseline. After Phase 5
# the baseline file is deleted and any topic site fails.
TOPIC_BASELINE_FILE=".topic-baseline"
TOPIC_NOW=$(grep -rEn "msg\.topic === ['\"](kpi\.update|insight\.response|llm\.response)['\"]" src/ --include='*.ts' --include='*.vue' \
  | grep -v '^src/stores/uibuilder.ts:' \
  | sort || true)
if [[ -f "$TOPIC_BASELINE_FILE" ]]; then
  TOPIC_BASELINE=$(sort "$TOPIC_BASELINE_FILE")
  NEW_SITES=$(comm -23 <(echo "$TOPIC_NOW") <(echo "$TOPIC_BASELINE"))
  if [[ -n "$NEW_SITES" ]]; then
    echo "FAIL: new legacy topic-based dispatch site(s) outside src/stores/uibuilder.ts:" >&2
    echo "$NEW_SITES" >&2
    fail=1
  else
    SITE_COUNT=$(echo "$TOPIC_NOW" | grep -c . || true)
    echo "Legacy topic dispatch sites: $SITE_COUNT (baseline matched)"
  fi
elif [[ -n "$TOPIC_NOW" ]]; then
  echo "FAIL: legacy topic dispatch found and no .topic-baseline:" >&2
  echo "$TOPIC_NOW" >&2
  fail=1
fi

# Phase 2/2c guard: hex literals in color-bearing properties of views/components
# must trend down. Baseline is committed at .stylelint-baseline; CI fails on
# regression. After Phase 2c the baseline file is deleted and any hex fails.
HEX_BASELINE_FILE=".stylelint-baseline"
HEX_NOW=$(grep -rEoh '#[0-9a-fA-F]{3,8}\b' src/views src/components --include='*.vue' --include='*.css' 2>/dev/null | wc -l | tr -d ' ')
if [[ -f "$HEX_BASELINE_FILE" ]]; then
  HEX_BASELINE=$(cat "$HEX_BASELINE_FILE" | tr -d ' \n')
  echo "Hex literal count: $HEX_NOW (baseline $HEX_BASELINE)"
  if (( HEX_NOW > HEX_BASELINE )); then
    echo "FAIL: hex literal count regressed ($HEX_NOW > $HEX_BASELINE)" >&2
    fail=1
  fi
else
  echo "Hex literal count: $HEX_NOW (no baseline; treating any > 0 as fail)"
  if (( HEX_NOW > 0 )); then
    echo "FAIL: hex literals present ($HEX_NOW) and no .stylelint-baseline exists" >&2
    fail=1
  fi
fi

# Phase 3c guard: views and components must not import @/services/api.
# (ESLint catches this too; this is a backstop for non-TS pathways.)
API_IMPORT_VIOLATIONS=$(grep -rEn "from ['\"]@?/?(\.\./)*services/api['\"]" src/views src/components --include='*.vue' --include='*.ts' 2>/dev/null || true)
if [[ -n "$API_IMPORT_VIOLATIONS" ]]; then
  COUNT=$(echo "$API_IMPORT_VIOLATIONS" | wc -l | tr -d ' ')
  API_BASELINE_FILE=".api-import-baseline"
  if [[ -f "$API_BASELINE_FILE" ]]; then
    API_BASELINE=$(cat "$API_BASELINE_FILE" | tr -d ' \n')
    echo "@/services/api importers: $COUNT (baseline $API_BASELINE)"
    if (( COUNT > API_BASELINE )); then
      echo "FAIL: @/services/api importers regressed ($COUNT > $API_BASELINE):" >&2
      echo "$API_IMPORT_VIOLATIONS" >&2
      fail=1
    fi
  else
    echo "FAIL: @/services/api importers exist ($COUNT) and no baseline file:" >&2
    echo "$API_IMPORT_VIOLATIONS" >&2
    fail=1
  fi
fi

if (( fail )); then
  exit 1
fi
echo "lint-transport: clean"
