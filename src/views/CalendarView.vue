<script setup lang="ts">
import CalendarGrid from '@/components/calendar/CalendarGrid.vue'
import CalendarSidePanel from '@/components/calendar/CalendarSidePanel.vue'
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <CalendarGrid />
    <CalendarSidePanel />
  </div>
</template>
