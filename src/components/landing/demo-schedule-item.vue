<template>
  <div
    :class="[
      'flex items-center justify-between p-4 border transition-all duration-500',
      active
        ? 'border-acid-green bg-acid-green/10 translate-x-2'
        : highlight
          ? 'border-white/30 bg-white/5'
          : 'border-white/5 opacity-50',
    ]"
  >
    <div class="flex gap-4 items-center">
      <span class="text-[10px] font-mono opacity-50">{{ time }}</span>
      <span class="text-xs font-bold uppercase tracking-tight">{{ label }}</span>
    </div>
    <div
      :class="[
        'text-[9px] px-3 py-1 font-bold border transition-colors',
        status === 'SENT' || status === 'SENDING...'
          ? 'bg-acid-green text-black border-acid-green'
          : 'border-white/20',
      ]"
    >
      {{ status }}
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    time: string
    label: string
    status: string
    active?: boolean
    highlight?: boolean
  }>(),
  { active: false, highlight: false },
)
</script>
