<script setup lang="ts">
import { ref } from 'vue'
import { useAdminPlans, type Plan } from '@/composables/useAdminPlans'

const props = defineProps<{ plan: Plan }>()
const emit = defineEmits<{ edit: []; deleted: [] }>()

const api = useAdminPlans()
const showDeleteConfirm = ref(false)
const deleting = ref(false)
const error = ref('')

async function doDelete() {
  deleting.value = true
  error.value = ''
  try {
    await api.remove(props.plan.uuid)
    emit('deleted')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar'
    showDeleteConfirm.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="bg-glass border border-line rounded-xl px-3 py-2.5">
    <div class="flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-[12px] font-semibold text-ink truncate">
            {{ plan.name }}
          </p>
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-glass-2 text-ink-3 uppercase tracking-[0.4px]">{{ plan.code }}</span>
          <span
            v-if="plan.is_default"
            class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-acid-dim text-acid-muted"
          >Default</span>
          <span
            v-if="!plan.is_active"
            class="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style="background: rgba(239,68,68,0.12); color: #f87171"
          >Inactivo</span>
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
      <button
        v-if="!showDeleteConfirm"
        class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-4 hover:text-red-400 hover:border-red-400/30 cursor-pointer transition-colors flex-shrink-0"
        @click="showDeleteConfirm = true"
      >
        Eliminar
      </button>
    </div>

    <div
      v-if="showDeleteConfirm"
      class="mt-2 pt-2 border-t border-line space-y-1.5"
    >
      <p class="text-[11px] text-ink-3">
        Si hay giras usando este plan, eliminarlo les puede romper el acceso. ¿Confirmás?
      </p>
      <p
        v-if="error"
        class="text-[11px] text-red-400"
      >
        {{ error }}
      </p>
      <div class="flex gap-1">
        <button
          class="px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border-none disabled:opacity-50"
          style="background: rgba(239,68,68,0.15); color: #f87171"
          :disabled="deleting"
          @click="doDelete"
        >
          {{ deleting ? '…' : 'Eliminar de todas formas' }}
        </button>
        <button
          class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
          @click="showDeleteConfirm = false"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
</template>
