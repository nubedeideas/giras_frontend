<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToursStore } from '@/stores/tours'
import type { TourStatus } from '@/types'

const toursStore = useToursStore()
const { locale, t } = useI18n()

const STATUS_LABEL: Record<TourStatus, string> = {
  draft: 'tours.statusDraft',
  active: 'tours.statusActive',
  completed: 'tours.statusCompleted',
  cancelled: 'tours.statusCancelled',
}

const STATUS_COLOR: Record<TourStatus, string> = {
  draft: '#50505e',
  active: '#a8d800',
  completed: '#1a8fff',
  cancelled: '#e85d00',
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(locale.value === 'es' ? 'es-MX' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const tour = computed(() => toursStore.activeTour)

const dateRange = computed(() => {
  if (!tour.value) return ''
  return `${formatDate(tour.value.start_date)} – ${formatDate(tour.value.end_date)}`
})
</script>

<template>
  <Transition name="tb">
    <div
      v-if="tour"
      class="sidebar-dark flex-shrink-0 flex items-center gap-2.5 px-4 border-b"
      style="padding-top: 6px; padding-bottom: 6px"
      :style="{
        background: `color-mix(in srgb, ${tour.color} 8%, transparent)`,
        borderColor: `color-mix(in srgb, ${tour.color} 30%, transparent)`,
      }"
    >
      <!-- Route icon -->
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        :style="{ color: tour.color, opacity: '0.65' }"
        class="flex-shrink-0"
      >
        <circle cx="6" cy="19" r="3" />
        <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
        <circle cx="18" cy="5" r="3" />
      </svg>

      <!-- Artist + name -->
      <span
        class="text-[11px] font-bold leading-none flex-shrink-0"
        :style="{ color: tour.color }"
      >
        {{ tour.artist_name }}
      </span>
      <span
        class="text-[11px] font-medium leading-none flex-shrink-0"
        :style="{ color: tour.color, opacity: '0.75' }"
      >
        — {{ tour.name }}
      </span>

      <!-- Dot separator -->
      <div
        class="w-[3px] h-[3px] rounded-full flex-shrink-0"
        :style="{ background: tour.color, opacity: '0.35' }"
      />

      <!-- Date range -->
      <span
        class="text-[10px] leading-none flex-shrink-0"
        :style="{ color: tour.color, opacity: '0.6' }"
      >
        {{ dateRange }}
      </span>

      <div class="flex-1 min-w-0" />

      <!-- Status badge -->
      <span
        class="text-[9px] font-bold tracking-[0.4px] uppercase px-[7px] py-[3px] rounded-full flex-shrink-0"
        :style="{
          background: `color-mix(in srgb, ${STATUS_COLOR[tour.status]} 18%, transparent)`,
          color: STATUS_COLOR[tour.status],
        }"
      >
        {{ t(STATUS_LABEL[tour.status]) }}
      </span>

      <!-- Deselect -->
      <button
        class="flex items-center justify-center w-[18px] h-[18px] rounded border-none bg-transparent cursor-pointer transition-opacity opacity-40 hover:opacity-90 flex-shrink-0"
        :style="{ color: tour.color }"
        :title="t('tours.allTours')"
        @click="toursStore.setActiveTour(null)"
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.tb-enter-active {
  transition:
    max-height 0.2s ease,
    opacity 0.2s ease;
  overflow: hidden;
}
.tb-leave-active {
  transition:
    max-height 0.15s ease,
    opacity 0.12s ease;
  overflow: hidden;
}
.tb-enter-from,
.tb-leave-to {
  max-height: 0;
  opacity: 0;
}
.tb-enter-to,
.tb-leave-from {
  max-height: 40px;
}
</style>
