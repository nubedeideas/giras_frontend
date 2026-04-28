<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCalendarStore } from '@/stores/calendar'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

const { t } = useI18n()
const cal = useCalendarStore()
</script>

<template>
  <div class="w-72 flex-shrink-0 bg-bg-2 border-l border-line flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="px-4 pt-5 pb-3 border-b border-line flex-shrink-0 flex items-center justify-between">
      <p class="text-[13px] font-bold text-ink">
        {{ t('calendar.upcoming') }}
      </p>
      <BtnPrimary small>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
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

    <!-- Selected day events -->
    <div
      v-if="cal.selectedDate && cal.eventsForSelectedDate.length > 0"
      class="border-b border-line flex-shrink-0"
    >
      <div class="px-4 py-2 bg-acid-dim">
        <p class="text-[10px] font-bold text-acid-muted uppercase tracking-[1px]">
          {{ cal.selectedDate }}
        </p>
      </div>
      <div class="px-3 py-2">
        <div
          v-for="ev in cal.eventsForSelectedDate"
          :key="ev.id"
          class="flex items-center gap-2.5 p-2.5 rounded-lg border border-line-acid bg-glass-active mb-1.5"
        >
          <div
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: ev.color }"
          />
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-semibold text-ink truncate">
              {{ ev.name }}
            </p>
            <p class="text-[10px] text-ink-3">
              {{ ev.date }} · {{ ev.loc }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- All upcoming events -->
    <div class="flex-1 overflow-y-auto px-3 py-2">
      <div
        v-for="ev in cal.upcomingEvents"
        :key="ev.id"
        class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-line cursor-pointer transition-all duration-150 hover:bg-glass mb-1.5"
        :class="cal.selectedDate === ev.isoDate ? 'bg-glass-active border-line-acid' : ''"
        @click="cal.selectDate(ev.isoDate)"
      >
        <div
          class="w-2 h-2 rounded-full flex-shrink-0"
          :style="{ backgroundColor: ev.color }"
        />
        <div class="flex-1 min-w-0">
          <p class="text-[12px] font-medium text-ink truncate">
            {{ ev.name }}
          </p>
          <p class="text-[10px] text-ink-3">
            {{ ev.date }} · {{ ev.loc }}
          </p>
        </div>
      </div>

      <div
        v-if="cal.upcomingEvents.length === 0"
        class="text-center py-8 text-ink-4 text-xs"
      >
        {{ t('calendar.noEvents') }}
      </div>
    </div>
  </div>
</template>
