<script setup lang="ts">
import { ref } from 'vue'
import { useAdminSubscriptions, type Subscription, type SubscriptionStatus } from '@/composables/useAdminSubscriptions'

const props = defineProps<{ subscription: Subscription }>()
const emit = defineEmits<{ refresh: []; changePlan: [] }>()

const api = useAdminSubscriptions()
const expanded = ref(false)
const loading = ref(false)
const error = ref('')
const showCancelConfirm = ref(false)
const cancelReason = ref('')

const STATUS_COLORS: Record<SubscriptionStatus, { bg: string; text: string }> = {
  pending: { bg: 'rgba(26,143,255,0.12)', text: '#1a8fff' },
  active: { bg: 'rgba(31,173,90,0.15)', text: '#34d399' },
  cancelled: { bg: 'rgba(100,116,139,0.10)', text: '#64748b' },
}

async function activate() {
  loading.value = true
  error.value = ''
  try {
    await api.activate(props.subscription.uuid)
    emit('refresh')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al activar'
  } finally {
    loading.value = false
  }
}

async function cancel() {
  loading.value = true
  error.value = ''
  try {
    await api.cancel(props.subscription.uuid, cancelReason.value.trim() || undefined)
    showCancelConfirm.value = false
    emit('refresh')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cancelar'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="bg-glass border border-line rounded-xl overflow-hidden">
    <button
      class="w-full flex items-center gap-3 px-3 py-2.5 text-left border-none bg-transparent cursor-pointer hover:bg-glass-hover transition-colors"
      @click="expanded = !expanded"
    >
      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 bg-glass-2 text-ink-3 uppercase tracking-[0.4px]">
        {{ subscription.plan.code }}
      </span>
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-medium text-ink truncate">{{ subscription.tour_name }}</p>
        <p class="text-[10px] text-ink-4 truncate">{{ subscription.user_email }}</p>
      </div>
      <div class="flex-shrink-0 text-right">
        <p class="text-[11px] text-ink-2">
          {{ subscription.remaining_notifications === -1 ? '∞' : subscription.remaining_notifications }} restantes
        </p>
        <p class="text-[9px] text-ink-4">{{ subscription.usage_percentage }}% usado</p>
      </div>
      <span
        class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
        :style="{ background: STATUS_COLORS[subscription.status].bg, color: STATUS_COLORS[subscription.status].text }"
      >
        {{ subscription.status }}
      </span>
      <svg
        class="flex-shrink-0 text-ink-4 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div v-if="expanded" class="border-t border-line px-3 py-2.5 space-y-2">
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <p>Notifs. usadas: {{ subscription.notifications_used }}</p>
        <p>Shows: {{ subscription.shows_used }}/{{ subscription.shows_limit }}</p>
        <p>Pagos: {{ subscription.payments_count }}</p>
        <p>Total pagado: {{ subscription.total_paid }}</p>
      </div>

      <p v-if="error" class="text-[11px] text-red-400">{{ error }}</p>

      <div class="flex flex-wrap gap-1.5">
        <button
          class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
          @click="emit('changePlan')"
        >
          Cambiar plan
        </button>
        <button
          v-if="subscription.status === 'pending'"
          class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors disabled:opacity-50"
          :disabled="loading"
          @click="activate"
        >
          Activar
        </button>
        <button
          v-if="subscription.status === 'active' && !showCancelConfirm"
          class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-4 hover:text-red-400 hover:border-red-400/30 cursor-pointer transition-colors"
          @click="showCancelConfirm = true"
        >
          Cancelar suscripción
        </button>
      </div>

      <div v-if="showCancelConfirm" class="space-y-1.5">
        <input
          v-model="cancelReason"
          placeholder="Motivo (opcional)"
          class="w-full bg-bg-3 border border-line rounded-lg px-2.5 py-1.5 text-[11px] text-ink outline-none focus:border-line-2"
        />
        <div class="flex gap-1">
          <button
            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border-none disabled:opacity-50"
            style="background: rgba(239,68,68,0.15); color: #f87171"
            :disabled="loading"
            @click="cancel"
          >{{ loading ? '…' : 'Confirmar cancelación' }}</button>
          <button
            class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
            @click="showCancelConfirm = false"
          >Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>
