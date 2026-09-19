<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActivitiesStore } from '@/stores/activities'
import ActivityCard from '@/components/activities/ActivityCard.vue'

const { t } = useI18n()
const store = useActivitiesStore()
</script>

<template>
  <div class="flex-1 overflow-y-auto px-4 py-3">
    <div
      v-if="store.loading"
      class="flex justify-center py-8"
    >
      <svg
        class="animate-spin text-ink-4"
        width="18"
        height="18"
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

    <template v-else-if="store.groupedByDay.length > 0">
      <template
        v-for="group in store.groupedByDay"
        :key="group.iso"
      >
        <p class="text-[9px] font-bold text-ink-4 tracking-[1.2px] uppercase px-1 pt-2.5 pb-1.5">
          {{ group.label }}
        </p>
        <ActivityCard
          v-for="a in group.items"
          :key="a.uuid"
          :activity="a"
          :selected="store.selectedUuid === a.uuid"
          @select="store.selectActivity"
        />
      </template>
    </template>

    <div
      v-else
      class="text-center py-8 text-ink-4 text-xs"
    >
      {{ t('calendar.noEvents') }}
    </div>
  </div>
</template>
