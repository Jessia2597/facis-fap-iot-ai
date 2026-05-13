<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  status: string
  size?: 'sm' | 'md'
  showDot?: boolean
}>(), {
  size: 'md',
  showDot: true
})

type StatusGroup = 'healthy' | 'warning' | 'error' | 'offline' | 'info' | 'neutral'

// String → semantic group. Each group resolves to one of the
// --status-*-{fg,bg} token pairs declared in styles/tokens.css.
const STATUS_GROUP: Record<string, StatusGroup> = {
  healthy: 'healthy', active: 'healthy', online: 'healthy', success: 'healthy',
  valid: 'healthy', resolved: 'healthy', available: 'healthy', ready: 'healthy',

  warning: 'warning', dimmed: 'warning', partial: 'warning', maintenance: 'warning',
  acknowledged: 'warning', processing: 'warning', draft: 'warning', invited: 'warning',

  error: 'error', critical: 'error', fault: 'error', unavailable: 'error',
  invalid: 'error', failure: 'error',

  offline: 'offline', inactive: 'offline', off: 'offline', deprecated: 'offline',

  info: 'info', open: 'info',
}

const STATUS_LABEL: Record<string, string> = {
  healthy: 'Healthy', active: 'Active', online: 'Online', success: 'Success',
  valid: 'Valid', resolved: 'Resolved', available: 'Available', ready: 'Ready',
  warning: 'Warning', dimmed: 'Dimmed', partial: 'Partial', maintenance: 'Maintenance',
  acknowledged: 'Acknowledged', processing: 'Processing', draft: 'Draft', invited: 'Invited',
  error: 'Error', critical: 'Critical', fault: 'Fault', unavailable: 'Unavailable',
  invalid: 'Invalid', failure: 'Failure',
  offline: 'Offline', inactive: 'Inactive', off: 'Off', deprecated: 'Deprecated',
  info: 'Info', open: 'Open',
}

const key = computed(() => props.status?.toLowerCase() ?? '')
const group = computed<StatusGroup>(() => STATUS_GROUP[key.value] ?? 'neutral')
const label = computed(() => STATUS_LABEL[key.value] ?? props.status)
</script>

<template>
  <span
    class="status-badge"
    :class="[`status-badge--${size}`, `status-badge--${group}`]"
  >
    <span v-if="showDot" class="status-badge__dot"></span>
    {{ label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 20px;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge--sm {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
}

.status-badge--md {
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
}

.status-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: currentColor;
}

.status-badge--healthy { color: var(--status-healthy-fg); background: var(--status-healthy-bg); }
.status-badge--warning { color: var(--status-warning-fg); background: var(--status-warning-bg); }
.status-badge--error   { color: var(--status-error-fg);   background: var(--status-error-bg); }
.status-badge--offline { color: var(--status-offline-fg); background: var(--status-offline-bg); }
.status-badge--info    { color: var(--status-info-fg);    background: var(--status-info-bg); }
.status-badge--neutral { color: var(--status-neutral-fg); background: var(--status-neutral-bg); }
</style>
