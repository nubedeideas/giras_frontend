<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCalendarStore } from '@/stores/calendar'
import { useToursStore } from '@/stores/tours'

const { t } = useI18n()
const cal = useCalendarStore()
const tours = useToursStore()
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-bg-3">
    <!-- Calendar header -->
    <div class="px-6 pt-5 pb-4 border-b border-line flex-shrink-0">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-base font-bold text-ink tracking-[-0.2px]">
            {{ t(`calendar.months[${cal.currentMonth}]`) }} {{ cal.currentYear }}
          </h2>
          <div class="flex gap-1">
            <button
              class="flex items-center justify-center w-7 h-7 rounded-lg border border-line bg-glass text-ink-2 hover:bg-glass-hover hover:text-ink transition-all duration-200 cursor-pointer"
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
              class="flex items-center justify-center w-7 h-7 rounded-lg border border-line bg-glass text-ink-2 hover:bg-glass-hover hover:text-ink transition-all duration-200 cursor-pointer"
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

        <!-- Tour filter -->
        <div class="flex items-center gap-2">
          <select
            class="bg-glass border border-line rounded-sm px-3 py-1.5 text-[11px] text-ink-2 outline-none focus:border-acid cursor-pointer"
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
      <div class="grid grid-cols-7 gap-1">
        <div
          v-for="day in t('calendar.days')"
          :key="String(day)"
          class="text-center text-[10px] font-bold text-ink-3 tracking-[0.5px] uppercase py-1"
        >
          {{ day }}
        </div>
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="flex-1 overflow-y-auto px-4 py-3">
      <div class="grid grid-cols-7 gap-1">
        <div
          v-for="cell in cal.daysGrid"
          :key="cell.isoDate"
          class="min-h-[72px] rounded-lg p-1.5 cursor-pointer transition-all duration-150 border"
          :class="[
            cell.isCurrentMonth ? 'bg-glass' : 'bg-transparent opacity-40',
            cell.isToday ? 'border-line-acid bg-acid-dim' : 'border-transparent',
            cal.selectedDate === cell.isoDate ? 'border-line-acid bg-glass-active' : '',
            cell.isCurrentMonth && cal.selectedDate !== cell.isoDate ? 'hover:bg-glass-2 hover:border-line' : '',
          ]"
          @click="cal.selectDate(cell.isoDate)"
        >
          <!-- Day number -->
          <div class="flex items-center justify-between mb-1">
            <span
              class="text-[12px] font-medium"
              :class="[
                cell.isToday ? 'text-acid font-bold' : '',
                cell.isCurrentMonth ? 'text-ink-2' : 'text-ink-4',
                cal.selectedDate === cell.isoDate ? 'text-acid' : '',
              ]"
            >
              {{ cell.dayNum }}
            </span>
            <span
              v-if="cell.isToday"
              class="text-[8px] font-bold text-acid tracking-[0.5px] uppercase"
            >
              {{ t('calendar.today') }}
            </span>
          </div>

          <!-- Event dots -->
          <div class="flex flex-col gap-0.5">
            <div
              v-for="ev in cell.events.slice(0, 3)"
              :key="ev.id"
              class="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate"
              :style="{ backgroundColor: ev.color + '22', color: ev.color }"
            >
              <div
                class="w-[5px] h-[5px] rounded-full flex-shrink-0"
                :style="{ backgroundColor: ev.color }"
              />
              <span class="truncate">{{ ev.name }}</span>
            </div>
            <div
              v-if="cell.events.length > 3"
              class="text-[9px] text-ink-3 px-1"
            >
              +{{ cell.events.length - 3 }} más
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
