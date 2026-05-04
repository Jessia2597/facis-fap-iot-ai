# AI Insight UI — Operator Scripts

Standalone scripts for build, deploy, smoke-testing, and drift detection.
None of these are part of the production runtime; they are tools for
operators and CI.

## Scripts

| Script | What it does | Dependencies |
|---|---|---|
| `build-and-package.sh` | Builds the Vue bundle and copies it into the Helm chart's `files/ui/` directory (legacy bootstrap pipeline). | `npm`, the Vue toolchain inside `ui/app/`. |
| `deploy.sh` | Builds the Vue bundle, zips it, POSTs to the orce pod's `/orce/backendtest/aiInsight` deploy endpoint (standard FAP pattern). Live updates without redeploying the orce pod. | `npm`, `zip`, `curl`, `FACIS_DEPLOY_TOKEN` env var. |
| `check-flows-drift.sh` | Diffs committed `flows.full.json` tab list against the deployed pod's `/data/flows.json`. Surfaces "Recovered Nodes" / "Configuration" / similar drift. | `kubectl`, `jq`. |
| `smoke-uibuilder-ping.mjs` | Connects via Socket.IO, sends a FAP §9 `ping` command, asserts the matching `result` envelope arrives. Post-deploy CI gate. | Node 18+, `socket.io-client@4`. |
| `smoke-browser-console.mjs` | Opens the SPA in a headless browser, asserts no `console.error`, asserts `window.uibuilder` is defined, asserts no 4xx/5xx asset responses. Post-deploy CI gate. | Node 18+, `@playwright/test`, `chromium` runtime. |

## Installing smoke-test dependencies

The smoke scripts deliberately do **not** ship pre-installed dependencies —
they run rarely (CI post-deploy gate) and the deps are heavy (Playwright
pulls a browser runtime). Install on demand:

```bash
# UIBUILDER ping
npm install --no-save socket.io-client@4

# Browser console
npm install --no-save @playwright/test
npx playwright install --with-deps chromium
```

CI runners can include these in their job setup phase.

## Environment

| Variable | Used by | Purpose |
|---|---|---|
| `FACIS_DEPLOY_TOKEN` | `deploy.sh` | Bearer token validated by the deploy flow against the same value provisioned on the orce pod. |
| `FACIS_DEPLOY_URL` | `deploy.sh` | Override default `https://fap-iotai.facis.cloud/orce/backendtest/aiInsight` (e.g. for a dev cluster). |
| `FACIS_HOST` | smoke scripts | Override default `https://fap-iotai.facis.cloud`. |
| `POD`, `NS` | `check-flows-drift.sh` | Override `orce-0` / `orce` defaults. |

## Typical CI sequence

```bash
# Build and deploy
FACIS_DEPLOY_TOKEN=$DEPLOY_TOKEN bash scripts/deploy.sh

# Verify
node scripts/smoke-uibuilder-ping.mjs
node scripts/smoke-browser-console.mjs
bash scripts/check-flows-drift.sh
```

All exit 0 on success; non-zero blocks the pipeline.
