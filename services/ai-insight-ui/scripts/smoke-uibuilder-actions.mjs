#!/usr/bin/env node
// Per-action smoke matrix: round-trip every Phase-3 action over UIBUILDER and
// assert each returns a FAP §9 result envelope with the expected shape. Used
// as the post-deploy CI gate alongside smoke-uibuilder-ping.mjs.
//
// Requires socket.io-client v4:
//   npm install --no-save socket.io-client@4
//
// Usage:
//   node smoke-uibuilder-actions.mjs                                 # default URL
//   node smoke-uibuilder-actions.mjs https://fap-iotai.facis.cloud   # override
//
// Exits 0 if every action passes; non-zero if any one fails. Each action
// failure is reported individually so CI logs surface exactly which action
// regressed. FAP General Guideline §19 row "Subflows are responsibility-based".

import { randomUUID } from 'node:crypto'

const HOST = process.argv[2] || process.env.FACIS_HOST || 'https://fap-iotai.facis.cloud'
const PATH = '/orce/aiInsight/socket.io/'
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 8000)

const ADMIN_TOKEN = process.env.FACIS_ADMIN_TOKEN || ''  // optional; admin actions skipped if absent

// Each test: action, payload, assertion on the result. assertion returns null
// for pass, or a string error message.
const TESTS = [
  {
    action: 'ping',
    payload: {},
    assert: (r) => r.ok === true && r.data?.pong === true ? null : 'pong missing',
  },
  {
    action: 'alerts.list',
    payload: {},
    assert: (r) => r.ok === true && Array.isArray(r.data?.alerts) ? null : 'alerts not an array',
  },
  {
    action: 'data-sources.list',
    payload: {},
    assert: (r) => r.ok === true && Array.isArray(r.data?.sources) ? null : 'sources not an array',
  },
  {
    action: 'provenance.transfers',
    payload: {},
    assert: (r) => r.ok === true && Array.isArray(r.data?.transfers) ? null : 'transfers not an array',
  },
  {
    action: 'provenance.insights',
    payload: {},
    assert: (r) => r.ok === true && Array.isArray(r.data?.insights) ? null : 'insights not an array',
  },
  {
    action: 'integrations.health',
    payload: {},
    assert: (r) => r.ok === true && Array.isArray(r.data?.services) ? null : 'services not an array',
  },
  {
    action: 'schemas.list',
    payload: {},
    // schemas.list goes to Trino — may legitimately fail in environments without Trino access.
    // Accept ok=true OR errors.integration as a known transient condition.
    assert: (r) => r.ok === true && Array.isArray(r.data?.tables)
      ? null
      : (r.errors?.integration ? null : 'schemas.list failed without integration error'),
  },
]

if (ADMIN_TOKEN) {
  TESTS.push(
    { action: 'admin.users',  payload: { authToken: ADMIN_TOKEN }, assert: (r) => r.ok && Array.isArray(r.data?.users) ? null : 'users not an array' },
    { action: 'admin.roles',  payload: { authToken: ADMIN_TOKEN }, assert: (r) => r.ok && Array.isArray(r.data?.roles) ? null : 'roles not an array' },
    { action: 'admin.access', payload: { authToken: ADMIN_TOKEN }, assert: (r) => r.ok && Array.isArray(r.data?.events) ? null : 'events not an array' },
  )
} else {
  console.error('[smoke-actions] FACIS_ADMIN_TOKEN not set; skipping admin.* tests')
}

async function main() {
  let io
  try { io = (await import('socket.io-client')).io }
  catch {
    console.error('socket.io-client not installed.')
    console.error('Install with: npm install --no-save socket.io-client@4')
    process.exit(2)
  }

  const url = HOST.replace(/^http/, 'ws')
  console.error(`[smoke-actions] connecting ${url}${PATH}`)

  const socket = io(url, {
    path: PATH,
    transports: ['websocket'],
    reconnection: false,
    timeout: TIMEOUT_MS,
  })

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve)
    socket.on('connect_error', (e) => reject(new Error(`connect_error: ${e.message}`)))
    setTimeout(() => reject(new Error('connect timeout')), TIMEOUT_MS)
  }).catch((err) => {
    console.error(`[smoke-actions] FAIL: ${err.message}`)
    process.exit(1)
  })

  const pending = new Map()
  socket.on('msg', (msg) => {
    if (msg && msg.type === 'result' && msg.requestId) {
      const entry = pending.get(msg.requestId)
      if (entry) { pending.delete(msg.requestId); clearTimeout(entry.timer); entry.resolve(msg) }
    }
  })

  function submit(action, payload) {
    const requestId = randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('timeout')) }, TIMEOUT_MS)
      pending.set(requestId, { resolve, reject, timer })
      socket.emit('msg', {
        type: 'command', action, requestId, payload,
        meta: { clientTs: Date.now(), source: 'smoke-actions' },
      })
    })
  }

  let failures = 0
  for (const t of TESTS) {
    process.stderr.write(`[smoke-actions] ${t.action} ... `)
    try {
      const t0 = Date.now()
      const r = await submit(t.action, t.payload)
      const ms = Date.now() - t0
      const err = t.assert(r)
      if (err) { console.error(`FAIL (${ms}ms): ${err}`); console.error('  result:', JSON.stringify(r).slice(0, 300)); failures++ }
      else     { console.error(`pass (${ms}ms)`) }
    } catch (e) {
      console.error(`FAIL: ${e.message}`); failures++
    }
  }

  socket.close()
  if (failures > 0) {
    console.error(`[smoke-actions] ${failures}/${TESTS.length} tests failed`)
    process.exit(1)
  }
  console.error(`[smoke-actions] all ${TESTS.length} tests passed`)
  process.exit(0)
}

main().catch((err) => { console.error('[smoke-actions] unexpected:', err); process.exit(2) })
