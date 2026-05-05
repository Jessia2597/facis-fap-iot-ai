import { computed, onMounted, onUnmounted, ref, type Ref, type ComputedRef } from 'vue'

/**
 * Reactive "Ns ago" / "Nm ago" / "Nh ago" string for an ISO timestamp.
 *
 * The returned ComputedRef re-evaluates once per second so the relative time
 * stays accurate between source updates (e.g. between FAP §9 broadcast events).
 * Returns the empty string when `ts` is null/undefined/empty so the caller can
 * concatenate freely (`'Trino · ' + ago.value` → `'Trino · '` before the first
 * broadcast lands).
 *
 * The 1s tick is registered in `onMounted` and cleared in `onUnmounted`, so
 * each consuming view starts/stops its own tick — no global timer leak.
 */
export function useRelativeTime(ts: Ref<string | undefined | null> | ComputedRef<string | undefined | null>): ComputedRef<string> {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(() => { now.value = Date.now() }, 1000)
  })
  onUnmounted(() => {
    if (timer !== null) clearInterval(timer)
    timer = null
  })

  return computed(() => {
    const v = ts.value
    if (!v) return ''
    const parsed = Date.parse(v)
    if (Number.isNaN(parsed)) return ''
    const diffMs = Math.max(0, now.value - parsed)
    const s = Math.floor(diffMs / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  })
}
