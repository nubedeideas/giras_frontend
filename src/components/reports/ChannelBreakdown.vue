<script setup lang="ts">
defineProps<{
  channels: Array<{
    name: string
    sent: number
    opened: number
    clicked: number
    color: string
    pct: number
  }>
  title: string
  labels: { sent: string; opened: string; clicked: string }
}>()
</script>

<template>
  <div class="bg-glass border border-line rounded p-5 mb-4">
    <p class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase mb-4">{{ title }}</p>
    <div class="space-y-5">
      <div v-for="ch in channels" :key="ch.name">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: ch.color }" />
            <span class="text-[12px] font-semibold text-ink">{{ ch.name }}</span>
          </div>
          <div class="flex items-center gap-4 text-[10px]">
            <span class="text-ink-3">{{ labels.sent }} <strong class="text-ink">{{ ch.sent }}</strong></span>
            <span class="text-ink-3">{{ labels.opened }} <strong class="text-brand-blue">{{ ch.opened }}</strong></span>
            <span class="text-ink-3">{{ labels.clicked }} <strong class="text-brand-orange">{{ ch.clicked }}</strong></span>
          </div>
        </div>
        <!-- Bar tracks -->
        <div class="flex flex-col gap-1">
          <div class="relative h-[5px] bg-glass-2 rounded-full overflow-hidden">
            <div
              class="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              :style="{ width: `${ch.pct}%`, backgroundColor: ch.color }"
            />
          </div>
          <div class="relative h-[5px] bg-glass-2 rounded-full overflow-hidden">
            <div
              class="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              :style="{ width: `${ch.sent > 0 ? Math.round((ch.opened / ch.sent) * 100) : 0}%`, background: 'var(--brand-blue)' }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
