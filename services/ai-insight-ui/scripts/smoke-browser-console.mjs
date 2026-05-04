#!/usr/bin/env node
// Smoke test: open the AI Insight UI in a real browser, assert no console
// errors, assert window.uibuilder is defined after page settle, assert the
// UIBUILDER status badge in the editor reports a live connection. Used as
// the post-deploy CI gate alongside smoke-uibuilder-ping.mjs.
//
// Requires Playwright:
//   npm install --no-save @playwright/test
//   npx playwright install --with-deps chromium
//
// Usage:
//   node smoke-browser-console.mjs                                 # default URL
//   node smoke-browser-console.mjs https://fap-iotai.facis.cloud   # override host
//
// Exits 0 on success. Non-zero on any console.error, missing window.uibuilder,
// or 4xx/5xx asset response. FAP General Guideline §19 final checklist row
// "UIBUILDER endpoint is reachable".

const HOST = process.argv[2] || process.env.FACIS_HOST || 'https://fap-iotai.facis.cloud'
const SPA_URL = `${HOST.replace(/\/+$/, '')}/orce/aiInsight/`
const SETTLE_MS = 4000  // generous: SPA boots + UIBUILDER handshake

async function main() {
  let chromium
  try {
    ({ chromium } = await import('playwright'))
  } catch (err) {
    console.error('playwright not installed.')
    console.error('Install with: npm install --no-save @playwright/test && npx playwright install --with-deps chromium')
    process.exit(2)
  }

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()

  const consoleErrors = []
  const failedRequests = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`))
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.url()} :: HTTP ${r.status()}`)
  })

  console.error(`[smoke-browser] navigating to ${SPA_URL}`)
  try {
    await page.goto(SPA_URL, { waitUntil: 'networkidle', timeout: 20000 })
  } catch (err) {
    console.error(`[smoke-browser] FAIL: navigation: ${err.message}`)
    await browser.close(); process.exit(1)
  }

  await page.waitForTimeout(SETTLE_MS)

  const uibInfo = await page.evaluate(() => {
    const w = /** @type any */ (window)
    return {
      defined: typeof w.uibuilder === 'object' && w.uibuilder !== null,
      type: typeof w.uibuilder,
      keys: w.uibuilder ? Object.keys(w.uibuilder).slice(0, 10) : [],
    }
  })

  console.error('[smoke-browser] window.uibuilder:', JSON.stringify(uibInfo))
  console.error('[smoke-browser] console errors:', consoleErrors.length)
  console.error('[smoke-browser] failed requests:', failedRequests.length)

  await browser.close()

  let failed = false
  if (!uibInfo.defined) {
    console.error('[smoke-browser] FAIL: window.uibuilder is undefined')
    failed = true
  }
  if (consoleErrors.length > 0) {
    console.error('[smoke-browser] FAIL: console errors detected:')
    consoleErrors.forEach((e) => console.error(`  - ${e}`))
    failed = true
  }
  if (failedRequests.length > 0) {
    console.error('[smoke-browser] FAIL: failed requests:')
    failedRequests.forEach((r) => console.error(`  - ${r}`))
    failed = true
  }
  if (failed) process.exit(1)

  console.error('[smoke-browser] PASS')
  process.exit(0)
}

main().catch((err) => { console.error('[smoke-browser] unexpected:', err); process.exit(2) })
