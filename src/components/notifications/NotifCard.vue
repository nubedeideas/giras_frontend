<script setup lang="ts">
import type { NotifEvent } from '@/types'
import Pill from '@/components/ui/Pill.vue'

defineProps<{ event: NotifEvent; selected: boolean; dimmed?: boolean }>()
const emit = defineEmits<{ select: [id: number] }>()

const typeIconPath: Record<string, string> = {
  wa: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  sms: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  email: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
}

const typeIconClass: Record<string, string> = {
  wa: 'bg-wa-green-dim text-wa-green',
  sms: 'bg-acid-dim text-acid-muted',
  email: 'bg-brand-blue-dim text-brand-blue',
}
</script>

<template>
  <div
    class="relative overflow-hidden bg-glass border border-line rounded p-[11px] mb-[5px] cursor-pointer transition-all duration-200 hover:bg-glass-2 hover:border-line-2"
    :class="[selected ? 'bg-glass-active border-line-acid' : '', dimmed ? 'opacity-50' : '']"
    @click="emit('select', event.id)"
  >
    <!-- Left active bar -->
    <div
      v-if="selected"
      class="absolute left-0 top-0 bottom-0 w-[3px] bg-acid rounded-r"
    />

    <div class="flex items-start gap-2.5 mb-1.5">
      <!-- Channel icon -->
      <div
        class="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0"
        :class="typeIconClass[event.type]"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="typeIconPath[event.type]"
        />
      </div>

      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-semibold mb-px truncate text-ink">{{ event.title }}</p>
        <p class="text-[10px] text-ink-2">{{ event.venue }} · {{ event.city }}</p>
      </div>

      <span class="text-[10px] text-ink-3 flex-shrink-0 mt-px">{{ event.time }}</span>
    </div>

    <div class="flex items-center gap-[5px]">
      <Pill :variant="event.pc">{{ event.group }}</Pill>
      <span class="text-[10px] text-ink-3 flex-1 truncate">{{ event.preview }}</span>
    </div>
  </div>
</template>
