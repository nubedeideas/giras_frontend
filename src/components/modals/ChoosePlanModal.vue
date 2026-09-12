<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useBilling, type PublicPlan } from '@/composables/useBilling'
import { useSubscription, type ChangePlanResult } from '@/composables/useSubscription'
import { toArray } from '@/utils/pagination'
import type { PlanCode } from '@/composables/useAdminSubscriptions'

const props = defineProps<{ show: boolean; tourUuid: string; currentPlanCode: PlanCode | null }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const billingApi = useBilling()
const subApi = useSubscription()

const plans = ref<PublicPlan[]>([])
const loading = ref(false)
const submittingCode = ref<PlanCode | null>(null)
const error = ref('')
const result = ref<ChangePlanResult | null>(null)

watch(
  () => props.show,
  async (v) => {
    if (!v) return
    error.value = ''
    result.value = null
    loading.value = true
    try {
      const data = await billingApi.listPlans()
      plans.value = toArray(data)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar los planes'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

async function choose(code: PlanCode) {
  submittingCode.value = code
  error.value = ''
  try {
    const r = await subApi.changePlan(props.tourUuid, code)
    result.value = r
    if (r.status === 'success' || r.status === 'no_change') emit('changed')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar el plan'
  } finally {
    submittingCode.value = null
  }
}
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <p class="text-base font-bold text-ink tracking-[-0.2px] mb-4">Elegir plan</p>

    <div v-if="loading" class="flex justify-center py-8">
      <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round" />
      </svg>
    </div>

    <!-- Resultado del cambio de plan -->
    <div v-else-if="result" class="space-y-3">
      <div v-if="result.status === 'no_change'" class="bg-glass border border-line rounded-lg px-3 py-2.5">
        <p class="text-[12px] text-ink-2">Ya tenías este plan activo.</p>
      </div>
      <div v-else-if="result.status === 'admin_setup_required'" class="bg-glass border border-line-acid rounded-lg px-3 py-2.5">
        <p class="text-[12px] text-ink-2">
          El plan Custom no se cobra directamente — un administrador te va a asignar el cupo correspondiente. Nos pondremos en contacto.
        </p>
      </div>
      <div v-else-if="result.status === 'payment_required'" class="bg-glass border border-line-acid rounded-lg px-3 py-2.5 space-y-2">
        <p class="text-[12px] text-ink-2">
          Te enviamos el link de pago por email y WhatsApp. También podés pagarlo ahora directamente:
        </p>
        <a
          :href="result.payment_url"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-sm bg-acid text-black text-[11px] font-bold no-underline"
        >
          Ir a pagar
        </a>
      </div>
      <div v-else class="bg-glass border border-line-acid rounded-lg px-3 py-2.5">
        <p class="text-[12px] text-ink-2">Listo, tu plan se actualizó.</p>
      </div>

      <div class="flex justify-end">
        <button
          class="px-3.5 py-[7px] rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
          @click="emit('close')"
        >Cerrar</button>
      </div>
    </div>

    <!-- Catálogo -->
    <div v-else class="space-y-2">
      <button
        v-for="plan in plans"
        :key="plan.uuid"
        class="w-full text-left px-3.5 py-3 rounded-lg border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="plan.code === currentPlanCode ? 'border-line-acid bg-glass-active' : 'border-line bg-glass hover:bg-glass-hover'"
        :disabled="!!submittingCode"
        @click="choose(plan.code)"
      >
        <div class="flex items-center justify-between">
          <p class="text-[13px] font-semibold text-ink">{{ plan.name }}</p>
          <p class="text-[12px] font-bold text-ink">{{ plan.price }} {{ plan.currency }}</p>
        </div>
        <p class="text-[11px] text-ink-3 mt-0.5">{{ plan.description }}</p>
        <p class="text-[10px] text-ink-4 mt-1">
          {{ plan.is_unlimited_notifications ? 'Notifs. ilimitadas' : `${plan.notification_limit} notifs.` }}
          ·
          {{ plan.is_unlimited_shows ? 'shows ilimitados' : `${plan.max_shows} shows` }}
        </p>
        <span v-if="plan.code === currentPlanCode" class="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-acid-dim text-acid-muted">
          Plan actual
        </span>
        <span v-if="submittingCode === plan.code" class="inline-block mt-1.5 text-[10px] text-ink-4">Procesando…</span>
      </button>

      <p v-if="error" class="text-[11px] text-red-400">{{ error }}</p>
    </div>
  </AppModal>
</template>
