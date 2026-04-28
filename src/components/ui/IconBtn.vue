<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <button
    class="flex items-center justify-center w-7 h-7 rounded-lg border border-line bg-glass text-ink-2 cursor-pointer transition-all duration-200 hover:bg-glass-hover hover:text-ink"
    :class="active ? 'bg-glass-active border-line-acid text-acid' : ''"
  >
    <slot />
  </button>
</template>
