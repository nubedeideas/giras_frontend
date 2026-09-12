<script setup lang="ts">
import { ref, watch } from 'vue'
import { useToursStore } from '@/stores/tours'
import { useSubscription, type SubscriptionUsage } from '@/composables/useSubscription'
import { useUIState } from '@/composables/useUIState'

const tours = useToursStore()
const api = useSubscription()
const { openSettings } = useUIState()

const usage = ref<SubscriptionUsage | null>(null)
const dismissedTourUuid = ref<string | null>(null)

watch(
  () => tours.activeTour?.uuid,
  async (tourUuid) => {
    usage.value = null
    if (!tourUuid) return
    try {
      usage.value = await api.usage(tourUuid)
    } catch {
      usage.value = null
    }
  },
  { immediate: true },
)

function dismiss() {
  dismissedTourUuid.value = tours.activeTour?.uuid ?? null
}

function goToSubscription() {
  openSettings('subscription')
}
</script>

<template>
  <div
    v-if="usage && !usage.is_unlimited && usage.usage_percentage >= 90 && dismissedTourUuid !== tours.activeTour?.uuid"
    class="flex-shrink-0 flex items-center gap-2.5 px-4 py-1.5 border-b"
    style="background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.2)"
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
    <p class="text-[11px] flex-1 min-w-0" style="color: #f87171">
      Esta gira usó el {{ usage.usage_percentage }}% de sus notificaciones del plan {{ usage.plan_name }}.
    </p>
    <button
      class="text-[10px] font-bold px-2 py-1 rounded-md cursor-pointer border-none flex-shrink-0"
      style="background: rgba(239,68,68,0.15); color: #f87171"
      @click="goToSubscription"
    >
      Cambiar plan
    </button>
    <button
      class="flex items-center justify-center w-[18px] h-[18px] rounded border-none bg-transparent cursor-pointer opacity-50 hover:opacity-90 flex-shrink-0"
      style="color: #f87171"
      title="Ocultar"
      @click="dismiss"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
</template>
