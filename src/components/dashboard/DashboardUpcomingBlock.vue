<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DateTime } from 'luxon'
import { RouterLink, useRouter } from 'vue-router'
import DashboardBlock from './DashboardBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useActivitiesStore } from '@/stores/activities'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { STATUS_LABELS, type ActivityListItem } from '@/composables/useActivities'
import { activityBadge } from '@/utils/statusBadge'
import { activityLocalTime, ongoingUuids, relativeDay, upcomingWithin } from '@/utils/dashboard'

/**
 * "Próximas 24 h": lee las actividades del store compartido (las carga la vista o el propio
 * store al cambiar de gira); no hace peticiones propias salvo "Reintentar".
 */
const props = defineProps<{ now: DateTime }>()

const MAX_ROWS = 8

const { t } = useI18n()
const router = useRouter()
const store = useActivitiesStore()
const tours = useToursStore()
const auth = useAuthStore()

// En demo no hay carga de la API: lo que tenga el store es de la gira activa.
const current = computed(
  () => auth.isDemoMode || store.loadedTourUuid === (tours.activeTour?.uuid ?? null)
)
const all = computed(() => (current.value ? upcomingWithin(store.activities, props.now) : []))
const rows = computed(() => all.value.slice(0, MAX_ROWS))
const ongoing = computed(() =>
  current.value ? ongoingUuids(store.activities, props.now) : new Set<string>()
)
const error = computed(() => !store.loading && !!store.error)
// Mientras el store no tenga las actividades de esta gira, cargando (nunca un falso "vacío").
const loading = computed(() => !current.value && !error.value)

function dayLabel(a: ActivityListItem): string {
  const d = relativeDay(a, props.now)
  return d ? t(`dashboard.upcoming.${d}`) : ''
}

function open(a: ActivityListItem) {
  void router.push({ path: '/events', query: { activity: a.uuid } })
}
</script>

<template>
  <DashboardBlock
    :title="t('dashboard.upcoming.title')"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && rows.length === 0"
    data-testid="dashboard-upcoming"
    @retry="store.loadActivities()"
  >
    <template #action>
      <RouterLink
        to="/events"
        class="inline-flex items-center min-h-[44px] lg:min-h-0 px-1 text-[14px] font-semibold text-olive hover:text-olive-strong no-underline"
      >
        {{ t('dashboard.upcoming.viewAll') }}
      </RouterLink>
    </template>

    <template #empty>
      <p class="min-h-[44px] flex items-center text-[15px] text-ink-2">
        {{ t('dashboard.upcoming.empty') }}
      </p>
    </template>

    <ul class="flex flex-col divide-y divide-line">
      <li
        v-for="a in rows"
        :key="a.uuid"
      >
        <button
          type="button"
          data-testid="upcoming-row"
          class="w-full flex items-center gap-3 py-2.5 min-h-[44px] text-left bg-transparent border-none cursor-pointer rounded-sm hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
          @click="open(a)"
        >
          <span class="w-[60px] flex-shrink-0 flex flex-col">
            <span
              v-if="a.all_day"
              class="text-[13px] font-semibold text-ink leading-tight"
              data-testid="upcoming-time"
            >{{ t('dashboard.upcoming.allDay') }}</span>
            <span
              v-else
              class="font-time tnum text-[15px] text-ink leading-tight"
              data-testid="upcoming-time"
            >{{ activityLocalTime(a) }}</span>
            <span class="text-[12px] text-ink-3">{{ dayLabel(a) }}</span>
          </span>
          <span
            class="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 bg-bg-2 border border-line"
            aria-hidden="true"
          >
            <span
              class="w-[8px] h-[8px] rounded-full"
              :style="{ background: a.activity_type_color }"
            />
          </span>
          <span class="flex-1 min-w-0 flex flex-col">
            <span class="text-[15px] font-semibold text-ink truncate">{{ a.title }}</span>
            <span class="text-[13px] text-ink-2 truncate">
              {{ a.activity_type_name }}<template v-if="a.location_name"> · {{ a.location_name }}</template>
            </span>
          </span>
          <span class="flex-shrink-0 hidden min-[400px]:inline-flex">
            <StatusBadge
              v-if="ongoing.has(a.uuid)"
              status="sent"
              :label="t('dashboard.upcoming.ongoing')"
              size="sm"
            />
            <StatusBadge
              v-else
              :status="activityBadge(a.status)"
              :label="STATUS_LABELS[a.status]"
              size="sm"
            />
          </span>
        </button>
      </li>
    </ul>
    <RouterLink
      v-if="all.length > rows.length"
      to="/events"
      class="mt-2 inline-flex items-center min-h-[44px] text-[14px] font-semibold text-olive hover:text-olive-strong no-underline"
    >
      {{ t('dashboard.upcoming.viewAll') }} ({{ all.length }})
    </RouterLink>
  </DashboardBlock>
</template>
