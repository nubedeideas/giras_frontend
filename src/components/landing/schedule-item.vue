<template>
  <div
    :class="[
      'flex items-center justify-between gap-2 border',
      compact ? 'p-2' : 'p-3',
      active ? 'border-acid-green bg-acid-green/5' : 'border-white/5',
    ]"
  >
    <div class="flex min-w-0 items-center gap-2">
      <span :class="['shrink-0 opacity-50', compact ? 'text-[10px]' : 'text-xs']">{{ time }}</span>
      <span :class="['truncate font-bold uppercase', compact ? 'text-[10px]' : 'text-xs']">{{
        label
      }}</span>
    </div>
    <span
      :class="[
        'shrink-0 border',
        compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[9px]',
        status === 'SENT'
          ? 'bg-acid-green text-black border-acid-green'
          : 'border-white/20 opacity-40',
      ]"
    >
      {{ status }}
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    time: string
    label: string
    status: string
    active?: boolean
    compact?: boolean
  }>(),
  { active: false, compact: false }
)
</script>
