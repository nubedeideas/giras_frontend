<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { useCalendarStore } from '@/stores/calendar'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import type { ActivityListItem } from '@/composables/useActivities'
import CalendarActivityListPanel from '@/components/calendar/CalendarActivityListPanel.vue'
import TourSelectPrompt from '@/components/tour/TourSelectPrompt.vue'

const { t, tm } = useI18n()
const cal = useCalendarStore()
const tours = useToursStore()
const auth = useAuthStore()
const reminderCatalog = useReminderCatalogStore()

// tm() (not t()) is required for `calendar.days`/`calendar.months` — they're arrays, and t()
// only resolves compiled string leaves, returning the key itself unresolved
// when it points at an array (see SupportView.vue for the same gotcha).
const weekdays = computed(() => tm('calendar.days') as unknown as string[])
const months = computed(() => tm('calendar.months') as unknown as string[])

// Catálogo de recordatorios (solo admins; el endpoint da 403 al resto). Sin catálogo,
// `notifiableCodes` está vacío y todos los chips se pintan como "normal".
watch(
  () => [tours.activeTour?.uuid, tours.activeTour?.current_user_is_admin, auth.isDemoMode] as const,
  ([uuid, isAdmin, demo]) => {
    if (uuid && isAdmin && !demo) reminderCatalog.load(uuid)
    else reminderCatalog.reset()
  },
  { immediate: true }
)

function isNotifiable(act: ActivityListItem): boolean {
  return act.status !== 'cancelled' && reminderCatalog.notifiableCodes.has(act.activity_type_code)
}

// Hora local de la actividad (`local_start_time`, posiciones 11-16); si no viene, la del navegador.
function chipTime(act: ActivityListItem): string {
  if (act.all_day) return ''
  if (act.local_start_time && act.local_start_time.length >= 16) {
    return act.local_start_time.substring(11, 16)
  }
  const dt = DateTime.fromISO(act.scheduled_at)
  return dt.isValid ? dt.toFormat('HH:mm') : ''
}

function chipClass(act: ActivityListItem): string {
  if (isNotifiable(act)) return 'bg-night text-on-night'
  // Contorno de "importado" solo si el listado trae `external_source` (hoy no; spec §11.1).
  const border = act.external_source ? 'border-ink-3' : 'border-line'
  const text = act.status === 'cancelled' ? 'line-through text-ink-2' : 'text-ink'
  return `bg-bg-2 border ${border} ${text}`
}
</script>

