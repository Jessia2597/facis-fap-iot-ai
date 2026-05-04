<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import PageHeader from '@/components/common/PageHeader.vue'
import DataTablePage from '@/components/common/DataTablePage.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import { submit } from '@/services/transport'

interface RealProduct {
  id: string; table_name: string; name: string; domain: string;
  semanticScope: string | null; description: string | null;
  version: string; apiStatus: string; lastUpdated: string; sourceTable: string
}

const router = useRouter()
const loading = ref(true)
const error = ref(false)
const products = ref<Array<RealProduct & { useCase: string; sourceCount: number; exportStatus: string }>>([])

async function fetchData(): Promise<void> {
  loading.value = true; error.value = false
  try {
    const r = await submit<unknown, { products: RealProduct[]; count: number }>('data-products.energy.list', {})
    if (r.ok && r.data?.products) {
      products.value = r.data.products.map(p => ({ ...p, useCase: 'Smart Energy', sourceCount: 1, exportStatus: 'ready' }))
    } else { error.value = true }
  } catch { error.value = true } finally { loading.value = false }
}

onMounted(fetchData)

const stats = computed(() => ({
  total: products.value.length,
  available: products.value.filter(p => p.apiStatus === 'available').length,
  totalSources: products.value.length
}))

const columns = [
  { field: 'name', header: 'Product', sortable: true },
  { field: 'useCase', header: 'Use Case', sortable: true, width: '140px' },
  { field: 'semanticScope', header: 'Semantic Scope', sortable: true },
  { field: 'version', header: 'Version', sortable: true, width: '100px' },
  { field: 'sourceCount', header: 'Sources', type: 'number' as const, sortable: true, width: '90px' },
  { field: 'apiStatus', header: 'API', type: 'status' as const, sortable: true, width: '120px' },
  { field: 'exportStatus', header: 'Export', type: 'status' as const, sortable: true, width: '110px' },
  { field: 'lastUpdated', header: 'Updated', type: 'date' as const, sortable: true, width: '160px' },
  { field: 'actions', header: '', type: 'actions' as const, sortable: false, width: '80px' }
]

const filters = [
  { label: 'API Available', value: 'available', field: 'apiStatus' },
  { label: 'Export Ready', value: 'ready', field: 'exportStatus' }
]
</script>

<template>
  <div class="view-page">
    <PageHeader
      title="Energy Data Products"
      subtitle="Harmonised datasets for Smart Energy use case — metering, PV, weather, and market data"
      :breadcrumbs="[{ label: 'Data Products' }, { label: 'Energy' }]"
    >
      <template #actions>
        <Button icon="pi pi-refresh" size="small" text :loading="loading" @click="fetchData()" />
      </template>
    </PageHeader>

    <div v-if="error && !loading" class="api-error">
      <i class="pi pi-exclamation-circle"></i>
      <p>Could not load data from simulation API</p>
      <Button label="Retry" size="small" @click="fetchData()" />
    </div>

    <div class="view-body">
      <div class="grid-kpi">
        <KpiCard label="Energy Products" :value="stats.total" trend="stable" icon="pi-bolt" color="#f59e0b" />
        <KpiCard label="API Available" :value="stats.available" trend="stable" icon="pi-check-circle" color="#22c55e" />
        <KpiCard label="Contributing Sources" :value="stats.totalSources" trend="stable" icon="pi-database" color="#005fff" />
      </div>

      <DataTablePage
        :title="`${products.length} energy data products`"
        subtitle="Click a row to view full product detail and access API endpoint"
        :columns="columns"
        :data="products as unknown as Record<string, unknown>[]"
        :filters="filters"
        :search-fields="['name', 'semanticScope', 'version']"
        empty-icon="pi-bolt"
        empty-title="No energy products found"
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
.view-page { display: flex; flex-direction: column; }
.view-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
.api-error {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  padding: 2rem; margin: 1.5rem; border: 1px solid #fee2e2;
  border-radius: var(--facis-radius); background: #fff5f5;
  color: #991b1b; font-size: 0.875rem; text-align: center;
}
</style>
