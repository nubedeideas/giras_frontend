<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAdminPlans, type Plan } from '@/composables/useAdminPlans'
import PlanCard from '@/components/admin/PlanCard.vue'
import EditPlanModal from '@/components/admin/EditPlanModal.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'

const api = useAdminPlans()
const items = ref<Plan[]>([])
const count = ref(0)
const next = ref<string | null>(null)
const previous = ref<string | null>(null)
const loading = ref(false)
const search = ref('')
const editing = ref<Plan | null>(null)
const showCreate = ref(false)

async function load(url?: string) {
  loading.value = true
  try {
    const data = await api.list(url ?? { search: search.value })
    items.value = data.results.sort((a, b) => a.display_order - b.display_order)
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
watch(search, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(), 300)
})

onMounted(() => load())
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 pt-4 pb-3 border-b border-line flex-shrink-0">
      <div class="flex items-center justify-between mb-3">
        <p class="text-base font-bold text-ink tracking-[-0.2px]">
          Planes
        </p>
        <button
          class="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-sm bg-acid text-black text-[11px] font-bold cursor-pointer"
          @click="showCreate = true"
        >
          + Nuevo plan
        </button>
      </div>
      <p class="text-[11px] text-ink-4 mb-3">
        En la práctica se espera editar los 4 planes base — el código es único, así que crear un plan nuevo con un código ya existente falla.
      </p>
      <div class="flex items-center gap-[7px] bg-glass border border-line rounded-sm px-[11px] py-[7px]">
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
          placeholder="Buscar por nombre o código…"
          class="flex-1 bg-transparent border-none outline-none text-ink text-[12px] placeholder:text-ink-4"
        >
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
        v-else-if="items.length === 0"
        class="text-center py-8 text-ink-4 text-xs"
      >
        Sin resultados
      </p>
      <PlanCard
        v-for="plan in items"
        :key="plan.uuid"
        :plan="plan"
        @edit="editing = plan"
        @deleted="load()"
      />
    </div>

    <AdminPagination
      :count="count"
      :next="next"
      :previous="previous"
      @next="load(next!)"
      @prev="load(previous!)"
    />

    <EditPlanModal
      :show="showCreate || !!editing"
      :plan="editing"
      @close="showCreate = false; editing = null"
      @saved="load()"
    />
  </div>
</template>
