#!/usr/bin/env bash
# Lightweight CI gate: verify the canonical FAP §14 tokens are present in
# the built CSS. This is fast (no browser needed) and catches token-level
# drift without running the full Playwright snapshot suite.
#
# Run AFTER `npm run build` so the dist/ assets exist.
#
# Exits 0 if all expected FAP tokens are in the bundle, 1 if any is missing.
set -euo pipefail

DIST="$(dirname "$0")/../ui/app/dist"
[[ -d "$DIST" ]] || { echo "$DIST not found — run npm run build first" >&2; exit 2; }

CSS="$(find "$DIST" -name 'index-*.css' | head -1)"
[[ -n "$CSS" ]] || { echo "no built CSS in $DIST/assets" >&2; exit 2; }

declare -a EXPECTED=(
  '#E1E7EF'   # canvas
  '#005FFF'   # primary
  '#2563EB'   # primary hover
  '#3B82F6'   # secondary
  '#1F2937'   # text strong
  '#6B7280'   # text muted
  '#E5E7EB'   # border
  '#10B981'   # success
  '#F59E0B'   # warning
  '#EF4444'   # danger
  '20px'      # shell radius
  '8px'       # control radius
  '6px'       # small radius
)

declare -a UNEXPECTED=(
  '#0047cc'   # legacy primary-dark — should be #2563EB now
  '#22c55e'   # legacy success — should be #10B981 now
  '#1e293b'   # legacy text — should be #1F2937 now
  '#f8fafc'   # legacy bg — should be #E1E7EF now
)

missing=0
for token in "${EXPECTED[@]}"; do
  if ! grep -qiF "$token" "$CSS"; then
    echo "  ✗ MISSING expected FAP token: $token"
    missing=1
  fi
done

drift=0
for token in "${UNEXPECTED[@]}"; do
  if grep -qiF "$token" "$CSS"; then
    echo "  ✗ DRIFT — legacy token still in CSS: $token"
    drift=1
  fi
done

if (( missing == 0 && drift == 0 )); then
  echo "✓ FAP §14 tokens present, no legacy drift in $CSS"
  exit 0
fi
echo
echo "FAP token audit failed — see above."
exit 1
