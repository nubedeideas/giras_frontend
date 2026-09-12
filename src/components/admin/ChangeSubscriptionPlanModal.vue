<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useAdminSubscriptions, type Subscription, type PlanCode } from '@/composables/useAdminSubscriptions'
import { useAdminCustomPools, type CustomPool } from '@/composables/useAdminCustomPools'

const props = defineProps<{ show: boolean; subscription: Subscription | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const subsApi = useAdminSubscriptions()
const poolsApi = useAdminCustomPools()

const PLAN_CODES: PlanCode[] = ['free', 'starter', 'premium', 'custom']

const selectedPlan = ref<PlanCode>('free')
const saving = ref(false)
const error = ref('')

// Allocate (only relevant once the subscription is on the Custom plan)
const pools = ref<CustomPool[]>([])
const poolsLoading = ref(false)
const selectedPool = ref('')
const allocatedNotifications = ref(0)
const allocatedShows = ref(0)
const allocateSaving = ref(false)
const allocateError = ref('')

watch(
  () => [props.show, props.subscription] as const,
  async ([show, sub]) => {
    if (!show || !sub) return
    selectedPlan.value = sub.plan.code
    error.value = ''
    allocateError.value = ''
    selectedPool.value = sub.custom_pool ?? ''
    allocatedNotifications.value = sub.allocated_notifications ?? 0
    allocatedShows.value = sub.allocated_shows ?? 0
    if (sub.plan.code === 'custom') {
      poolsLoading.value = true
      try {
        const data = await poolsApi.list({ search: sub.user_email })
        pools.value = data.results
      } catch {
        pools.value = []
      } finally {
        poolsLoading.value = false
      }
    }
  },
  { immediate: true },
)

async function submitChangePlan() {
  if (!props.subscription) return
  saving.value = true
  error.value = ''
  try {
    await subsApi.changePlan(props.subscription.uuid, selectedPlan.value)
    emit('saved')
    if (selectedPlan.value !== 'custom') emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar el plan'
  } finally {
    saving.value = false
  }
}

async function submitAllocate() {
  if (!props.subscription || !selectedPool.value) return
  allocateSaving.value = true
  allocateError.value = ''
  try {
    await subsApi.allocate(props.subscription.uuid, {
      custom_pool: selectedPool.value,
      allocated_notifications: allocatedNotifications.value,
      allocated_shows: allocatedShows.value,
    })
    emit('saved')
    emit('close')
  } catch (e) {
    allocateError.value = e instanceof Error ? e.message : 'Error al asignar el cupo'
  } finally {
    allocateSaving.value = false
  }
}

const inputClass =
  'w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors'
const labelClass = 'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <template v-if="subscription">
      <p class="text-base font-bold text-ink tracking-[-0.2px] mb-1">Cambiar plan</p>
      <p class="text-[11px] text-ink-4 mb-4">{{ subscription.tour_name }} · {{ subscription.user_email }}</p>

      <div class="space-y-3">
        <div>
          <label :class="labelClass">Plan</label>
          <select v-model="selectedPlan" :class="inputClass">
            <option v-for="code in PLAN_CODES" :key="code" :value="code">{{ code }}</option>
          </select>
        </div>

        <p v-if="error" class="text-[11px] text-red-400">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <button
            class="px-3.5 py-[7px] rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
            @click="emit('close')"
          >Cerrar</button>
          <button
            class="px-3.5 py-[7px] rounded-sm text-[11px] font-bold bg-acid text-black cursor-pointer disabled:opacity-50"
            :disabled="saving"
            @click="submitChangePlan"
          >{{ saving ? 'Guardando…' : 'Cambiar plan' }}</button>
        </div>

        <!-- Allocate: solo aplica una vez que la suscripción está en el plan Custom -->
        <template v-if="selectedPlan === 'custom'">
          <div class="h-px bg-line my-1" />
          <p class="text-[11px] font-semibold text-ink-2">Asignar cupo del pool</p>

          <div v-if="poolsLoading" class="text-[11px] text-ink-4">Buscando pools del cliente…</div>
          <p v-else-if="pools.length === 0" class="text-[11px] text-ink-4">
            Este cliente no tiene ningún cupo Custom creado todavía — creá uno en la pestaña "Cupos Custom" primero.
          </p>
          <template v-else>
            <div>
              <label :class="labelClass">Pool</label>
              <select v-model="selectedPool" :class="inputClass">
                <option value="" disabled>Elegí un pool</option>
                <option v-for="p in pools" :key="p.uuid" :value="p.uuid">
                  {{ p.user_email }} — {{ p.remaining_notifications }} notifs. / {{ p.remaining_shows }} shows libres
                </option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label :class="labelClass">Notifs. asignadas</label>
                <input v-model.number="allocatedNotifications" type="number" min="0" :class="inputClass" />
              </div>
              <div>
                <label :class="labelClass">Shows asignados</label>
                <input v-model.number="allocatedShows" type="number" min="0" :class="inputClass" />
              </div>
            </div>

            <p v-if="allocateError" class="text-[11px] text-red-400">{{ allocateError }}</p>

            <div class="flex justify-end">
              <button
                class="px-3.5 py-[7px] rounded-sm text-[11px] font-bold bg-acid text-black cursor-pointer disabled:opacity-50"
                :disabled="allocateSaving || !selectedPool"
                @click="submitAllocate"
              >{{ allocateSaving ? 'Asignando…' : 'Asignar cupo' }}</button>
            </div>
          </template>
        </template>
      </div>
    </template>
  </AppModal>
</template>
