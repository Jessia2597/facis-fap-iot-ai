// FAP General Guideline §11 — structured reducers.
//
// reduceResult and reduceEvent are the ONLY writers to the app store. Every
// inbound message from ORCE flows through registerInboundHandler (transport.ts)
// into one of these two functions. The dispatch is on `action` (for results)
// or `event` (for events) — no scattered per-component parsers.
//
// Per §11 reducer rules:
//   - persist sessionId when received
//   - switch screens from next.step
//   - merge only the relevant data block
//   - keep ui.toast and ui.modal separate from the business model
//   - keep the same step when errors are returned
//
// Reference: /Users/danielpires/Developer/Ciberseg/Atlas/guidelines and examples/
//            FAP_UI_General_Guideline_Reference_Aligned.md  §11

import type { ResultResponse, EventEnvelope } from './contract'
import { useAppStore } from './state'

export function reduceResult(msg: ResultResponse<unknown>): void {
  const { state } = useAppStore()

  // §11: persist sessionId on first receipt.
  if (msg.sessionId && !state.sessionId) state.sessionId = msg.sessionId

  // §11: switch step from next.step ONLY when no errors.
  if (msg.ok && msg.next?.step) state.step = msg.next.step

  // §11: business data merge per action namespace.
  if (msg.ok) {
    const data = msg.data as any
    switch (msg.action) {
      case 'bootstrap.session':       state.model.bootstrap   = data ?? null; break
      case 'alerts.list':              state.model.alerts      = data?.alerts ?? []; break
      case 'data-sources.list':        state.model.dataSources = data?.sources ?? []; break
      case 'schemas.list':             state.model.schemas     = data?.tables ?? []; break
      case 'provenance.transfers':    (state.model.provenance.transfers as unknown[]) = data?.transfers ?? []; break
      case 'provenance.insights':     (state.model.provenance.insights as unknown[])  = data?.insights ?? []; break
      case 'integrations.health':      state.model.integrations = data ?? {}; break
      case 'admin.users':              state.model.admin.users  = data?.users ?? []; break
      case 'admin.roles':              state.model.admin.roles  = data?.roles ?? []; break
      case 'admin.access':             state.model.admin.access = data?.events ?? []; break
      case 'data-products.list':       state.model.dataProducts.all    = data?.products ?? []; break
      case 'data-products.energy.list':state.model.dataProducts.energy = data?.products ?? []; break
      case 'data-products.city.list':  state.model.dataProducts.city   = data?.products ?? []; break
      case 'data-products.detail':     state.model.dataProducts.detail = data ?? null; break
      // smart-city.* and analytics.* — Phase 5 will add specific cases as
      // those views land. Until then, the namespaced bucket is updated wholesale.
      default:
        if (msg.action.startsWith('smart-city.')) {
          (state.model.smartCity as Record<string, unknown>)[msg.action] = data
        } else if (msg.action.startsWith('analytics.')) {
          (state.model.analytics as Record<string, unknown>)[msg.action] = data
        }
    }
  }

  // §11: ui hints sit alongside, not inside, business data.
  if (msg.ui?.toast) state.ui.toast = msg.ui.toast

  // §11: errors keep the same step.
  state.errors = msg.errors ?? {}

  state.ui.loading = false
  if (state.ui.pendingAction?.action === msg.action) state.ui.pendingAction = null
}

export function reduceEvent(msg: EventEnvelope<unknown>): void {
  const { state } = useAppStore()
  const data = msg.data as any
  switch (msg.event) {
    case 'alerts.new':
      // push pattern: prepend to alerts list, dedupe by id if present.
      if (data?.alert) {
        const id = (data.alert as { id?: unknown }).id
        const existing = state.model.alerts as Array<{ id?: unknown }>
        if (id == null || !existing.some((a) => a.id === id)) {
          existing.unshift(data.alert)
        }
      }
      break
    case 'kpi.update':
      if (data) state.model.kpi = data
      break
    case 'jobProgress':
      if (data && state.ui.pendingAction) {
        state.ui.pendingAction.progress = data.progress
        state.ui.pendingAction.label = data.label
      }
      break
    case 'jobComplete':
      // Phase 5 analytics async pattern: clear progress when matching action completes.
      if (data?.action && state.ui.pendingAction?.action === data.action) {
        state.ui.pendingAction = null
      }
      break
  }
}
