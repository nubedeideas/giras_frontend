<template>
  <div
    :class="[
      'flex items-center justify-between p-3 border',
      active ? 'border-acid-green bg-acid-green/5' : 'border-white/5',
    ]"
  >
    <div class="flex gap-4 items-center">
      <span class="text-xs opacity-50">{{ time }}</span>
      <span class="text-xs font-bold uppercase">{{ label }}</span>
    </div>
    <span
      :class="[
        'text-[9px] px-2 py-0.5 border',
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
  }>(),
  { active: false },
)
</script>
