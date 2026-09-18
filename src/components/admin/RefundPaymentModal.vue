<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useAdminPayments, type PaymentListItem } from '@/composables/useAdminPayments'

const props = defineProps<{ show: boolean; payment: PaymentListItem | null }>()
const emit = defineEmits<{ close: []; refunded: [] }>()

const api = useAdminPayments()
const reason = ref('')
const saving = ref(false)
const error = ref('')

watch(
  () => props.show,
  (v) => {
    if (v) {
      reason.value = ''
      error.value = ''
    }
  },
)

async function submit() {
  if (!props.payment || !reason.value.trim()) return
  saving.value = true
  error.value = ''
  try {
    await api.refund(props.payment.uuid, reason.value.trim())
    emit('refunded')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al reembolsar'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal
    :show="show"
    @close="emit('close')"
  >
    <template v-if="payment">
      <p class="text-base font-bold text-ink tracking-[-0.2px] mb-1">
        Reembolsar pago
      </p>
      <p class="text-[11px] text-ink-4 mb-4">
        {{ payment.user_email }} · {{ payment.amount }} {{ payment.currency }} · {{ payment.tour_name }}
      </p>

      <div class="bg-glass border border-line-acid rounded-lg px-3 py-2.5 mb-3">
        <p class="text-[11px] text-ink-2">
          Esto dispara un reembolso real contra la pasarela de pago (Cobry). El resultado final llega de forma asíncrona — esta acción solo lo <strong>solicita</strong>.
        </p>
      </div>

      <label class="block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1">Motivo *</label>
      <textarea
        v-model="reason"
        class="w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors"
        rows="3"
        placeholder="Explicá por qué se reembolsa este pago…"
        style="resize: vertical"
      />

      <p
        v-if="error"
        class="text-[11px] text-red-400 mt-2"
      >
        {{ error }}
      </p>

      <div class="flex justify-end gap-2 pt-3">
        <button
          class="px-3.5 py-[7px] rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          class="px-3.5 py-[7px] rounded-sm text-[11px] font-semibold cursor-pointer border-none disabled:opacity-50"
          style="background: rgba(239,68,68,0.15); color: #f87171"
          :disabled="saving || !reason.trim()"
          @click="submit"
        >
          {{ saving ? 'Solicitando…' : 'Solicitar reembolso' }}
        </button>
      </div>
    </template>
  </AppModal>
</template>
