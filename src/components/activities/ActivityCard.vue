<script setup lang="ts">
import type { ActivityListItem } from '@/composables/useActivities'
import { STATUS_LABELS, STATUS_COLORS } from '@/composables/useActivities'

defineProps<{ activity: ActivityListItem; selected: boolean; dimmed?: boolean }>()
const emit = defineEmits<{ select: [uuid: string] }>()

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
    class="relative overflow-hidden bg-glass border border-line rounded p-[11px] mb-[5px] cursor-pointer transition-all duration-200 hover:bg-glass-2 hover:border-line-2"
    :class="[selected ? 'bg-glass-active border-line-acid' : '', dimmed ? 'opacity-40' : '']"
    @click="emit('select', activity.uuid)"
  >
    <!-- Left active bar -->
    <div v-if="selected" class="absolute left-0 top-0 bottom-0 w-[3px] bg-acid rounded-r" />

    <div class="flex items-start gap-2.5 mb-1.5">
      <!-- Activity type color icon -->
      <div
        class="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0"
        :style="{ background: activity.activity_type_color + '22' }"
      >
        <div
          class="w-[8px] h-[8px] rounded-full"
          :style="{ background: activity.activity_type_color }"
        />
      </div>

      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-semibold mb-px truncate text-ink">{{ activity.title }}</p>
        <p class="text-[10px] text-ink-2 truncate">
          {{ activity.activity_type_name }}
          <span v-if="activity.location_name"> · {{ activity.location_name }}</span>
          <span v-if="activity.destination_name"> → {{ activity.destination_name }}</span>
        </p>
      </div>

      <span class="text-[10px] text-ink-3 flex-shrink-0 mt-px">
        {{ activity.all_day ? formatDate(activity.scheduled_at) : formatTime(activity.scheduled_at) }}
      </span>
    </div>

    <div class="flex items-center gap-[5px]">
      <!-- Status badge -->
      <span
        class="text-[9px] font-semibold px-1.5 py-px rounded-full leading-none"
        :style="{ background: STATUS_COLORS[activity.status].bg, color: STATUS_COLORS[activity.status].text }"
      >
        {{ STATUS_LABELS[activity.status] }}
      </span>
      <!-- Category -->
      <span class="text-[10px] text-ink-4 truncate flex-1">{{ activity.category }}</span>
    </div>
  </div>
</template>
