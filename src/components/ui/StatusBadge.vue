<script setup lang="ts">
import type { BadgeStatus } from '@/utils/statusBadge'

withDefaults(defineProps<{ status: BadgeStatus; label: string; size?: 'sm' | 'md' }>(), {
  size: 'md',
})

// Clases completas para que Tailwind las detecte.
const COLOR: Record<BadgeStatus, string> = {
  sent: 'bg-sent-bg text-sent-fg',
  pending: 'bg-pending-bg text-pending-fg',
  scheduled: 'bg-scheduled-bg text-scheduled-fg',
  failed: 'bg-failed-bg text-failed-fg',
  off: 'bg-off-bg text-off-fg',
}

const SIZE: Record<'sm' | 'md', string> = {
  sm: 'text-[12px] px-2 py-[3px]',
  md: 'text-[13px] px-2.5 py-1',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full font-semibold leading-none whitespace-nowrap"
    :class="[COLOR[status], SIZE[size]]"
    :data-status="status"
  >{{ label }}</span>
</template>
