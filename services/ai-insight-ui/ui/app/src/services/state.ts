// FAP General Guideline §8 — five-block frontend state model.
//
// Every Vue view reads from this single Pinia store. Reducers in reducers.ts
// are the only writers: `model` holds business data, `ui` holds purely
// presentational state, `errors` holds structured feedback, and the top-level
// `sessionId` / `step` are server-issued.
//
// Reference: /Users/danielpires/Developer/Ciberseg/Atlas/guidelines and examples/
//            FAP_UI_General_Guideline_Reference_Aligned.md  §8

import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { ContractErrors } from './contract'

export type ToastKind = 'success' | 'info' | 'warning' | 'error'

interface ModelState {
  // populated incrementally by reduceResult / reduceEvent as actions land.
  // each action namespace owns a top-level key; views bind to these reactively.
  alerts: unknown[]
  dataSources: unknown[]
  schemas: unknown[]
  provenance: { transfers: unknown[]; insights: unknown[] }
  integrations: Record<string, unknown>
  admin: { users: unknown[]; roles: unknown[]; access: unknown[] }
  smartCity: Record<string, unknown>
  dataProducts: { all: unknown[]; energy: unknown[]; city: unknown[]; detail: unknown | null }
  analytics: Record<string, unknown>
  kpi: { netGrid: number; pvGeneration: number; dailyCost: number; updatedAt?: string; dataAsOf?: string } | null
  conversation: Array<{ role: 'user' | 'assistant'; text: string; ts: number }>
  bootstrap: Record<string, unknown> | null
}

interface UiState {
  loading: boolean
  modal: unknown | null
  toast: { kind: ToastKind; message: string } | null
  pendingAction: { action: string; progress?: number; label?: string } | null
}

export const useAppStore = defineStore('app', () => {
  // FAP §8 — five blocks. Wrapped in reactive() so any reducer mutation
  // triggers Vue's reactivity without explicit ref() per leaf.
  const state = reactive({
    sessionId: null as string | null,
    step: 'dashboard' as string,
    model: {
      alerts: [],
      dataSources: [],
      schemas: [],
      provenance: { transfers: [], insights: [] },
      integrations: {},
      admin: { users: [], roles: [], access: [] },
      smartCity: {},
      dataProducts: { all: [], energy: [], city: [], detail: null },
      analytics: {},
      kpi: null,
      conversation: [],
      bootstrap: null,
    } as ModelState,
    ui: {
      loading: false,
      modal: null,
      toast: null,
      pendingAction: null,
    } as UiState,
    errors: {} as ContractErrors,
  })

  return { state }
})
