<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAdminPayments, type PaymentListItem, type PaymentDetail } from '@/composables/useAdminPayments'

const props = defineProps<{ payment: PaymentListItem }>()
const emit = defineEmits<{ refund: [] }>()

const api = useAdminPayments()
const expanded = ref(false)
const detail = ref<PaymentDetail | null>(null)
const loading = ref(false)

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: 'rgba(31,173,90,0.15)', text: '#34d399' },
  pending: { bg: 'rgba(26,143,255,0.12)', text: '#1a8fff' },
  failed: { bg: 'rgba(239,68,68,0.12)', text: '#f87171' },
  refunded: { bg: 'rgba(100,116,139,0.10)', text: '#64748b' },
  cancelled: { bg: 'rgba(100,116,139,0.10)', text: '#64748b' },
}
function statusColor(s: string) {
  return STATUS_COLORS[s] ?? { bg: 'rgba(100,116,139,0.10)', text: '#64748b' }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}

watch(expanded, async (val) => {
  if (val && !detail.value) {
    loading.value = true
    try {
      detail.value = await api.get(props.payment.uuid)
    } catch {
      detail.value = null
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="bg-glass border border-line rounded-xl overflow-hidden">
    <button
      class="w-full flex items-center gap-3 px-3 py-2.5 text-left border-none bg-transparent cursor-pointer hover:bg-glass-hover transition-colors"
      @click="expanded = !expanded"
    >
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-medium text-ink truncate">
          {{ payment.user_email }}
        </p>
        <p class="text-[10px] text-ink-4 truncate">
          {{ payment.tour_name }} · {{ formatDate(payment.payment_date ?? payment.created_at) }}
        </p>
      </div>
      <p class="text-[12px] font-semibold text-ink flex-shrink-0">
        {{ payment.amount }} {{ payment.currency }}
      </p>
      <span
        class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize"
        :style="{ background: statusColor(payment.status).bg, color: statusColor(payment.status).text }"
      >
        {{ payment.status }}
      </span>
      <svg
        class="flex-shrink-0 text-ink-4 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div
      v-if="expanded"
      class="border-t border-line px-3 py-2.5 space-y-1.5"
    >
      <div
        v-if="loading"
        class="flex justify-center py-2"
      >
        <svg
          class="animate-spin text-ink-4"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="3"
            stroke-dasharray="40 22"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <template v-else-if="detail">
        <p class="text-[11px] text-ink-3">
          {{ detail.user_full_name }}
        </p>
        <p
          v-if="detail.subscription_plan"
          class="text-[11px] text-ink-3"
        >
          Plan: {{ detail.subscription_plan }}
        </p>
        <p
          v-if="detail.authorization_code"
          class="text-[11px] text-ink-4"
        >
          Código: {{ detail.authorization_code }}
        </p>
        <p
          v-if="detail.notes"
          class="text-[11px] text-ink-4"
        >
          {{ detail.notes }}
        </p>

        <button
          v-if="detail.status === 'completed'"
          class="mt-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-4 hover:text-red-400 hover:border-red-400/30 cursor-pointer transition-colors"
          @click="emit('refund')"
        >
          Reembolsar
        </button>
      </template>
    </div>
  </div>
</template>
