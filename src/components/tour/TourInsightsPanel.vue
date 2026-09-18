<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTourInsights, type TourInsights } from '@/composables/useTourInsights'

const props = defineProps<{ tourUuid: string }>()
const { t } = useI18n()
const api = useTourInsights()

const insights = ref<TourInsights | null>(null)
const loading = ref(false)
const error = ref('')

const stats = computed(() => {
  if (!insights.value) return []
  return [
    { label: t('tourHub.insights.members'), value: insights.value.members_count },
    { label: t('tourHub.insights.shows'), value: insights.value.shows_count },
    { label: t('tourHub.insights.events'), value: insights.value.events_count },
    { label: t('tourHub.insights.activities'), value: insights.value.activities_count },
    { label: t('tourHub.insights.activeConflicts'), value: insights.value.schedule_conflicts_active },
    { label: t('tourHub.insights.walletPasses'), value: insights.value.wallet_passes_count },
  ]
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    insights.value = await api.getInsights(props.tourUuid)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('tourHub.insights.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.tourUuid, load)
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="flex items-center justify-center py-16"
    >
      <svg
        class="animate-spin text-ink-4"
        width="20"
        height="20"
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

    <div
      v-else-if="error"
      class="py-10 text-center"
    >
      <p class="text-[12px] text-red-400 mb-2">
        {{ error }}
      </p>
      <button
        class="text-[11px] text-ink-3 hover:text-ink cursor-pointer border-none bg-transparent underline"
        @click="load"
      >
        Reintentar
      </button>
    </div>

    <template v-else-if="insights">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div
          v-for="s in stats"
          :key="s.label"
          class="bg-bg-3 border border-line rounded-lg shadow-[0_1px_3px_var(--shadow-sm)] p-4"
        >
          <p class="text-[22px] font-bold text-ink leading-none mb-1.5">
            {{ s.value }}
          </p>
          <p class="text-[10px] text-ink-3 uppercase tracking-[0.5px]">
            {{ s.label }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="bg-bg-3 border border-line rounded-lg shadow-[0_1px_3px_var(--shadow-sm)] p-5">
          <p class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase mb-3">
            {{ t('tourHub.insights.activities') }} · {{ t('tourHub.insights.byStatus') }}
          </p>
          <div
            v-if="Object.keys(insights.activities_by_status).length"
            class="space-y-2"
          >
            <div
              v-for="[status, count] in Object.entries(insights.activities_by_status)"
              :key="status"
              class="flex items-center justify-between text-[12px]"
            >
              <span class="text-ink-2 capitalize">{{ status }}</span>
              <span class="font-semibold text-ink">{{ count }}</span>
            </div>
          </div>
          <p
            v-else
            class="text-[11px] text-ink-4"
          >
            —
          </p>
        </div>

        <div class="bg-bg-3 border border-line rounded-lg shadow-[0_1px_3px_var(--shadow-sm)] p-5">
          <p class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase mb-3">
            {{ t('tourHub.insights.walletPasses') }} · {{ t('tourHub.insights.byStatus') }}
          </p>
          <div
            v-if="Object.keys(insights.wallet_passes_by_status).length"
            class="space-y-2"
          >
            <div
              v-for="[status, count] in Object.entries(insights.wallet_passes_by_status)"
              :key="status"
              class="flex items-center justify-between text-[12px]"
            >
              <span class="text-ink-2 capitalize">{{ status }}</span>
              <span class="font-semibold text-ink">{{ count }}</span>
            </div>
          </div>
          <p
            v-else
            class="text-[11px] text-ink-4"
          >
            —
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
