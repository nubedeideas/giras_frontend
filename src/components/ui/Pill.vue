<script setup lang="ts">
import type { PillVariant } from '@/types'

defineProps<{ variant?: PillVariant }>()

const classes: Record<NonNullable<PillVariant>, string> = {
  g: 'bg-sent-bg text-sent-fg',
  b: 'bg-scheduled-bg text-scheduled-fg',
  o: 'bg-pending-bg text-pending-fg',
  n: 'bg-off-bg text-off-fg',
}
</script>

<template>
  <span
    class="text-[11px] font-bold px-1.5 py-0.5 rounded-full tracking-[0.4px]"
    :class="variant ? classes[variant] : classes.n"
  >
    <slot />
  </span>
</template>
