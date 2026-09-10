<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    percentage: number
    centerValue: string
    centerLabel: string
    color?: string
    trackColor?: string
    valueColor?: string
    labelColor?: string
  }>(),
  {
    color: 'var(--acid)',
    trackColor: 'var(--line)',
    valueColor: 'var(--ink)',
    labelColor: 'var(--ink-3)',
  },
)

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const clamped = computed(() => Math.max(0, Math.min(100, props.percentage)))
const dashOffset = computed(() => CIRCUMFERENCE * (1 - clamped.value / 100))
</script>

<template>
  <div class="relative w-full max-w-[220px] mx-auto aspect-square">
    <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">
      <circle
        cx="60"
        cy="60"
        :r="RADIUS"
        fill="none"
        :stroke="trackColor"
        stroke-width="10"
      />
      <circle
        cx="60"
        cy="60"
        :r="RADIUS"
        fill="none"
        :stroke="color"
        stroke-width="10"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="dashOffset"
        class="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-4 text-center">
      <p class="text-[10px]" :style="{ color: labelColor }">{{ centerLabel }}</p>
      <p class="text-[22px] font-bold tracking-[-0.5px] leading-tight" :style="{ color: valueColor }">
        {{ centerValue }}
      </p>
    </div>
  </div>
</template>
