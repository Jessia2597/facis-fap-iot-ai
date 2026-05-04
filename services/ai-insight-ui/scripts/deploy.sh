#!/usr/bin/env bash
# Standard FAP deploy: build the AI Insight UI Vue bundle, zip it, POST to the
# orce pod's deploy endpoint. The endpoint extracts the bundle into
# /data/uibuilder/aiInsight/src/ and applies a defensive asset-path rewrite.
#
# This replaces the legacy "kubectl cp dist/" / ConfigMap-binaryData paths.
# The init container in infrastructure/orce/init-ai-ui-patch.yaml remains as
# a cold-start bootstrap (default bundle on a fresh pod) — live updates flow
# through this script.
#
# Usage:
#   FACIS_DEPLOY_TOKEN=<token> ./scripts/deploy.sh
#   FACIS_DEPLOY_TOKEN=<token> FACIS_DEPLOY_URL=https://other-host/orce/backendtest/aiInsight \
#     ./scripts/deploy.sh --skip-build
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_ROOT="$SCRIPT_DIR/.."
APP_DIR="$SERVICE_ROOT/ui/app"
DEFAULT_URL="https://fap-iotai.facis.cloud/orce/backendtest/aiInsight"
DEPLOY_URL="${FACIS_DEPLOY_URL:-$DEFAULT_URL}"
SKIP_BUILD=false

for arg in "$@"; do
  [[ "$arg" == "--skip-build" ]] && SKIP_BUILD=true
done

if [[ -z "${FACIS_DEPLOY_TOKEN:-}" ]]; then
  echo "FACIS_DEPLOY_TOKEN is not set." >&2
  echo "Set it via: export FACIS_DEPLOY_TOKEN=<token>" >&2
  exit 2
fi

if [[ "$SKIP_BUILD" == false ]]; then
  echo "[1/3] Building Vue bundle"
  (cd "$APP_DIR" && npm ci --prefer-offline && npm run build)
else
  echo "[1/3] Skipping build (--skip-build)"
  [[ -d "$APP_DIR/dist" ]] || { echo "dist/ missing; cannot --skip-build" >&2; exit 2; }
fi

echo "[2/3] Packaging bundle.zip"
ZIP="$APP_DIR/bundle.zip"
rm -f "$ZIP"
(cd "$APP_DIR/dist" && zip -rq "$ZIP" .)
SIZE=$(du -h "$ZIP" | cut -f1)
echo "      $SIZE  $ZIP"

echo "[3/3] POST to $DEPLOY_URL"
HTTP_CODE=$(curl -sSL -o /tmp/deploy-response.json -w '%{http_code}' \
  -X POST "$DEPLOY_URL" \
  -H "Authorization: Bearer $FACIS_DEPLOY_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary "@$ZIP")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "deploy failed with HTTP $HTTP_CODE" >&2
  cat /tmp/deploy-response.json >&2 || true
  echo >&2
  exit 1
fi

echo "deploy ok:"
cat /tmp/deploy-response.json
echo
