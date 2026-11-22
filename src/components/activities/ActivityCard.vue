<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ActivityListItem } from '@/composables/useActivities'
import { STATUS_LABELS } from '@/composables/useActivities'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { activityBadge } from '@/utils/statusBadge'

defineProps<{ activity: ActivityListItem; selected: boolean; past?: boolean }>()
const emit = defineEmits<{ select: [uuid: string] }>()
const { t } = useI18n()

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d.getDate()} ${months[d.getMonth()]}`
}
</script>

<template>
  <div
    class="relative overflow-hidden bg-bg-3 border border-line rounded-lg p-3 min-h-[44px] mb-[5px] cursor-pointer transition-all duration-200 hover:border-line-2"
    :class="selected ? 'bg-glass-active border-line-acid' : ''"
    :data-past="past ? 'true' : undefined"
    @click="emit('select', activity.uuid)"
  >
    <!-- Left active bar -->
    <div
      v-if="selected"
      class="absolute left-0 top-0 bottom-0 w-[3px] bg-olive rounded-r"
    />

    <div class="flex items-start gap-2.5 mb-1.5">
      <!-- Activity type color icon -->
      <div
        class="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 bg-bg-2 border border-line"
      >
        <div
          class="w-[8px] h-[8px] rounded-full"
          :style="{ background: activity.activity_type_color }"
        />
      </div>

      <div class="flex-1 min-w-0">
        <p
          class="text-[14px] font-semibold mb-px truncate"
          :class="past ? 'text-ink-2' : 'text-ink'"
        >
          {{ activity.title }}
        </p>
        <p class="text-[12px] text-ink-2 truncate">
          {{ activity.activity_type_name }}
          <span v-if="activity.location_name"> · {{ activity.location_name }}</span>
          <span v-if="activity.destination_name"> → {{ activity.destination_name }}</span>
        </p>
      </div>

      <span class="text-[13px] text-ink font-time tnum flex-shrink-0 mt-px">
        {{ activity.all_day ? formatDate(activity.scheduled_at) : formatTime(activity.scheduled_at) }}
      </span>
    </div>

    <div class="flex items-center gap-[5px] min-w-0">
      <StatusBadge
        :status="activityBadge(activity.status)"
        :label="STATUS_LABELS[activity.status]"
        size="sm"
      />
      <StatusBadge
        v-if="past"
        status="off"
        :label="t('activity.pastLabel')"
        size="sm"
        data-test="past-badge"
      />
      <!-- Category -->
      <span class="text-[12px] text-ink-3 truncate flex-1">{{ activity.category }}</span>
    </div>
  </div>
</template>
