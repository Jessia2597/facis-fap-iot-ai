import { defineStore, storeToRefs } from 'pinia'
import { ref, computed } from 'vue'
import type { AlertEvent } from '@/data/types'
import { submit } from '@/services/transport'
import { useAppStore } from '@/services/state'

// Pure UIBUILDER alerts store (Phase 3.2 vertical slice).
//
// All alert data flows from ORCE through the FAP §9 transport into the app
// store's reducer (state.model.alerts). This notifications store is a
// typed view + read-state tracker on top of that source. The list-load,
// detail, and acknowledge actions all go through submit() — no fetch().
//
// Push pattern: alerts.new events arriving over UIBUILDER are unshifted
// into state.model.alerts by reducers.ts; the typed `alerts` getter below
// re-derives the typed view automatically.

const ALLOWED_SEV: AlertEvent['severity'][] = ['critical', 'error', 'warning', 'info']
const ALLOWED_STATUS: AlertEvent['status'][] = ['open', 'acknowledged', 'resolved']

function normaliseAlert(raw: unknown): AlertEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  return {
    id: String(a.id ?? `alert-${Date.now()}`),
    useCase: (a.useCase as AlertEvent['useCase']) ?? 'Platform',
    source: String(a.source ?? 'unknown'),
    category: String(a.category ?? 'Runtime'),
    severity: (ALLOWED_SEV.includes(a.severity as AlertEvent['severity'])
      ? a.severity
      : 'info') as AlertEvent['severity'],
    timestamp: String(a.timestamp ?? new Date().toISOString()),
    status: (ALLOWED_STATUS.includes(a.status as AlertEvent['status'])
      ? a.status
      : 'open') as AlertEvent['status'],
    message: String(a.message ?? ''),
  }
}

export const useNotificationsStore = defineStore('notifications', () => {
  const appStore = useAppStore()
  const { state: appState } = storeToRefs(appStore)

  const readIds = ref<Set<string>>(new Set())
  const loaded = ref(false)

  const alerts = computed<AlertEvent[]>(() =>
    (appState.value.model.alerts as unknown[])
      .map(normaliseAlert)
      .filter((a): a is AlertEvent => a !== null)
  )

  async function loadFromApi(): Promise<void> {
    if (loaded.value) return
    try {
      // Reducer mutates state.model.alerts on receipt — no need to assign here.
      await submit<unknown, { alerts: unknown[]; count: number }>('alerts.list', {})
      loaded.value = true
    } catch { /* leave alerts as-is on transient failure */ }
  }

  const unreadCount = computed(() =>
    alerts.value.filter(a => !readIds.value.has(a.id) && a.status !== 'resolved').length
  )

  const openAlerts = computed(() => alerts.value.filter(a => a.status === 'open'))
  const criticalAlerts = computed(() =>
    alerts.value.filter(a => a.severity === 'critical' && a.status !== 'resolved')
  )

  function addAlert(alert: Omit<AlertEvent, 'id'>): void {
    // Local-only alerts (e.g. a view detects an anomaly) are still useful for
    // immediate feedback. Prepend onto the upstream list directly.
    const newAlert: AlertEvent = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
    ;(appState.value.model.alerts as unknown[]).unshift(newAlert)
  }

  function markRead(id: string): void { readIds.value.add(id) }
  function markAllRead(): void { alerts.value.forEach(a => readIds.value.add(a.id)) }

  async function acknowledge(id: string): Promise<void> {
    try {
      await submit<{ id: string }, { alert: unknown }>('alerts.acknowledge', { id })
      // Server-side updated the ring; mirror locally without round-trip.
      const list = appState.value.model.alerts as Array<Record<string, unknown>>
      const found = list.find((a) => a && a.id === id)
      if (found) found.status = 'acknowledged'
      readIds.value.add(id)
    } catch { /* keep local state untouched on failure; toast surfaced via reducer */ }
  }

  function resolve(id: string): void {
    // Resolution is a UI-only flag for now; ORCE doesn't yet model it.
    const list = appState.value.model.alerts as Array<Record<string, unknown>>
    const found = list.find((a) => a && a.id === id)
    if (found) found.status = 'resolved'
    readIds.value.add(id)
  }

  function clearAll(): void {
    ;(appState.value.model.alerts as unknown[]).length = 0
    readIds.value.clear()
  }

  function isRead(id: string): boolean { return readIds.value.has(id) }

  return {
    alerts,
    unreadCount,
    openAlerts,
    criticalAlerts,
    loaded,
    loadFromApi,
    addAlert,
    markRead,
    markAllRead,
    acknowledge,
    resolve,
    clearAll,
    isRead,
  }
})
