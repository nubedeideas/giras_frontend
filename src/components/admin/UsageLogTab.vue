<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAdminNotificationUsage, type NotificationUsageEntry } from '@/composables/useAdminNotificationUsage'
import type { PlanCode } from '@/composables/useAdminSubscriptions'
import UsageLogCard from '@/components/admin/UsageLogCard.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'

const api = useAdminNotificationUsage()
const items = ref<NotificationUsageEntry[]>([])
const count = ref(0)
const next = ref<string | null>(null)
const previous = ref<string | null>(null)
const loading = ref(false)
const search = ref('')
const planCode = ref<PlanCode | ''>('')

async function load(url?: string) {
  loading.value = true
  try {
    const data = await api.list(url ?? { search: search.value, plan_code: planCode.value || undefined })
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

let debounce: ReturnType<typeof setTimeout>
watch([search, planCode], () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(), 300)
})

onMounted(() => load())
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 pt-4 pb-3 border-b border-line flex-shrink-0">
      <p class="text-base font-bold text-ink tracking-[-0.2px] mb-3">Log de uso de notificaciones</p>
      <div class="flex gap-2">
        <div class="flex-1 flex items-center gap-[7px] bg-glass border border-line rounded-sm px-[11px] py-[7px]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4 flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input v-model="search" placeholder="Buscar por cliente o gira…" class="flex-1 bg-transparent border-none outline-none text-ink text-[12px] placeholder:text-ink-4" />
        </div>
        <select v-model="planCode" class="bg-glass border border-line rounded-sm px-3 py-1.5 text-[11px] text-ink-2 outline-none cursor-pointer">
          <option value="">Todos los planes</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="premium">Premium</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
      <div v-if="loading" class="flex justify-center py-8">
        <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round" />
        </svg>
      </div>
      <p v-else-if="items.length === 0" class="text-center py-8 text-ink-4 text-xs">Sin resultados</p>
      <UsageLogCard v-for="entry in items" :key="entry.uuid" :entry="entry" />
    </div>

    <AdminPagination :count="count" :next="next" :previous="previous" @next="load(next!)" @prev="load(previous!)" />
  </div>
</template>
