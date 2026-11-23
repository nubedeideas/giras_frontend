<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { useCalendarStore } from '@/stores/calendar'
import { useToursStore } from '@/stores/tours'
import type { ActivityListItem } from '@/composables/useActivities'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

const emit = defineEmits<{ add: [] }>()

const { t, locale } = useI18n()
const cal = useCalendarStore()
const toursStore = useToursStore()

// Altas solo para admins de la gira. Sin gira activa la vista sigue el camino de "Agregar" de
// Actividades (elegir gira y después el modal de alta).
const canAdd = computed(
  () => !toursStore.activeTour || toursStore.activeTour.current_user_is_admin === true
)

// Día seleccionado en la zona de la gira, p. ej. "mié 3 dic" / "Wed 3 Dec".
const selectedDateLabel = computed(() => {
  if (!cal.selectedDate) return ''
  const dt = DateTime.fromISO(cal.selectedDate, { zone: cal.zone }).setLocale(locale.value)
  return dt.isValid ? dt.toFormat('ccc d LLL') : ''
})

function formatTime(iso: string): string {
  const dt = DateTime.fromISO(iso, { zone: cal.zone })
  return dt.isValid ? dt.toFormat('HH:mm') : ''
}

function timeLabel(act: ActivityListItem): string {
  return act.all_day ? t('calendar.allDay') : formatTime(act.scheduled_at)
}
</script>

<template>
  <div
    class="flex-1 min-h-0 m-3 lg:my-3 lg:ml-1.5 lg:mr-3 bg-bg-3 rounded-2xl border border-line shadow-[0_4px_20px_var(--shadow-sm)] flex flex-col overflow-hidden"
  >
    <!-- Header -->
    <div class="px-4 pt-5 pb-3 border-b border-line flex-shrink-0 flex items-center justify-between">
      <p class="text-[15px] font-bold text-ink">
        {{ t('calendar.upcoming') }}
      </p>
      <BtnPrimary
        v-if="canAdd"
        small
        type="button"
        data-test="calendar-add"
        @click="emit('add')"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
          /><line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          />
        </svg>
        {{ t('calendar.addEvent') }}
      </BtnPrimary>
    </div>

    <!-- Selected day -->
    <div
      v-if="cal.selectedDate"
      class="border-b border-line flex-shrink-0"
      data-test="calendar-day"
    >
      <div class="px-4 py-2 bg-acid-dim">
        <p
          class="text-[13px] font-bold text-olive font-time tnum"
          data-test="calendar-day-label"
        >
          {{ selectedDateLabel }}
        </p>
      </div>
      <div
        v-if="cal.activitiesForSelectedDate.length > 0"
        class="px-3 py-2"
      >
        <div
          v-for="act in cal.activitiesForSelectedDate"
          :key="act.uuid"
          class="flex items-center gap-2.5 p-2.5 min-h-[44px] rounded-lg border border-line-acid bg-glass-active mb-1.5 cursor-pointer"
          data-test="calendar-day-activity"
          @click="cal.openActivity(act)"
        >
          <div
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: act.activity_type_color }"
          />
          <div class="flex-1 min-w-0">
            <p class="text-[14px] font-semibold text-ink truncate">
              {{ act.title }}
            </p>
            <p class="text-[12px] text-ink-3">
              <span
                :class="act.all_day ? '' : 'font-time tnum'"
                data-test="calendar-activity-time"
              >{{ timeLabel(act) }}</span><span v-if="act.location_name"> · {{ act.location_name }}</span>
            </p>
          </div>
        </div>
      </div>
      <div
        v-else
        class="px-4 py-5 flex flex-col items-center gap-3 text-center"
        data-test="calendar-day-empty"
      >
        <p class="text-[14px] text-ink-2">
          {{ t('calendar.noDayActivities') }}
        </p>
        <BtnSecondary
          v-if="canAdd"
          small
          type="button"
          data-test="calendar-day-add"
          @click="emit('add')"
        >
          {{ t('calendar.addEvent') }}
        </BtnSecondary>
      </div>
    </div>

    <!-- All upcoming activities -->
    <div class="flex-1 overflow-y-auto px-3 py-2">
      <div
        v-for="act in cal.upcomingActivities"
        :key="act.uuid"
        class="flex items-center gap-2.5 px-2.5 py-2 min-h-[44px] rounded-lg border border-line bg-bg-3 cursor-pointer transition-all duration-150 hover:border-line-2 mb-1.5"
        data-test="calendar-upcoming-activity"
        @click="cal.openActivity(act)"
      >
        <div
          class="w-2 h-2 rounded-full flex-shrink-0"
          :style="{ backgroundColor: act.activity_type_color }"
        />
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-medium text-ink truncate">
            {{ act.title }}
          </p>
          <p class="text-[12px] text-ink-3">
            <span
              :class="act.all_day ? '' : 'font-time tnum'"
              data-test="calendar-activity-time"
            >{{ timeLabel(act) }}</span><span v-if="act.location_name"> · {{ act.location_name }}</span>
          </p>
        </div>
      </div>

      <div
        v-if="cal.upcomingActivities.length === 0"
        class="text-center py-8 text-ink-2 text-[14px]"
      >
        {{ t('calendar.noEvents') }}
      </div>
    </div>
  </div>
</template>
