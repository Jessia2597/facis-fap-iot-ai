import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─── Protocol types ────────────────────────────────────────────────────────────

export interface InsightResponsePayload {
  type: string
  summary: string
  keyFindings: string[]
  recommendations: string[]
  metadata?: Record<string, unknown>
  data?: unknown
}

export interface LlmResponsePayload {
  text: string
  provider: string
  model: string
  timestamp: string
}

export interface KpiUpdatePayload {
  netGrid: number
  pvGeneration: number
  dailyCost: number
}

export interface UibMessage {
  topic: string
  payload: {
    recordDetails?: {
      insight?: InsightResponsePayload
      response?: LlmResponsePayload
      [key: string]: unknown
    }
    [key: string]: unknown
  }
}

type MessageHandler = (msg: UibMessage) => void

export const useUiBuilderStore = defineStore('uibuilder', () => {
  const connected = ref(false)
  const connecting = ref(false)
  const lastError = ref<string | null>(null)
  const lastKpi = ref<KpiUpdatePayload | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uibuilder: any = null
  const handlers: MessageHandler[] = []

  // ─── Init ──────────────────────────────────────────────────────────────────

  async function init(): Promise<void> {
    if (connecting.value || connected.value) return
    connecting.value = true

    try {
      // UIBuilder attaches itself to window.uibuilder when the client script loads.
      // In production the script is served by Node-RED at /uibuilder/vendor/uibuilder.esm.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      if (win.uibuilder) {
        uibuilder = win.uibuilder
        // CRITICAL: force the absolute Socket.IO path AND the namespace.
        //
        // (a) Socket.IO path. UIBUILDER's client lib auto-derives
        //     httpNodeRoot from the page URL — when the SPA loads at
        //     /orce/aiInsight/, it infers httpNodeRoot='/orce' and computes
        //     ioPath='/orce/uibuilder/vendor/socket.io'. The nginx-ingress
        //     regex rewrite forwards the polling handshake but mangles WS
        //     upgrade headers. We force the absolute path.
        //
        // (b) Namespace. UIBUILDER takes window.location.pathname's last
        //     segment as the Socket.IO namespace. At the SPA root that's
        //     'aiInsight' (correct). On a deep URL such as
        //     /orce/aiInsight/use-cases/smart-city/overview the auto-derived
        //     namespace becomes 'overview' — a namespace the server doesn't
        //     expose, so engine.io rejects the handshake with "server
        //     error" and msgsReceived stays at 0. Always pin it to the
        //     instance namespace.
        //
        // We override defensively at every property the lib reads, because
        // start({...}) options alone have been observed to not stick:
        //   1. uibuilder.httpNodeRoot     — used by constructor to derive ioPath
        //   2. uibuilder.ioPath           — direct override
        //   3. uibuilder.socketOptions.path — what _ioSetup actually reads
        //   4. uibuilder.url              — UIBUILDER instance URL / namespace key
        //   5. uibuilder.ioNamespace      — what _ioSetup uses for io(nsp, ...)
        // Then call start() with no options (already configured).
        uibuilder.httpNodeRoot = ''
        uibuilder.ioPath = '/uibuilder/vendor/socket.io'
        if (uibuilder.socketOptions) uibuilder.socketOptions.path = '/uibuilder/vendor/socket.io'
        uibuilder.url = 'aiInsight'
        uibuilder.ioNamespace = '/aiInsight'
        uibuilder.start()

        uibuilder.onChange('connected', (val: boolean) => {
          connected.value = val
        })

        // We've observed in practice (UIBUILDER v7.5.0 against this Node-RED
        // setup) that `_socket.on('uiBuilder', _stdMsgFromServer)` is
        // registered correctly but does NOT fire when standard messages
        // arrive — even though the server demonstrably emits them, onAny()
        // sees them, and the control listener on 'uiBuilderControl' does
        // fire. The result is `uibuilder.msgsReceived` stays at 0 forever
        // and `uibuilder.onChange('msg', …)` never triggers.
        //
        // Workaround: attach our own direct listener on the socket for the
        // 'uiBuilder' channel and route to `_dispatch`. This bypasses the
        // lib's broken std-msg path entirely. The lib's onChange('msg', …)
        // wiring is left as a redundant secondary path in case it ever
        // recovers, but we no longer rely on it for delivery.
        if (uibuilder._socket) {
          uibuilder._socket.on('uiBuilder', (msg: UibMessage) => _dispatch(msg))
        }
        uibuilder.onChange('msg', (msg: UibMessage) => {
          _dispatch(msg)
        })

        connected.value = true
      } else {
        // UIBuilder not available — running standalone / dev mode
        lastError.value = 'UIBuilder runtime not found. Running in mock data mode.'
      }
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : 'UIBuilder init failed'
    } finally {
      connecting.value = false
    }
  }

  // ─── Internal dispatcher ───────────────────────────────────────────────────

  // Pure fan-out to registered handlers — the request/response routing for
  // FAP §9 commands lives in services/transport.ts. The only legacy hook
  // retained here is the live KPI push, which the dashboard reads via
  // the reactive `lastKpi` ref. When the server starts emitting FAP §9
  // events for KPIs, this branch can be deleted in favour of a
  // reduceEvent('kpi.update') case.
  function _dispatch(msg: UibMessage): void {
    if (msg?.topic === 'kpi.update') {
      const kpi = msg.payload?.recordDetails as KpiUpdatePayload | undefined
      if (kpi) lastKpi.value = kpi
    }
    handlers.forEach(h => h(msg))
  }

  function _formatInsightResponse(insight: InsightResponsePayload): string {
    let out = insight.summary ?? ''
    if (insight.keyFindings?.length) {
      out += '\n\n**Key Findings:**\n' + insight.keyFindings.map(f => `- ${f}`).join('\n')
    }
    if (insight.recommendations?.length) {
      out += '\n\n**Recommendations:**\n' + insight.recommendations.map(r => `- ${r}`).join('\n')
    }
    return out
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Send a smart-prompt insight request. Returns a promise that resolves with
   *  the formatted insight text, or rejects after timeout. Internally routed
   *  through the FAP §9 transport so the dispatcher's FAP-aware path handles
   *  it (the legacy `{topic, payload}` shape this store originally sent never
   *  matched the server-side adapter's `msg.data.recordDetails` reads). */
  async function requestInsight(
    action: string,
    params: Record<string, unknown>,
    promptText: string,
    timeoutMs = 30_000
  ): Promise<string> {
    const { submit } = await import('@/services/transport')
    const r = await submit<{ action: string; params: Record<string, unknown>; promptText: string }, {
      insight?: InsightResponsePayload
      latest?: unknown
      action?: string
    }>('insight.request', { action, params, promptText }, { timeoutMs })
    if (!r.ok) throw new Error(r.errors?.action || r.errors?.system || 'insight.request failed')
    if (r.data?.insight) return _formatInsightResponse(r.data.insight)
    if (r.data?.latest) return JSON.stringify(r.data.latest, null, 2)
    return ''
  }

  /** Send a free-form LLM query. Returns a promise that resolves with the
   *  LLM's response text, or rejects after timeout. Internally routed through
   *  the FAP §9 transport for the same reason as requestInsight above. */
  async function requestLlm(query: string, timeoutMs = 60_000): Promise<string> {
    const { submit } = await import('@/services/transport')
    const r = await submit<{ query: string }, { response?: LlmResponsePayload }>('llm.freeform', { query }, { timeoutMs })
    if (!r.ok) throw new Error(r.errors?.action || r.errors?.system || 'llm.freeform failed')
    return r.data?.response?.text ?? ''
  }

  /** Low-level send — bypasses request/response tracking */
  function send(topic: string, payload: unknown): void {
    if (!uibuilder || !connected.value) {
      console.debug('[UIBuilder] send skipped (not connected):', topic, payload)
      return
    }
    uibuilder.send({ topic, payload })
  }

  /** Send a complete FAP §9 envelope as-is (no topic wrapping). Use this for
   *  FAP-aligned command/event messages routed by the transport layer. */
  function sendEnvelope(envelope: object): void {
    if (!uibuilder || !connected.value) {
      console.debug('[UIBuilder] sendEnvelope skipped (not connected):', envelope)
      return
    }
    uibuilder.send(envelope)
  }

  function onMessage(handler: MessageHandler): () => void {
    handlers.push(handler)
    return () => {
      const idx = handlers.indexOf(handler)
      if (idx !== -1) handlers.splice(idx, 1)
    }
  }

  function disconnect(): void {
    if (uibuilder) {
      try { uibuilder.disconnect?.() } catch { /* ignore */ }
    }
    uibuilder = null
    connected.value = false
    handlers.length = 0
  }

  const isAvailable = computed(() => connected.value)

  return {
    connected,
    connecting,
    lastError,
    lastKpi,
    isAvailable,
    init,
    send,
    sendEnvelope,
    requestInsight,
    requestLlm,
    onMessage,
    disconnect
  }
})
