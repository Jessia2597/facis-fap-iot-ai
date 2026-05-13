// Playwright visual regression spec for the FAP-aligned visual system.
// Captures snapshot baselines for the 5 most-viewed routes; future PRs that
// drift away from FAP §13–§16 styling fail the visual-snapshot diff.
//
// Requires Playwright runtime:
//   npm install --no-save @playwright/test
//   npx playwright install --with-deps chromium
//
// First run captures the baseline; subsequent runs diff against it.
//   FACIS_BASE=https://fap-iotai.facis.cloud npx playwright test test/e2e/visual-regression.spec.ts
//   (Pass --update-snapshots once after a deliberate visual change.)
//
// FAP General Guideline §19 row "Visual language matches the standard" — this
// spec is the automated enforcement. Token drift, palette drift, or shell-
// layout regressions all show up as snapshot diffs.

import { test, expect, type Page } from '@playwright/test'

const BASE = process.env['FACIS_BASE'] || 'https://fap-iotai.facis.cloud'
const SPA = `${BASE.replace(/\/+$/, '')}/orce/aiInsight`

const KEY_VIEWS: Array<{ name: string; path: string; settle?: number }> = [
  { name: 'dashboard',     path: '/dashboard' },
  { name: 'ai-assistant',  path: '/ai-assistant' },
  { name: 'alerts-all',    path: '/alerts/all' },
  { name: 'smart-city',    path: '/use-cases/smart-city/overview' },
  { name: 'analytics',     path: '/analytics/overview' },
  { name: 'data-products', path: '/data-products/all' },
  { name: 'integrations',  path: '/integrations/overview' },
]

async function snapshotView(page: Page, name: string, path: string, settleMs = 3500) {
  await page.goto(`${SPA}${path}`, { waitUntil: 'networkidle', timeout: 20_000 })
  await page.waitForTimeout(settleMs)
  // Mask volatile UI (timestamps, KPI live numbers) so snapshot is stable.
  const masks = await page.locator(
    '[data-testid="live-timestamp"], .live-banner, time, .kpi-card__value, .live-dot'
  ).all()
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: masks,
    maxDiffPixelRatio: 0.02,
  })
}

test.describe('FAP visual regression baseline', () => {
  test.beforeEach(async ({ page }) => {
    // Apply a fixed viewport so screenshots are deterministic across runners.
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  for (const v of KEY_VIEWS) {
    test(`view: ${v.name}`, async ({ page }) => {
      await snapshotView(page, v.name, v.path, v.settle)
    })
  }

  test('canvas + shell tokens are FAP-aligned', async ({ page }) => {
    await page.goto(`${SPA}/dashboard`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      return {
        canvas:        root.getPropertyValue('--color-canvas').trim(),
        surface:       root.getPropertyValue('--color-surface').trim(),
        primary:       root.getPropertyValue('--color-primary').trim(),
        primaryHover:  root.getPropertyValue('--color-primary-hover').trim(),
        text:          root.getPropertyValue('--color-text').trim(),
        success:       root.getPropertyValue('--color-success').trim(),
        radiusShell:   root.getPropertyValue('--radius-shell').trim(),
        radiusControl: root.getPropertyValue('--radius-control').trim(),
        bodyBg:        getComputedStyle(document.body).backgroundColor,
      }
    })

    // FAP §14 mandatory values
    expect(tokens.canvas.toUpperCase()).toBe('#E1E7EF')
    expect(tokens.surface.toUpperCase()).toBe('#FFFFFF')
    expect(tokens.primary.toUpperCase()).toBe('#005FFF')
    expect(tokens.primaryHover.toUpperCase()).toBe('#2563EB')
    expect(tokens.text.toUpperCase()).toBe('#1F2937')
    expect(tokens.success.toUpperCase()).toBe('#10B981')
    expect(tokens.radiusShell).toBe('20px')
    expect(tokens.radiusControl).toBe('8px')
    // Body background should resolve to the canvas token.
    expect(tokens.bodyBg).toBe('rgb(225, 231, 239)')  // #E1E7EF
  })
})
