<template>
  <div class="reveal-up">
    <div class="text-5xl md:text-7xl font-header tracking-tighter leading-none mb-2">
      {{ value }}
    </div>
    <div class="text-[10px] uppercase font-bold tracking-widest opacity-60">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: string; label: string }>()
</script>
