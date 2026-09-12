<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useAdminPlans, type Plan } from '@/composables/useAdminPlans'
import type { PlanCode } from '@/composables/useAdminSubscriptions'

const props = defineProps<{ show: boolean; plan: Plan | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const api = useAdminPlans()
const PLAN_CODES: PlanCode[] = ['free', 'starter', 'premium', 'custom']

const code = ref<PlanCode>('free')
const name = ref('')
const description = ref('')
const notificationLimit = ref(0)
const maxShows = ref(0)
const price = ref('')
const currency = ref('EUR')
const isActive = ref(true)
const isDefault = ref(false)
const displayOrder = ref(0)
const saving = ref(false)
const error = ref('')

const isEdit = computed(() => !!props.plan)

watch(
  () => [props.show, props.plan] as const,
  ([show, p]) => {
    if (!show) return
    code.value = p?.code ?? 'free'
    name.value = p?.name ?? ''
    description.value = p?.description ?? ''
    notificationLimit.value = p?.notification_limit ?? 0
    maxShows.value = p?.max_shows ?? 0
    price.value = p?.price ?? '0.00'
    currency.value = p?.currency ?? 'EUR'
    isActive.value = p?.is_active ?? true
    isDefault.value = p?.is_default ?? false
    displayOrder.value = p?.display_order ?? 0
    error.value = ''
  },
  { immediate: true },
)

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      name: name.value.trim(),
      description: description.value.trim(),
      notification_limit: notificationLimit.value,
      max_shows: maxShows.value,
      price: price.value,
      currency: currency.value,
      is_active: isActive.value,
      is_default: isDefault.value,
      display_order: displayOrder.value,
    }
    if (isEdit.value && props.plan) {
      await api.update(props.plan.uuid, payload)
    } else {
      await api.create({ code: code.value, ...payload })
    }
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}

const inputClass =
  'w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors'
const labelClass = 'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <p class="text-base font-bold text-ink tracking-[-0.2px] mb-1">{{ isEdit ? 'Editar plan' : 'Nuevo plan' }}</p>
    <p v-if="isEdit && plan" class="text-[11px] text-ink-4 mb-4 uppercase tracking-[0.4px]">{{ plan.code }}</p>
    <p v-else class="text-[11px] text-ink-4 mb-4">
      El código debe ser único — si los 4 planes base ya existen, el backend rechaza el duplicado.
    </p>

    <div class="space-y-3">
        <div v-if="!isEdit">
          <label :class="labelClass">Código</label>
          <select v-model="code" :class="inputClass">
            <option v-for="c in PLAN_CODES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div>
          <label :class="labelClass">Nombre</label>
          <input v-model="name" :class="inputClass" />
        </div>
        <div>
          <label :class="labelClass">Descripción</label>
          <textarea v-model="description" :class="inputClass" rows="2" style="resize: vertical" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label :class="labelClass">Límite notifs. (0 = ilimitado)</label>
            <input v-model.number="notificationLimit" type="number" min="0" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Límite shows (0 = ilimitado)</label>
            <input v-model.number="maxShows" type="number" min="0" :class="inputClass" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label :class="labelClass">Precio</label>
            <input v-model="price" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Moneda</label>
            <input v-model="currency" :class="inputClass" />
          </div>
        </div>
        <div>
          <label :class="labelClass">Orden de visualización</label>
          <input v-model.number="displayOrder" type="number" :class="inputClass" />
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="isActive" type="checkbox" class="cursor-pointer" />
          <span class="text-[12px] text-ink-2">Plan activo (visible en el catálogo)</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="isDefault" type="checkbox" class="cursor-pointer" />
          <span class="text-[12px] text-ink-2">Plan por defecto (preseleccionado para giras nuevas)</span>
        </label>

        <p v-if="error" class="text-[11px] text-red-400">{{ error }}</p>

        <div class="flex justify-end gap-2 pt-1">
          <button
            class="px-3.5 py-[7px] rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
            @click="emit('close')"
          >Cancelar</button>
          <button
            class="px-3.5 py-[7px] rounded-sm text-[11px] font-bold bg-acid text-black cursor-pointer disabled:opacity-50"
            :disabled="saving"
            @click="submit"
          >{{ saving ? 'Guardando…' : 'Guardar' }}</button>
        </div>
    </div>
  </AppModal>
</template>
