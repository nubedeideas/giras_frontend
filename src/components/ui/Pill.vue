<script setup lang="ts">
import type { PillVariant } from '@/types'

defineProps<{ variant?: PillVariant }>()

const classes: Record<NonNullable<PillVariant>, string> = {
  g: 'bg-acid-dim text-acid-muted',
  b: 'bg-brand-blue-dim text-brand-blue',
  o: 'bg-brand-orange-dim text-brand-orange',
  n: 'bg-glass-2 text-ink-2',
}
</script>

<template>
  <span
    class="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-[0.4px]"
    :class="variant ? classes[variant] : classes.n"
  >
    <slot />
  </span>
</template>
