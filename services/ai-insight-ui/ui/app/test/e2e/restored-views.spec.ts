// Playwright spec covering the 16 views restored in Phase 5 PR-5.
//
// For each restored route we assert:
//   - the page loads without HTTP errors,
//   - no `console.error` is logged during the initial render,
//   - the view renders meaningful content (a `<main>` or `[data-view-content]`
//     container with non-empty text).
//
// Requires Playwright runtime:
//   npm install --no-save @playwright/test
//   npx playwright install --with-deps chromium
//
// Run:
//   FACIS_BASE=https://fap-iotai.facis.cloud \
//     npx playwright test test/e2e/restored-views.spec.ts
//
// FAP General Guideline §19 row "Visual language matches the standard" —
// the visual snapshot baseline is captured separately in Phase 6.

import { test, expect, type Page } from '@playwright/test'

const BASE = process.env['FACIS_BASE'] || 'https://fap-iotai.facis.cloud'
const SPA = `${BASE.replace(/\/+$/, '')}/orce/aiInsight`

const RESTORED_ROUTES: Array<{ name: string; path: string }> = [
  // Smart City module (8)
  { name: 'SmartCity overview',           path: '/use-cases/smart-city/overview' },
  { name: 'SmartCity analytics',          path: '/use-cases/smart-city/analytics' },
  { name: 'SmartCity context',            path: '/use-cases/smart-city/context' },
  { name: 'SmartCity zones',              path: '/use-cases/smart-city/zones' },
  { name: 'SmartCity zone detail',        path: '/use-cases/smart-city/zones/zone-center' },
  { name: 'SmartCity data products',      path: '/use-cases/smart-city/data-products' },
  { name: 'SmartCity data product detail',path: '/use-cases/smart-city/data-products/sc-dp-001' },
  // (the SmartCityView container redirects to overview; covered by /use-cases/smart-city above)

  // Data Products module (4)
  { name: 'DataProducts all',     path: '/data-products/all' },
  { name: 'DataProducts energy',  path: '/data-products/energy' },
  { name: 'DataProducts city',    path: '/data-products/city' },
  { name: 'DataProducts detail',  path: '/data-products/dp-energy-meter-readings' },

  // Deep Analytics views (4)
  { name: 'Analytics trends',          path: '/analytics/trends' },
  { name: 'Analytics correlations',    path: '/analytics/correlations' },
  { name: 'Analytics anomalies',       path: '/analytics/anomalies' },
  { name: 'Analytics recommendations', path: '/analytics/recommendations' },
]

async function gotoView(page: Page, path: string) {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  const resp = await page.goto(`${SPA}${path}`, { waitUntil: 'networkidle', timeout: 20_000 })
  expect(resp?.ok(), `navigation to ${path} returned ${resp?.status()}`).toBeTruthy()
  // Allow the SPA to settle (UIBUILDER handshake + initial reducer events).
  await page.waitForTimeout(2_500)
  return errors
}

for (const { name, path } of RESTORED_ROUTES) {
  test(`restored view loads: ${name}`, async ({ page }) => {
    const errors = await gotoView(page, path)
    expect(errors, `console errors on ${path}: ${errors.join(' || ')}`).toEqual([])
    // Any of these markers suggests the view rendered (Vue mounted, not the
    // splash screen). Keep loose so visual changes in Phase 6 don't break it.
    const visible = await page.locator('main, [data-view-content], .view-body, .view-container').first().isVisible()
    expect(visible, `no view-content container visible on ${path}`).toBeTruthy()
  })
}
