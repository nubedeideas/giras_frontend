<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBilling } from '@/composables/useBilling'
import type { PaymentListItem } from '@/composables/useAdminPayments'
import { toArray } from '@/utils/pagination'

const api = useBilling()
const payments = ref<PaymentListItem[]>([])
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    payments.value = toArray(await api.myBilling())
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar la facturación'
  } finally {
    loading.value = false
  }
})

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg-3">
  <div class="max-w-2xl mx-auto px-8 py-8">
    <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px] mb-6">Facturación</h2>
    <p class="text-[11px] text-ink-4 mb-5">Pagos de todas tus giras.</p>

    <div v-if="loading" class="flex justify-center py-10">
      <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round" />
      </svg>
    </div>

    <p v-else-if="error" class="text-[12px] text-red-400">{{ error }}</p>
    <p v-else-if="payments.length === 0" class="text-[11px] text-ink-4">Todavía no tenés pagos registrados.</p>

    <div v-else class="space-y-1.5">
      <div
        v-for="p in payments"
        :key="p.uuid"
        class="flex items-center justify-between bg-glass border border-line rounded-lg px-3 py-2.5"
      >
        <div class="min-w-0">
          <p class="text-[12px] text-ink truncate">{{ p.tour_name }}</p>
          <p class="text-[10px] text-ink-4">{{ formatDate(p.payment_date ?? p.created_at) }}</p>
        </div>
        <div class="text-right flex-shrink-0 ml-3">
          <p class="text-[12px] font-semibold text-ink">{{ p.amount }} {{ p.currency }}</p>
          <span class="text-[10px] font-semibold text-ink-3 capitalize">{{ p.status }}</span>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>
