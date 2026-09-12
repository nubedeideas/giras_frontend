<script setup lang="ts">
import type { Plan } from '@/composables/useAdminPlans'

defineProps<{ plan: Plan }>()
const emit = defineEmits<{ edit: [] }>()
</script>

<template>
  <div class="bg-glass border border-line rounded-xl px-3 py-2.5 flex items-center gap-3">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <p class="text-[12px] font-semibold text-ink truncate">{{ plan.name }}</p>
        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-glass-2 text-ink-3 uppercase tracking-[0.4px]">{{ plan.code }}</span>
        <span v-if="plan.is_default" class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-acid-dim text-acid-muted">Default</span>
        <span v-if="!plan.is_active" class="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style="background: rgba(239,68,68,0.12); color: #f87171">Inactivo</span>
      </div>
      <p class="text-[10px] text-ink-4 mt-0.5">
        {{ plan.is_unlimited_notifications ? 'Notifs. ilimitadas' : `${plan.notification_limit} notifs.` }}
        ·
        {{ plan.is_unlimited_shows ? 'shows ilimitados' : `${plan.max_shows} shows` }}
        ·
        {{ plan.price }} {{ plan.currency }}
      </p>
    </div>
    <button
      class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors flex-shrink-0"
      @click="emit('edit')"
    >
      Editar
    </button>
  </div>
</template>
