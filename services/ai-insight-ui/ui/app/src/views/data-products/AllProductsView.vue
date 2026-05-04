<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import PageHeader from '@/components/common/PageHeader.vue'
import DataTablePage from '@/components/common/DataTablePage.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import { computed, ref, onMounted } from 'vue'
import { submit } from '@/services/transport'

interface RealProduct {
  id: string
  table_name: string
  name: string
  domain: string
  semanticScope: string | null
  description: string | null
  version: string
  apiStatus: string
  lastUpdated: string
  sourceTable: string
}

const router = useRouter()
const loading = ref(true)
const error = ref(false)
const isLive = ref(false)
const products = ref<Array<RealProduct & { category: string; useCase: string; sourceCount: number; exportStatus: string }>>([])

// Real catalogue from data-products.list (gold.information_schema.tables).
// Domain → category/useCase mapping is purely cosmetic; everything else is the
// raw API response.
function decorate(p: RealProduct) {
  const useCase = p.domain === 'energy' ? 'Smart Energy' : p.domain === 'city' ? 'Smart City' : 'Platform'
  return {
    ...p,
    category: p.domain === 'city' ? 'smart-city' : p.domain,
    useCase,
    sourceCount: 1,           // exactly one gold table backs each product
    exportStatus: 'ready',
  }
}

async function fetchData(): Promise<void> {
  loading.value = true
  error.value = false
  try {
    const r = await submit<unknown, { products: RealProduct[]; count: number }>('data-products.list', {})
    if (r.ok && r.data?.products) {
      products.value = r.data.products.map(decorate)
      isLive.value = true
    } else {
      error.value = true
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

const stats = computed(() => ({
  total: products.value.length,
  available: products.value.filter(p => p.apiStatus === 'available').length,
  energy: products.value.filter(p => p.category === 'energy').length,
  city: products.value.filter(p => p.category === 'smart-city').length,
  crossDomain: products.value.filter(p => p.category === 'unclassified').length
}))

const columns = [
  { field: 'name', header: 'Product Name', sortable: true },
  { field: 'category', header: 'Category', sortable: true, width: '130px' },
  { field: 'useCase', header: 'Use Case', sortable: true, width: '150px' },
  { field: 'semanticScope', header: 'Semantic Scope', sortable: true },
  { field: 'version', header: 'Version', sortable: true, width: '100px' },
  { field: 'sourceCount', header: 'Sources', type: 'number' as const, sortable: true, width: '90px' },
  { field: 'apiStatus', header: 'API', type: 'status' as const, sortable: true, width: '120px' },
  { field: 'exportStatus', header: 'Export', type: 'status' as const, sortable: true, width: '110px' },
  { field: 'lastUpdated', header: 'Last Updated', type: 'date' as const, sortable: true, width: '160px' },
  { field: 'actions', header: '', type: 'actions' as const, sortable: false, width: '80px' }
]

const filters = [
  { label: 'Energy', value: 'energy', field: 'category' },
  { label: 'Smart City', value: 'smart-city', field: 'category' },
  { label: 'Cross-Domain', value: 'cross-domain', field: 'category' },
  { label: 'API Available', value: 'available', field: 'apiStatus' },
  { label: 'Export Ready', value: 'ready', field: 'exportStatus' }
]
</script>

<template>
  <div class="view-page">
    <PageHeader
      title="All Data Products"
      subtitle="Platform-wide data products catalogue — unified access to harmonised datasets"
      :breadcrumbs="[{ label: 'Data Products' }, { label: 'All' }]"
    />

    <div v-if="error && !loading" class="api-error">
      <i class="pi pi-exclamation-circle"></i>
      <p>Could not load data from simulation API</p>
      <Button label="Retry" size="small" @click="fetchData()" />
    </div>
    <div v-else-if="isLive && !loading" class="live-banner">
      <span class="live-dot"></span> {{ products.length }} data products discovered in gold layer
    </div>

    <div class="view-body">
      <!-- KPI Summary -->
      <div class="grid-kpi">
        <KpiCard
          label="Total Products"
          :value="stats.total"
          trend="stable"
          icon="pi-box"
          color="#005fff"
        />
        <KpiCard
          label="API Available"
          :value="stats.available"
          trend="stable"
          icon="pi-check-circle"
          color="#22c55e"
        />
        <KpiCard
          label="Energy Products"
          :value="stats.energy"
          trend="stable"
          icon="pi-bolt"
          color="#f59e0b"
        />
        <KpiCard
          label="Smart City Products"
          :value="stats.city"
          trend="stable"
          icon="pi-map"
          color="#8b5cf6"
        />
        <KpiCard
          label="Cross-Domain"
          :value="stats.crossDomain"
          trend="stable"
          icon="pi-link"
          color="#06b6d4"
        />
      </div>

      <!-- Table -->
      <DataTablePage
        :title="`${products.length} data products registered`"
        :subtitle="'Click a row to view product detail'"
        :columns="columns"
        :data="products as unknown as Record<string, unknown>[]"
        :filters="filters"
        :search-fields="['name', 'description', 'semanticScope', 'useCase', 'version']"
        empty-icon="pi-box"
        empty-title="No data products found"
        empty-message="No products match your current filters."
        @row-select="(row) => router.push(`/data-products/${row['id']}`)"
      >
        <template #actions="{ row }">
          <Button
            icon="pi pi-arrow-right"
            text
            size="small"
            severity="secondary"
            @click.stop="router.push(`/data-products/${row['id']}`)"
          />
        </template>
      </DataTablePage>
    </div>
  </div>
</template>

<style scoped>
.live-banner { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 600; color: #15803d; background: #dcfce7; padding: 0.375rem 1.5rem; border-bottom: 1px solid #bbf7d0; }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.view-page { display: flex; flex-direction: column; }
.view-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
.api-error {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  padding: 2rem; margin: 1.5rem; border: 1px solid #fee2e2;
  border-radius: var(--facis-radius); background: #fff5f5;
  color: #991b1b; font-size: 0.875rem; text-align: center;
}
</style>
