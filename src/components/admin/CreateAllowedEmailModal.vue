<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useAdminAllowlist } from '@/composables/useAdminAllowlist'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; created: [] }>()

const api = useAdminAllowlist()
const email = ref('')
const notes = ref('')
const saving = ref(false)
const error = ref('')

watch(
  () => props.show,
  (v) => {
    if (v) {
      email.value = ''
      notes.value = ''
      error.value = ''
    }
  },
)

async function submit() {
  if (!email.value.trim()) return
  saving.value = true
  error.value = ''
  try {
    await api.create({ email: email.value.trim(), notes: notes.value.trim() || undefined })
    emit('created')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al invitar'
  } finally {
    saving.value = false
  }
}

const inputClass =
  'w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors'
const labelClass = 'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
</script>

<template>
  <AppModal
    :show="show"
    @close="emit('close')"
  >
    <p class="text-base font-bold text-ink tracking-[-0.2px] mb-4">
      Invitar cliente
    </p>

    <div class="space-y-3">
      <div>
        <label :class="labelClass">Email *</label>
        <input
          v-model="email"
          type="email"
          :class="inputClass"
          placeholder="cliente@ejemplo.com"
        >
      </div>
      <div>
        <label :class="labelClass">Notas</label>
        <textarea
          v-model="notes"
          :class="inputClass"
          rows="2"
          placeholder="Contexto interno (opcional)"
          style="resize: vertical"
        />
      </div>

      <p
        v-if="error"
        class="text-[11px] text-red-400"
      >
        {{ error }}
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <button
          class="px-3.5 py-[7px] rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          class="px-3.5 py-[7px] rounded-sm text-[11px] font-bold bg-acid text-black cursor-pointer disabled:opacity-50"
          :disabled="saving || !email.trim()"
          @click="submit"
        >
          {{ saving ? 'Invitando…' : 'Invitar' }}
        </button>
      </div>
    </div>
  </AppModal>
</template>
