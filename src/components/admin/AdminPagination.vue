<script setup lang="ts">
defineProps<{ count: number; next: string | null; previous: string | null; pageSize?: number }>()
const emit = defineEmits<{ prev: []; next: [] }>()
</script>

<template>
  <div v-if="count > (pageSize ?? 20)" class="flex items-center justify-between px-3 py-2.5 border-t border-line flex-shrink-0">
    <p class="text-[11px] text-ink-4">{{ count }} en total</p>
    <div class="flex gap-1.5">
      <button
        class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :class="previous ? 'hover:bg-glass-hover' : ''"
        :disabled="!previous"
        @click="emit('prev')"
      >
        Anterior
      </button>
      <button
        class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :class="next ? 'hover:bg-glass-hover' : ''"
        :disabled="!next"
        @click="emit('next')"
      >
        Siguiente
      </button>
    </div>
  </div>
</template>
