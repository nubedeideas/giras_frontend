<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <div class="bg-bg-3 border border-line rounded-lg shadow-[0_1px_3px_var(--shadow-sm)] p-[14px_16px] mb-3">
    <p v-if="title" class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase mb-2.5">
      {{ title }}
    </p>
    <slot />
  </div>
</template>
