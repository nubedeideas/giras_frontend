<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCalendarStore } from '@/stores/calendar'
import { useActivitiesStore } from '@/stores/activities'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

const { t } = useI18n()
const cal = useCalendarStore()
const activitiesStore = useActivitiesStore()

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
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

    <!-- Selected day activities -->
    <div
      v-if="cal.selectedDate && cal.activitiesForSelectedDate.length > 0"
      class="border-b border-line flex-shrink-0"
    >
      <div class="px-4 py-2 bg-acid-dim">
        <p class="text-[12px] font-bold text-acid-muted uppercase tracking-[1px] font-time tnum">
          {{ cal.selectedDate }}
        </p>
      </div>
      <div class="px-3 py-2">
        <div
          v-for="act in cal.activitiesForSelectedDate"
          :key="act.uuid"
          class="flex items-center gap-2.5 p-2.5 min-h-[44px] rounded-lg border border-line-acid bg-glass-active mb-1.5 cursor-pointer"
          @click="activitiesStore.selectActivity(act.uuid)"
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
              <span :class="act.all_day ? '' : 'font-time tnum'">{{ act.all_day ? t('calendar.today') : formatTime(act.scheduled_at) }}</span><span v-if="act.location_name"> · {{ act.location_name }}</span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- All upcoming activities -->
    <div class="flex-1 overflow-y-auto px-3 py-2">
      <div
        v-for="act in cal.upcomingActivities"
        :key="act.uuid"
        class="flex items-center gap-2.5 px-2.5 py-2 min-h-[44px] rounded-lg border border-line bg-bg-3 cursor-pointer transition-all duration-150 hover:border-line-2 mb-1.5"
        @click="activitiesStore.selectActivity(act.uuid)"
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
            <span :class="act.all_day ? '' : 'font-time tnum'">{{ act.all_day ? t('calendar.today') : formatTime(act.scheduled_at) }}</span><span v-if="act.location_name"> · {{ act.location_name }}</span>
          </p>
        </div>
      </div>

      <div
        v-if="cal.upcomingActivities.length === 0"
        class="text-center py-8 text-ink-4 text-[14px]"
      >
        {{ t('calendar.noEvents') }}
      </div>
    </div>
  </div>
</template>
