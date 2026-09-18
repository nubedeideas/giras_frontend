<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  useAdminSubscriptions,
  type Subscription,
  type SubscriptionStatus,
  type PlanCode,
  type SubscriptionStats,
} from '@/composables/useAdminSubscriptions'
import SubscriptionCard from '@/components/admin/SubscriptionCard.vue'
import SubscriptionStatsPanel from '@/components/admin/SubscriptionStatsPanel.vue'
import ChangeSubscriptionPlanModal from '@/components/admin/ChangeSubscriptionPlanModal.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'

const api = useAdminSubscriptions()
const items = ref<Subscription[]>([])
const count = ref(0)
const next = ref<string | null>(null)
const previous = ref<string | null>(null)
const loading = ref(false)
const search = ref('')
const status = ref<SubscriptionStatus | ''>('')
const planCode = ref<PlanCode | ''>('')
const changingPlan = ref<Subscription | null>(null)
const stats = ref<SubscriptionStats | null>(null)

async function load(url?: string) {
  loading.value = true
  try {
    const data = await api.list(
      url ?? { search: search.value, status: status.value || undefined, plan__code: planCode.value || undefined },
    )
    items.value = data.results
    count.value = data.count
    next.value = data.next
    previous.value = data.previous
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await api.stats()
  } catch {
    stats.value = null
  }
}

let debounce: ReturnType<typeof setTimeout>
watch([search, status, planCode], () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(), 300)
})

function refreshAll() {
  load()
  loadStats()
}

onMounted(() => {
  load()
  loadStats()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto px-4 pt-4">
      <SubscriptionStatsPanel
        v-if="stats"
        :stats="stats"
      />

      <div class="mb-3">
        <p class="text-base font-bold text-ink tracking-[-0.2px] mb-3">
          Suscripciones
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
              placeholder="Buscar por gira o cliente…"
              class="flex-1 bg-transparent border-none outline-none text-ink text-[12px] placeholder:text-ink-4"
            >
          </div>
          <select
            v-model="status"
            class="bg-glass border border-line rounded-sm px-3 py-1.5 text-[11px] text-ink-2 outline-none cursor-pointer"
          >
            <option value="">
              Todos los estados
            </option>
            <option value="pending">
              Pendiente
            </option>
            <option value="active">
              Activa
            </option>
            <option value="cancelled">
              Cancelada
            </option>
          </select>
          <select
            v-model="planCode"
            class="bg-glass border border-line rounded-sm px-3 py-1.5 text-[11px] text-ink-2 outline-none cursor-pointer"
          >
            <option value="">
              Todos los planes
            </option>
            <option value="free">
              Free
            </option>
            <option value="starter">
              Starter
            </option>
            <option value="premium">
              Premium
            </option>
            <option value="custom">
              Custom
            </option>
          </select>
        </div>
      </div>

      <div class="space-y-1.5 pb-2">
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
          v-else-if="items.length === 0"
          class="text-center py-8 text-ink-4 text-xs"
        >
          Sin resultados
        </p>
        <SubscriptionCard
          v-for="s in items"
          :key="s.uuid"
          :subscription="s"
          @refresh="refreshAll"
          @change-plan="changingPlan = s"
        />
      </div>
    </div>

    <AdminPagination
      :count="count"
      :next="next"
      :previous="previous"
      @next="load(next!)"
      @prev="load(previous!)"
    />

    <ChangeSubscriptionPlanModal
      :show="!!changingPlan"
      :subscription="changingPlan"
      @close="changingPlan = null"
      @saved="refreshAll"
    />
  </div>
</template>
