// Live-cluster smoke test against https://fap-iotai.facis.cloud/orce/aiInsight/.
//
// Verifies:
//   - SPA loads + Keycloak login round-trip succeeds
//   - UIBUILDER WebSocket connects (no /api/sim/* HTTP calls fire — proves §9
//     migration is live)
//   - Each Smart City + Analytics view renders without console errors
//
// Requires Playwright runtime (already wired by restored-views.spec.ts):
//   npm install --no-save @playwright/test
//   npx playwright install chromium
//
// Run:
//   FACIS_BASE=https://fap-iotai.facis.cloud \
//   FACIS_KC_USER=test FACIS_KC_PASS='TestUser#12345' \
//     npx playwright test test/e2e/cluster-smoke.spec.ts --reporter=list

import { test, expect, type Page } from '@playwright/test'

const BASE = process.env['FACIS_BASE'] || 'https://fap-iotai.facis.cloud'
const SPA = `${BASE.replace(/\/+$/, '')}/orce/aiInsight`
const KC_USER = process.env['FACIS_KC_USER'] || 'test'
const KC_PASS = process.env['FACIS_KC_PASS'] || 'TestUser#12345'

// Routes that exercise the migrated UIBUILDER §9 actions.
const ROUTES: Array<{ name: string; path: string }> = [
  // Smart City module — exercises smart-city.{streetlights,traffic,events,weather,zones}.*
  { name: 'SmartCity overview',           path: '/use-cases/smart-city/overview' },
  { name: 'SmartCity zones',              path: '/use-cases/smart-city/zones' },
  { name: 'SmartCity zone detail',        path: '/use-cases/smart-city/zones/zone-001' },
  { name: 'SmartCity context',            path: '/use-cases/smart-city/context' },
  // Analytics — exercises analytics.{trends,correlations,anomalies,recommendations,
  //                                   meters.history,pv.history,weather.history}
  { name: 'Analytics trends',             path: '/analytics/trends' },
  { name: 'Analytics correlations',       path: '/analytics/correlations' },
  { name: 'Analytics anomalies',          path: '/analytics/anomalies' },
  { name: 'Analytics recommendations',    path: '/analytics/recommendations' },
  // Phase-5 surfaces — sanity check that other UIBUILDER channels still work
  { name: 'Data Sources all',             path: '/data-sources/all' },
  { name: 'Data Products all',            path: '/data-products/all' },
  { name: 'Provenance overview',          path: '/provenance/overview' },
  { name: 'Integrations overview',        path: '/integrations/overview' },
  { name: 'Schemas local',                path: '/schemas/local' },
  // Dashboard
  { name: 'Dashboard',                    path: '/dashboard' },
]

// Hold a single authenticated browser context so we don't redo KC login per route.
test.describe.configure({ mode: 'serial' })

let storageState: Record<string, unknown> | null = null

async function loginViaRoot(page: Page) {
  await page.goto(`${SPA}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  try {
    await page.waitForSelector('input#username', { timeout: 15_000 })
    await page.fill('input#username', KC_USER)
    await page.fill('input#password', KC_PASS)
    await Promise.all([
      page.waitForURL((u) => /\/orce\/aiInsight\//.test(u.toString()), { timeout: 30_000 }),
      page.click('button#kc-login, input[type=submit]')
    ])
  } catch {
    // Form not present — already authenticated via cookies, fall through.
  }
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.waitForTimeout(2_500)
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  await loginViaRoot(page)
  storageState = await context.storageState()
  await context.close()
})

for (const { name, path } of ROUTES) {
  test(`${name}`, async ({ browser }) => {
    if (!storageState) throw new Error('no auth state captured in beforeAll')
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: storageState as Parameters<typeof browser.newContext>[0]['storageState'],
    })
    const page = await context.newPage()
    // Re-authenticate via root URL to ensure the KC silent-SSO + UIBUILDER
    // handshake fully completes before we visit the deep test path.
    await loginViaRoot(page)
    const errors: string[] = []
    const httpReqs: string[] = []

    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
    page.on('request', (req) => {
      const u = req.url()
      // Track any /api/sim/* request — these should be ZERO after the §9 migration
      // for Smart City + Analytics endpoints.
      if (/\/api\/sim\/(streetlights|traffic|events|city-weather|meters\/[^\/]+\/history|pv\/[^\/]+\/history|weather\/[^\/]+\/history)/i.test(u)) {
        httpReqs.push(u)
      }
    })

    const resp = await page.goto(`${SPA}${path}`, { waitUntil: 'networkidle', timeout: 30_000 })
    expect(resp?.ok(), `navigation to ${path} returned ${resp?.status()}`).toBeTruthy()
    await page.waitForTimeout(3_000)

    // Filter: ignore environment noise from third-party widgets / source maps,
    // and the transient UIBUILDER ioSetup:connect_error that fires once
    // during the polling→WS upgrade dance — eventually the connection
    // succeeds (asserted below by checking _socket.connected).
    const ignored = [
      /Failed to load resource: the server responded with a status of 404/i,
      /sourcemap|source map/i,
      /\[Uib:ioSetup:connect_error\]/i,
    ]
    const real = errors.filter((e) => !ignored.some((rx) => rx.test(e)))

    // Cross-check: the real proof is the socket ending up connected. If not,
    // the connect_error is fatal and we surface it.
    const finalSocketConnected = await page.evaluate(() => {
      const u = (window as unknown as { uibuilder?: { _socket?: { connected?: boolean } } }).uibuilder
      return Boolean(u && u._socket && u._socket.connected)
    })
    expect(finalSocketConnected, `UIBUILDER socket not connected on ${path}`).toBe(true)

    expect(httpReqs, `migrated route hit /api/sim/*: ${httpReqs.join(', ')}`).toEqual([])
    expect(real, `console errors on ${path}:\n${real.join('\n')}`).toEqual([])

    const visible = await page.locator('main, [data-view-content], .view-body, .view-container').first().isVisible()
    expect(visible, `no view-content container visible on ${path}`).toBeTruthy()

    await context.close()
  })
}
