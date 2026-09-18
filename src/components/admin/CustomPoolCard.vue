<script setup lang="ts">
import type { CustomPool } from '@/composables/useAdminCustomPools'

defineProps<{ pool: CustomPool }>()
const emit = defineEmits<{ edit: []; delete: [] }>()
</script>

<template>
  <div class="bg-glass border border-line rounded-xl px-3 py-2.5">
    <div class="flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-semibold text-ink truncate">
          {{ pool.user_email }}
        </p>
        <p class="text-[10px] text-ink-4 mt-0.5">
          Notifs: {{ pool.allocated_notifications }}/{{ pool.total_notifications }} asignadas
          ({{ pool.remaining_notifications }} libres)
          · Shows: {{ pool.allocated_shows }}/{{ pool.total_shows }} ({{ pool.remaining_shows }} libres)
        </p>
      </div>
      <span
        v-if="!pool.is_active"
        class="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
        style="background: rgba(239,68,68,0.12); color: #f87171"
      >Inactivo</span>
      <button
        class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors flex-shrink-0"
        @click="emit('edit')"
      >
        Editar
      </button>
    </div>
    <p
      v-if="pool.notes"
      class="text-[10px] text-ink-4 mt-1.5"
    >
      {{ pool.notes }}
    </p>
  </div>
</template>
