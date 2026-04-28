<script setup lang="ts">
import type { NotifEvent } from '@/types'
import Pill from '@/components/ui/Pill.vue'

defineProps<{
  events: NotifEvent[]
  title: string
  labels: { sent: string; opened: string; clicked: string }
}>()

const typeLabel: Record<string, string> = { wa: 'WhatsApp', sms: 'SMS', email: 'Email' }
const typeClass: Record<string, string> = {
  wa: 'bg-wa-green-dim text-wa-green',
  sms: 'bg-acid-dim text-acid-muted',
  email: 'bg-brand-blue-dim text-brand-blue',
}
</script>

<template>
  <div class="bg-glass border border-line rounded overflow-hidden">
    <div class="px-5 py-3 border-b border-line flex items-center justify-between">
      <p class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase">{{ title }}</p>
      <div class="flex gap-6 text-[10px] text-ink-3">
        <span>{{ labels.sent }}</span>
        <span>{{ labels.opened }}</span>
        <span>{{ labels.clicked }}</span>
      </div>
    </div>
    <div class="divide-y divide-line">
      <div
        v-for="ev in events"
        :key="ev.id"
        class="flex items-center gap-3 px-5 py-3 hover:bg-glass-hover transition-colors duration-150"
      >
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[8px] font-bold"
          :class="typeClass[ev.type]"
        >
          {{ typeLabel[ev.type].slice(0, 2).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[12px] font-semibold text-ink truncate">{{ ev.title }}</p>
          <p class="text-[10px] text-ink-3">{{ ev.fullDate }} · {{ ev.city }}</p>
        </div>
        <Pill :variant="ev.pc">{{ ev.group }}</Pill>
        <div class="flex gap-6 text-right flex-shrink-0">
          <div>
            <p class="text-[12px] font-bold text-acid">{{ ev.stats.sent }}</p>
          </div>
          <div>
            <p class="text-[12px] font-bold text-brand-blue">{{ ev.stats.opened }}</p>
          </div>
          <div>
            <p class="text-[12px] font-bold text-brand-orange">{{ ev.stats.clicked }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
