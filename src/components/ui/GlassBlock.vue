<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <div class="bg-glass border border-line rounded p-[14px_16px] mb-3">
    <p v-if="title" class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase mb-2.5">
      {{ title }}
    </p>
    <slot />
  </div>
</template>