<template>
  <div
    class="flex-1 min-w-0 flex flex-col overflow-hidden bg-bg-3 m-3 lg:my-3 lg:ml-3 lg:mr-1.5 rounded-2xl border border-line shadow-[0_4px_20px_var(--shadow-sm)]"
  >
    <!-- No tour selected — same picker as Tour/Events/Contacts, replacing the
    whole card (header included, since its own tour <select> below would
    otherwise duplicate this) -->
    <TourSelectPrompt v-if="!tours.activeTourId" />

    <template v-else>
      <!-- Calendar header -->
      <div class="px-6 pt-5 pb-4 border-b border-line flex-shrink-0">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <Transition
            name="fade"
            mode="out-in"
          >
            <div
              v-if="cal.viewMode === 'grid'"
              key="grid-title"
              class="flex items-center gap-3"
            >
              <h2 class="text-base font-bold text-ink tracking-[-0.2px]">
                {{ months[cal.currentMonth] }} {{ cal.currentYear }}
              </h2>
              <div class="flex gap-1">
                <button
                  class="flex items-center justify-center w-11 h-11 lg:w-7 lg:h-7 rounded-lg border border-line bg-bg-3 text-ink-2 hover:bg-glass-hover hover:text-ink transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
                  @click="cal.prevMonth()"
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  class="flex items-center justify-center w-11 h-11 lg:w-7 lg:h-7 rounded-lg border border-line bg-bg-3 text-ink-2 hover:bg-glass-hover hover:text-ink transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
                  @click="cal.nextMonth()"
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
            <h2
              v-else
              key="list-title"
              class="text-base font-bold text-ink tracking-[-0.2px]"
            >
              {{ t('calendar.viewList') }}
            </h2>
          </Transition>

          <div class="flex items-center gap-2">
            <!-- View mode toggle -->
            <div class="flex items-center gap-1 bg-glass-hover rounded-[10px] p-1">
              <button
                class="min-h-[44px] lg:min-h-[32px] px-2.5 py-1 rounded-[7px] text-[13px] transition-colors cursor-pointer border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
                :class="cal.viewMode === 'grid' ? 'bg-bg-3 text-ink shadow-sm font-semibold' : 'bg-transparent text-ink-2 hover:text-ink'"
                @click="cal.viewMode = 'grid'"
              >
                {{ t('calendar.viewGrid') }}
              </button>
              <button
                class="min-h-[44px] lg:min-h-[32px] px-2.5 py-1 rounded-[7px] text-[13px] transition-colors cursor-pointer border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
                :class="cal.viewMode === 'list' ? 'bg-bg-3 text-ink shadow-sm font-semibold' : 'bg-transparent text-ink-2 hover:text-ink'"
                @click="cal.viewMode = 'list'"
              >
                {{ t('calendar.viewList') }}
              </button>
            </div>

            <!-- Tour filter -->
            <select
              class="min-h-[44px] lg:min-h-0 bg-bg-3 border border-line rounded-sm px-3 py-1.5 text-[13px] text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-olive cursor-pointer"
              :value="cal.filterTourId ?? ''"
              @change="cal.setFilterTour(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option value="">
                {{ t('calendar.allTours') }}
              </option>
              <option
                v-for="tour in tours.activeTours"
                :key="tour.id"
                :value="tour.id"
              >
                {{ tour.artist_name }} — {{ tour.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Day headers -->
        <Transition name="fade">
          <div
            v-if="cal.viewMode === 'grid'"
            class="grid grid-cols-7 gap-1"
          >
            <div
              v-for="day in weekdays"
              :key="String(day)"
              class="text-center text-[12px] font-bold text-ink-2 tracking-[0.5px] uppercase py-1"
            >
              {{ day }}
            </div>
          </div>
        </Transition>
      </div>

      <!-- Calendar grid / activities list -->
      <Transition
        name="fade"
        mode="out-in"
      >
        <div
          v-if="cal.viewMode === 'grid'"
          key="grid-body"
          class="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-3"
        >
          <div class="grid grid-cols-7 gap-0.5 sm:gap-1">
            <div
              v-for="cell in cal.daysGrid"
              :key="cell.isoDate"
              class="min-h-[72px] min-w-0 overflow-hidden rounded-lg p-0.5 sm:p-1 lg:p-1.5 cursor-pointer transition-all duration-150 border"
              :class="[
                cal.selectedDate === cell.isoDate
                  ? 'bg-bg-3 border-ink ring-1 ring-ink'
                  : cell.isToday
                    ? 'bg-lime-soft border-olive'
                    : cell.isCurrentMonth
                      ? 'bg-bg-3 border-line hover:border-line-2'
                      : 'bg-transparent border-transparent hover:border-line-2',
              ]"
              :data-today="cell.isToday ? 'true' : undefined"
              @click="cal.selectDate(cell.isoDate)"
            >
              <!-- Day number -->
              <div class="flex items-center justify-between gap-1 mb-1 min-w-0">
                <span
                  class="text-[14px] font-time tnum"
                  :class="
                    cell.isToday
                      ? 'text-olive font-bold'
                      : cell.isCurrentMonth
                        ? 'text-ink-2 font-medium'
                        : 'text-ink-3 font-medium'
                  "
                >
                  {{ cell.dayNum }}
                </span>
                <span
                  v-if="cell.isToday"
                  class="hidden sm:inline text-[11px] font-bold text-olive tracking-[0.5px] uppercase truncate"
                >
                  {{ t('calendar.today') }}
                </span>
              </div>

              <!-- Activity chips -->
              <div class="flex flex-col gap-0.5 min-w-0">
                <div
                  v-for="act in cell.activities.slice(0, 3)"
                  :key="act.uuid"
                  class="flex items-center gap-1 min-w-0 overflow-hidden px-1 lg:px-1.5 py-0.5 rounded text-[12px] font-medium"
                  :class="chipClass(act)"
                  :title="isNotifiable(act) ? `${act.title} · ${t('calendar.notifiable')}` : act.title"
                  :data-notifiable="isNotifiable(act) ? 'true' : undefined"
                  data-test="calendar-chip"
                >
                  <span
                    v-if="!isNotifiable(act)"
                    class="w-[6px] h-[6px] rounded-full flex-shrink-0"
                    :style="{ backgroundColor: act.activity_type_color }"
                  />
                  <span
                    v-if="chipTime(act)"
                    class="hidden xl:inline font-time tnum flex-shrink-0"
                    :class="isNotifiable(act) ? 'text-acid' : 'text-ink-2'"
                    data-test="calendar-chip-time"
                  >{{ chipTime(act) }}</span>
                  <span class="truncate min-w-0">{{ act.title }}</span>
                </div>
                <div
                  v-if="cell.activities.length > 3"
                  class="text-[12px] text-ink-2 px-1 truncate"
                  data-test="calendar-more"
                >
                  {{ t('calendar.moreCount', { n: cell.activities.length - 3 }) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Activities list (chronological, grouped by day) -->
        <CalendarActivityListPanel
          v-else
          key="list-body"
        />
      </Transition>
    </template>
  </div>
</template>
