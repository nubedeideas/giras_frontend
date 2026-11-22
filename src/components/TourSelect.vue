<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { useToursStore } from '@/stores/tours'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { tourBadge } from '@/utils/statusBadge'
import type { TourStatus } from '@/types'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ toggle: [rect: DOMRect] }>()

const { t, locale } = useI18n()
const toursStore = useToursStore()

const tour = computed(() => toursStore.activeTour ?? null)

const STATUS_KEYS: Record<TourStatus, string> = {
  active: 'tours.statusActive',
  draft: 'tours.statusDraft',
  completed: 'tours.statusCompleted',
  cancelled: 'tours.statusCancelled',
}

const statusLabel = computed(() =>
  tour.value ? t(STATUS_KEYS[tour.value.status] ?? 'tours.statusDraft') : ''
)

const ariaLabel = computed(() =>
  tour.value
    ? t('header.tourSelect', {
      tour: `${tour.value.artist_name} · ${tour.value.name}`,
      status: statusLabel.value,
    })
    : t('header.tourSelectNone')
)

// Rango de fechas de la gira (lo que antes enseñaba la franja de gira), en el title.
const dateRange = computed(() => {
  if (!tour.value) return undefined
  const loc = locale.value === 'es' ? 'es-ES' : 'en-GB'
  const fmt = (iso: string) => {
    const d = DateTime.fromISO(iso)
    return d.isValid ? d.setLocale(loc).toLocaleString(DateTime.DATE_MED) : ''
  }
  const start = fmt(tour.value.start_date)
  const end = fmt(tour.value.end_date)
  if (!start && !end) return undefined
  return start && end ? `${start} – ${end}` : start || end
})

function onClick(e: MouseEvent) {
  emit('toggle', (e.currentTarget as HTMLElement).getBoundingClientRect())
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 h-11 lg:h-9 px-3 min-w-0 rounded-full bg-night text-on-night border border-night-line cursor-pointer transition-colors hover:bg-night-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive focus-visible:ring-offset-2"
    :aria-expanded="open"
    aria-haspopup="dialog"
    :aria-label="ariaLabel"
    :title="dateRange"
    data-test="tour-select"
    @click="onClick"
  >
    <template v-if="tour">
      <span
        class="w-[10px] h-[10px] rounded-full flex-shrink-0"
        data-test="tour-select-dot"
        :style="{ background: tour.color }"
      />
      <span
        class="sm:hidden text-[14px] font-semibold truncate max-w-[120px]"
        data-test="tour-select-mobile"
      >{{ tour.artist_name }}</span>
      <span
        class="hidden sm:inline text-[14px] font-semibold truncate max-w-[280px]"
        data-test="tour-select-desktop"
      >{{ tour.artist_name }} · {{ tour.name }}</span>
      <StatusBadge
        class="hidden sm:inline-flex"
        :status="tourBadge(tour.status)"
        :label="statusLabel"
        size="sm"
      />
    </template>
    <span
      v-else
      class="text-[14px] font-semibold truncate max-w-[120px] sm:max-w-[280px]"
    >{{ t('tours.allTours') }}</span>
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="flex-shrink-0 text-on-night-muted transition-transform duration-200"
      :class="open ? 'rotate-180' : ''"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
</template>
