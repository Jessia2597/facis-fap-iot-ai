#!/usr/bin/env node
// Smoke test: WebSocket round-trip via UIBUILDER, send a FAP §9 ping command,
// assert the matching result arrives within 5s. Used as the post-deploy CI
// gate for the AI Insight UI.
//
// Requires socket.io-client v4 (UIBUILDER's transport):
//   npm install --no-save socket.io-client@4
//
// Usage:
//   node smoke-uibuilder-ping.mjs                                  # default URL
//   node smoke-uibuilder-ping.mjs https://fap-iotai.facis.cloud    # override host
//
// Exits 0 on success, non-zero on any failure (timeout, wrong response,
// connection refused). FAP General Guideline §18 step 4 / §19 row "UIBUILDER
// endpoint is reachable".

import { randomUUID } from 'node:crypto'

const HOST = process.argv[2] || process.env.FACIS_HOST || 'https://fap-iotai.facis.cloud'
// UIBUILDER's actual socket.io mount is at <httpNodeRoot>/uibuilder/vendor/socket.io
// (default httpNodeRoot is '/'). The /orce/ prefix is added by the rewrite ingress
// (facis-ingress-aiinsight-rewrite.yaml) which maps /orce/uibuilder/* → /uibuilder/*.
// The Socket.IO namespace matches the UIBUILDER instance URL ('aiInsight').
const SOCKET_PATH = '/uibuilder/vendor/socket.io'
const NAMESPACE  = '/aiInsight'
const TIMEOUT_MS = 5000

async function main() {
  let io
  try {
    io = (await import('socket.io-client')).io
  } catch (err) {
    console.error('socket.io-client not installed.')
    console.error('Install with: npm install --no-save socket.io-client@4')
    process.exit(2)
  }

  const url = HOST.replace(/^http/, 'ws') + NAMESPACE
  console.error(`[smoke-ping] connecting to ${url} (path=${SOCKET_PATH})`)

  const socket = io(url, {
    path: SOCKET_PATH,
    // transports: default (polling + upgrade)
    reconnection: false,
    timeout: TIMEOUT_MS,
    // Node.js v24 ships a CA bundle missing some intermediates the FACIS
    // wildcard cert chains through; browsers don't have this issue. This
    // is a deploy gate, not a security check.
    rejectUnauthorized: false,
  })

  const requestId = randomUUID()
  const t0 = Date.now()

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    // UIBUILDER's Socket.IO channel names (uibGlobalConfig.cjs):
    //   client (browser → server) = 'uiBuilderClient'
    //   server (server → browser) = 'uiBuilder'
    socket.on('connect', () => {
      console.error(`[smoke-ping] connected; sending command requestId=${requestId}`)
      socket.emit('uiBuilderClient', {
        type: 'command',
        action: 'ping',
        requestId,
        payload: {},
        meta: { clientTs: Date.now(), source: 'smoke-test' },
      })
    })
    socket.on('connect_error', (err) => {
      clearTimeout(timer); reject(new Error(`connect_error: ${err.message}`))
    })
    // UIBUILDER server's sendToFe defaults to ioChannels.client ('uiBuilderClient'),
    // so the same channel carries both directions. Some configs use 'uiBuilder'
    // (ioChannels.server) for outbound — listen on both to cover both cases.
    const handleResp = (msg) => {
      const env = (msg && msg.payload && typeof msg.payload === 'object') ? msg.payload : msg
      if (env && env.type === 'result' && env.requestId === requestId) {
        clearTimeout(timer); resolve(env)
      }
    }
    socket.on('uiBuilderClient', handleResp)
    socket.on('uiBuilder', handleResp)
  }).catch((err) => {
    socket.close()
    console.error(`[smoke-ping] FAIL: ${err.message}`)
    process.exit(1)
  })

  socket.close()

  if (result.ok !== true) {
    console.error('[smoke-ping] FAIL: result.ok was not true:', JSON.stringify(result))
    process.exit(1)
  }
  if (result.action !== 'ping') {
    console.error(`[smoke-ping] FAIL: unexpected action ${result.action}`)
    process.exit(1)
  }
  if (!result.data || result.data.pong !== true) {
    console.error('[smoke-ping] FAIL: data.pong was not true:', JSON.stringify(result.data))
    process.exit(1)
  }
  const latency = Date.now() - t0
  console.error(`[smoke-ping] PASS — round-trip ${latency}ms, serverTs=${result.data.serverTs}`)
  process.exit(0)
}

main().catch((err) => { console.error('[smoke-ping] unexpected:', err); process.exit(2) })
