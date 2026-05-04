// FAP General Guideline §11 — single inbound handler + single outbound command.
//
// Every Vue view talks to ORCE through this module. Calling sites use:
//   const r = await submit('alerts.list', {})
//   if (r.ok) { /* r.data */ } else { /* r.errors */ }
//
// The reducer fan-in (registerInboundHandler) is wired once at app boot
// (main.ts) and dispatches every inbound message to either reduceResult or
// reduceEvent. Result envelopes are also correlated by `requestId` to resolve
// the matching submit() promise.
//
// Reference: /Users/danielpires/Developer/Ciberseg/Atlas/guidelines and examples/
//            FAP_UI_General_Guideline_Reference_Aligned.md  §11

import { useUiBuilderStore } from '@/stores/uibuilder'
import { useAppStore } from './state'
import type {
  CommandRequest,
  ResultResponse,
  EventEnvelope,
  InboundMessage,
  ContractErrors,
} from './contract'

interface PendingEntry {
  resolve: (msg: ResultResponse<unknown>) => void
  reject: (err: ContractErrors) => void
  timer: ReturnType<typeof setTimeout>
}

const pending = new Map<string, PendingEntry>()

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Wire the single inbound handler — called once at app boot from main.ts.
 *
 * Every message arriving over the UIBUILDER socket flows through here:
 *   - `type === 'result'`: correlates to a pending submit() promise via
 *     `requestId`, then forwards to the reducer for state mutation.
 *   - `type === 'event'`: forwards to the event reducer (push patterns).
 *   - Anything else (legacy `{topic, payload}` shapes) is ignored at this
 *     layer; the legacy uibuilder store's _dispatch handles those during the
 *     Phase 2→3 transition. After Phase 3 lands, the legacy path is removed.
 */
export function registerInboundHandler(
  reduceResult: (m: ResultResponse<unknown>) => void,
  reduceEvent: (m: EventEnvelope<unknown>) => void
): () => void {
  const uib = useUiBuilderStore()
  return uib.onMessage((raw) => {
    const msg = raw as unknown as InboundMessage
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'result') {
      const entry = pending.get(msg.requestId)
      if (entry) {
        clearTimeout(entry.timer)
        pending.delete(msg.requestId)
        if (msg.ok) entry.resolve(msg)
        else entry.reject(msg.errors ?? { system: 'unknown error' })
      }
      reduceResult(msg)
    } else if (msg.type === 'event') {
      reduceEvent(msg)
    }
    // legacy {topic, payload} messages: silently ignored here.
  })
}

/**
 * Send a FAP §9 Command and await the matching Result.
 *
 * Resolves with the full ResultResponse on `ok: true`. Rejects with a
 * ContractErrors object on `ok: false` or on transport failure (timeout,
 * disconnected). The reducer is also called with the result for state
 * mutation regardless of resolve/reject.
 */
export function submit<P, D = unknown>(
  action: string,
  payload: P,
  opts: { sessionId?: string; step?: string; timeoutMs?: number } = {}
): Promise<ResultResponse<D>> {
  const uib = useUiBuilderStore()
  const app = useAppStore()

  // FAP §11 outbound rule: set ui.loading + ui.pendingAction BEFORE send so
  // views show progress immediately. The reducer clears these on result; the
  // timeout/disconnect paths below also clear them.
  app.state.ui.loading = true
  app.state.ui.pendingAction = { action }

  if (!uib.connected) {
    app.state.ui.loading = false
    app.state.ui.pendingAction = null
    return Promise.reject({ system: 'UIBUILDER not connected' } as ContractErrors)
  }
  const requestId = newRequestId()
  const req: CommandRequest<P> = {
    type: 'command',
    action,
    sessionId: opts.sessionId ?? app.state.sessionId ?? undefined,
    step: opts.step ?? app.state.step,
    requestId,
    payload,
    meta: { clientTs: Date.now(), source: 'dashboard' },
  }
  return new Promise<ResultResponse<D>>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      // Mirror the reducer's cleanup so the UI doesn't stay stuck on "loading".
      if (app.state.ui.pendingAction?.action === action) {
        app.state.ui.pendingAction = null
      }
      app.state.ui.loading = false
      reject({ system: `timeout: ${action}` } as ContractErrors)
    }, opts.timeoutMs ?? 10_000)
    pending.set(requestId, {
      resolve: resolve as (m: ResultResponse<unknown>) => void,
      reject,
      timer,
    })
    uib.sendEnvelope(req)
  })
}

/** For tests / hot-reload: cancel all pending submits and clear the map. */
export function _resetPending(): void {
  pending.forEach((e) => {
    clearTimeout(e.timer)
    e.reject({ system: 'cancelled' })
  })
  pending.clear()
}
