<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, onMounted, watch } from 'vue'
import { useAdminPayments, type PaymentListItem } from '@/composables/useAdminPayments'
import PaymentCard from '@/components/admin/PaymentCard.vue'
import RefundPaymentModal from '@/components/admin/RefundPaymentModal.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'

const { t } = useI18n()
const api = useAdminPayments()
const items = ref<PaymentListItem[]>([])
const count = ref(0)
const next = ref<string | null>(null)
const previous = ref<string | null>(null)
const loading = ref(false)
const loadError = ref('')
const search = ref('')
const status = ref('')
const currency = ref('')
const refunding = ref<PaymentListItem | null>(null)

async function load(url?: string) {
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.list(
      url ?? { search: search.value, status: status.value || undefined, currency: currency.value || undefined },
    )
    items.value = data.results
    count.value = data.count
    next.value = data.next
    previous.value = data.previous
  } catch (e) {
    items.value = []
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

let debounce: ReturnType<typeof setTimeout>
watch([search, status, currency], () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(), 300)
})

onMounted(() => load())
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 pt-4 pb-3 border-b border-line flex-shrink-0">
      <p class="text-base font-bold text-ink tracking-[-0.2px] mb-3">
        {{ t('admin.payments.title') }}
      </p>
      <div class="flex gap-2">
        <div class="flex-1 flex items-center gap-[7px] bg-glass border border-line rounded-sm px-[11px] py-[7px]">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-ink-4 flex-shrink-0"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            /><line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
            />
          </svg>
          <input
            v-model="search"
            :placeholder="t('admin.payments.searchPlaceholder')"
            class="flex-1 bg-transparent border-none outline-none text-ink text-[14px] placeholder:text-ink-4"
          >
        </div>
        <select
          v-model="status"
          class="bg-glass border border-line rounded-sm px-3 py-1.5 text-[13px] text-ink-2 outline-none cursor-pointer"
        >
          <option value="">
            {{ t('admin.common.allStatuses') }}
          </option>
          <option value="completed">
            {{ t('admin.paymentStatus.completed') }}
          </option>
          <option value="pending">
            {{ t('admin.paymentStatus.pending') }}
          </option>
          <option value="failed">
            {{ t('admin.paymentStatus.failed') }}
          </option>
          <option value="refunded">
            {{ t('admin.paymentStatus.refunded') }}
          </option>
        </select>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
      <div
        v-if="loading"
        class="flex justify-center py-8"
      >
        <svg
          class="animate-spin text-ink-4"
          width="18"
          height="18"
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
      <p
        v-else-if="loadError"
        class="text-center py-8 text-failed-fg text-[14px]"
      >
        {{ t('admin.common.loadError', { error: loadError }) }}
      </p>
      <p
        v-else-if="items.length === 0"
        class="text-center py-8 text-ink-4 text-[14px]"
      >
        {{ t('admin.common.noResults') }}
      </p>
      <PaymentCard
        v-for="p in items"
        :key="p.uuid"
        :payment="p"
        @refund="refunding = p"
      />
    </div>

    <AdminPagination
      :count="count"
      :next="next"
      :previous="previous"
      @next="load(next!)"
      @prev="load(previous!)"
    />

    <RefundPaymentModal
      :show="!!refunding"
      :payment="refunding"
      @close="refunding = null"
      @refunded="load()"
    />
  </div>
</template>
