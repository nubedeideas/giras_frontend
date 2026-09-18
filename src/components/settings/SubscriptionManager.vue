<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useToursStore } from '@/stores/tours'
import { useSubscription, type ClientSubscription, type SubscriptionUsage } from '@/composables/useSubscription'
import type { NotificationUsageEntry } from '@/composables/useAdminNotificationUsage'
import type { PaymentListItem } from '@/composables/useAdminPayments'
import { toArray } from '@/utils/pagination'
import UsageLogCard from '@/components/admin/UsageLogCard.vue'
import ChoosePlanModal from '@/components/modals/ChoosePlanModal.vue'

const tours = useToursStore()
const api = useSubscription()

const subscription = ref<ClientSubscription | null>(null)
const usage = ref<SubscriptionUsage | null>(null)
const history = ref<NotificationUsageEntry[]>([])
const payments = ref<PaymentListItem[]>([])
const loading = ref(false)
const error = ref('')
const showChoosePlan = ref(false)
const showCancelConfirm = ref(false)
const cancelling = ref(false)
const cancelError = ref('')

const activeTourId = computed(() => tours.activeTourId)
const activeTourUuid = computed(() => tours.activeTour?.uuid ?? null)

async function load() {
  const tourUuid = activeTourUuid.value
  if (!tourUuid) return
  loading.value = true
  error.value = ''
  try {
    const [sub, use, hist, pays] = await Promise.all([
      api.get(tourUuid),
      api.usage(tourUuid),
      api.history(tourUuid),
      api.payments(tourUuid),
    ])
    subscription.value = sub
    usage.value = use
    history.value = toArray(hist)
    payments.value = toArray(pays)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar la suscripción'
  } finally {
    loading.value = false
  }
}

watch(activeTourId, load)
onMounted(load)

async function doCancel() {
  const tourUuid = activeTourUuid.value
  if (!tourUuid) return
  cancelling.value = true
  cancelError.value = ''
  try {
    await api.cancel(tourUuid)
    showCancelConfirm.value = false
    load()
  } catch (e) {
    cancelError.value = e instanceof Error ? e.message : 'Error al cancelar'
  } finally {
    cancelling.value = false
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}

const barColor = computed(() => {
  const pct = usage.value?.usage_percentage ?? 0
  if (pct >= 90) return '#f87171'
  if (pct >= 70) return '#e85d00'
  return 'var(--acid)'
})
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg-3">
    <div class="max-w-2xl mx-auto px-8 py-8">
      <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px] mb-6">
        Suscripción
      </h2>

      <div
        v-if="!activeTourUuid"
        class="text-center py-10 text-ink-4 text-[12px]"
      >
        Elegí una gira desde el menú "Giras" para ver su suscripción.
      </div>

      <div
        v-else-if="loading"
        class="flex justify-center py-10"
      >
        <svg
          class="animate-spin text-ink-4"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="3"
            stroke-dasharray="40 22"
            stroke-linecap="round"
          />
        </svg>
      </div>

      <p
        v-else-if="error"
        class="text-[12px] text-red-400"
      >
        {{ error }}
      </p>

      <template v-else-if="usage && subscription">
        <!-- Plan actual + consumo -->
        <section class="mb-8">
          <div class="bg-glass border border-line rounded-lg px-4 py-3.5 mb-3">
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="text-[13px] font-bold text-ink">
                  {{ usage.plan_name }}
                </p>
                <p class="text-[10px] text-ink-4 uppercase tracking-[0.4px]">
                  {{ subscription.status }}
                </p>
              </div>
              <button
                class="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-acid text-black cursor-pointer"
                @click="showChoosePlan = true"
              >
                Cambiar plan
              </button>
            </div>

            <!-- Usage bar -->
            <div
              v-if="!usage.is_unlimited"
              class="mb-1"
            >
              <div class="flex items-center justify-between text-[10px] text-ink-4 mb-1">
                <span>{{ usage.notifications_used }} / {{ usage.notification_limit }} notificaciones</span>
                <span>{{ usage.usage_percentage }}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-glass-2 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{ width: `${Math.min(usage.usage_percentage, 100)}%`, background: barColor }"
                />
              </div>
              <p
                v-if="usage.usage_percentage >= 90"
                class="text-[10px] mt-1"
                style="color: #f87171"
              >
                Te queda poco consumo disponible — considerá cambiar de plan para no quedarte sin notificaciones.
              </p>
            </div>
            <p
              v-else
              class="text-[11px] text-ink-3"
            >
              Notificaciones ilimitadas en este plan.
            </p>

            <p class="text-[10px] text-ink-4 mt-2">
              Shows: {{ usage.shows_used }}/{{ usage.shows_limit === 0 ? '∞' : usage.shows_limit }}
            </p>
          </div>

          <button
            v-if="usage.plan_code !== 'free' && !showCancelConfirm"
            class="text-[11px] text-ink-4 hover:text-red-400 cursor-pointer border-none bg-transparent"
            @click="showCancelConfirm = true"
          >
            Cancelar suscripción
          </button>
          <div
            v-if="showCancelConfirm"
            class="mt-1.5 space-y-1.5"
          >
            <p class="text-[11px] text-ink-3">
              ¿Confirmás la cancelación de la suscripción de esta gira?
            </p>
            <p
              v-if="cancelError"
              class="text-[11px] text-red-400"
            >
              {{ cancelError }}
            </p>
            <div class="flex gap-1.5">
              <button
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border-none disabled:opacity-50"
                style="background: rgba(239,68,68,0.15); color: #f87171"
                :disabled="cancelling"
                @click="doCancel"
              >
                {{ cancelling ? '…' : 'Confirmar cancelación' }}
              </button>
              <button
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
                @click="showCancelConfirm = false"
              >
                Volver
              </button>
            </div>
          </div>
        </section>

        <!-- Pagos de esta gira -->
        <section class="mb-8">
          <label class="block text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-3">Pagos</label>
          <p
            v-if="payments.length === 0"
            class="text-[11px] text-ink-4"
          >
            Sin pagos registrados todavía.
          </p>
          <div
            v-else
            class="space-y-1.5"
          >
            <div
              v-for="p in payments"
              :key="p.uuid"
              class="flex items-center justify-between bg-glass border border-line rounded-lg px-3 py-2"
            >
              <div>
                <p class="text-[12px] text-ink">
                  {{ p.amount }} {{ p.currency }}
                </p>
                <p class="text-[10px] text-ink-4">
                  {{ formatDate(p.payment_date ?? p.created_at) }}
                </p>
              </div>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-glass-2 text-ink-3 capitalize">{{ p.status }}</span>
            </div>
          </div>
        </section>

        <!-- Historial de uso -->
        <section>
          <label class="block text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-3">Historial de uso</label>
          <p
            v-if="history.length === 0"
            class="text-[11px] text-ink-4"
          >
            Sin notificaciones registradas todavía.
          </p>
          <div
            v-else
            class="space-y-1.5"
          >
            <UsageLogCard
              v-for="entry in history"
              :key="entry.uuid"
              :entry="entry"
            />
          </div>
        </section>
      </template>

      <ChoosePlanModal
        v-if="activeTourUuid"
        :show="showChoosePlan"
        :tour-uuid="activeTourUuid"
        :current-plan-code="usage?.plan_code ?? null"
        @close="showChoosePlan = false"
        @changed="load(); showChoosePlan = false"
      />
    </div>
  </div>
</template>
