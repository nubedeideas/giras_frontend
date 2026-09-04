<template>
  <div>
    <div
      :class="[
        'flex items-center justify-between border-b border-white/10',
        compact ? 'mb-2 pb-2' : 'mb-4 pb-3',
      ]"
    >
      <span
        :class="[
          'font-bold uppercase tracking-widest text-acid-green',
          compact ? 'text-[8px]' : 'text-[9px]',
        ]"
        >Control de Tráfico</span
      >
      <span :class="['font-mono uppercase opacity-50', compact ? 'text-[7px]' : 'text-[9px]']">{{
        timeString
      }}</span>
    </div>
    <div :class="compact ? 'space-y-1.5' : 'space-y-3'">
      <ScheduleItem time="14:00" label="Check-in en Hotel" status="SENT" :compact="compact" />
      <ScheduleItem time="16:30" label="Soundcheck" status="PENDING" :compact="compact" />
      <ScheduleItem time="19:00" label="Dinner Call" status="PENDING" :compact="compact" />
      <ScheduleItem
        time="21:00"
        label="Showtime"
        status="QUEUED"
        :active="true"
        :compact="compact"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ScheduleItem from './schedule-item.vue'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const timeString = ref(new Date().toLocaleTimeString())
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => {
    timeString.value = new Date().toLocaleTimeString()
  }, 1000)
})

onUnmounted(() => clearInterval(timer))
</script>
