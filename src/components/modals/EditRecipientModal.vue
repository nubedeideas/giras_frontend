<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useNotifications, type NotificationRecipient } from '@/composables/useNotifications'
import { useContacts } from '@/composables/useContacts'

const props = defineProps<{
  show: boolean
  recipient: NotificationRecipient | null
  notificationUuid: string
}>()
const emit = defineEmits<{ close: []; updated: []; removed: [] }>()

const notifApi = useNotifications()
const contactsApi = useContacts()

// Form fields
const firstName = ref('')
const lastName = ref('')
const email = ref('')
const phone = ref('')

const saving = ref(false)
const saveError = ref('')
const removing = ref(false)
const showRemoveConfirm = ref(false)

const inputClass =
  'w-full bg-glass border border-line rounded-lg px-3 py-2 text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 transition-colors'
const labelClass = 'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'

watch(
  () => props.show,
  (v) => {
    if (v && props.recipient) {
      const parts = (props.recipient.contact_name ?? '').trim().split(' ')
      firstName.value = parts[0] ?? ''
      lastName.value = parts.slice(1).join(' ')
      email.value = props.recipient.contact_email ?? props.recipient.email ?? ''
      phone.value = props.recipient.contact_phone ?? props.recipient.phone ?? ''
      saveError.value = ''
      showRemoveConfirm.value = false
    }
  },
)

const hasContact = (r: NotificationRecipient | null): r is NotificationRecipient & { contact_uuid: string } =>
  !!r?.contact_uuid

async function save() {
  if (!props.recipient) return
  saving.value = true
  saveError.value = ''
  try {
    if (hasContact(props.recipient)) {
      await contactsApi.updateContact(props.recipient.contact_uuid, {
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        primary_email: email.value.trim(),
        primary_phone: phone.value.trim(),
      })
    }
    emit('updated')
    emit('close')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.recipient) return
  removing.value = true
  saveError.value = ''
  try {
    if (hasContact(props.recipient)) {
      await notifApi.removeContacts(props.notificationUuid, [props.recipient.contact_uuid])
    }
    emit('removed')
    emit('close')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al quitar contacto'
    showRemoveConfirm.value = false
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <!-- Header -->
    <div class="flex items-start justify-between mb-4">
      <div>
        <p class="text-base font-bold text-ink tracking-[-0.2px]">Editar Contacto</p>
        <p v-if="recipient?.contact_name" class="text-[10px] text-ink-3 mt-0.5">
          {{ recipient.contact_name }}
        </p>
      </div>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover flex-shrink-0"
        @click="emit('close')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="space-y-3">

      <!-- Name row (only for linked contacts) -->
      <template v-if="hasContact(recipient)">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">Nombre</label>
            <input v-model="firstName" :class="inputClass" placeholder="Nombre" />
          </div>
          <div>
            <label :class="labelClass">Apellido</label>
            <input v-model="lastName" :class="inputClass" placeholder="Apellido" />
          </div>
        </div>
      </template>

      <!-- Email -->
      <div>
        <label :class="labelClass">Email</label>
        <input
          v-model="email"
          :class="inputClass"
          :readonly="!hasContact(recipient)"
          placeholder="email@ejemplo.com"
          type="email"
        />
      </div>

      <!-- Phone -->
      <div>
        <label :class="labelClass">Teléfono</label>
        <input
          v-model="phone"
          :class="inputClass"
          :readonly="!hasContact(recipient)"
          placeholder="+1 555 000 0000"
          type="tel"
        />
      </div>

    </div>

    <!-- Error -->
    <p v-if="saveError" class="text-[11px] text-red-400 mt-2">{{ saveError }}</p>

    <!-- Actions -->
    <div class="flex gap-2 mt-4">
      <!-- Save (only for linked contacts) -->
      <button
        v-if="hasContact(recipient)"
        class="flex-1 py-2.5 rounded-lg font-semibold text-[12px] border-none cursor-pointer transition-all"
        :class="saving ? 'bg-glass text-ink-4 cursor-not-allowed' : 'bg-acid text-black'"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>

      <!-- Remove from notification -->
      <template v-if="!showRemoveConfirm">
        <button
          class="px-4 py-2.5 rounded-lg font-semibold text-[12px] border border-line bg-glass cursor-pointer transition-colors"
          :class="hasContact(recipient) ? 'text-ink-4 hover:text-red-400 hover:border-red-400/30' : 'flex-1 text-red-400 hover:bg-red-400/10'"
          @click="showRemoveConfirm = true"
        >
          Quitar de notificación
        </button>
      </template>
      <template v-else>
        <button
          class="flex-1 py-2.5 rounded-lg font-semibold text-[12px] border-none cursor-pointer"
          style="background: rgba(239,68,68,0.15); color: #f87171"
          :class="removing ? 'opacity-50' : ''"
          :disabled="removing"
          @click="remove"
        >
          {{ removing ? '…' : 'Confirmar quitar' }}
        </button>
        <button
          class="px-4 py-2.5 rounded-lg font-semibold text-[12px] bg-glass border border-line text-ink-2 cursor-pointer hover:bg-glass-hover"
          @click="showRemoveConfirm = false"
        >
          Cancelar
        </button>
      </template>
    </div>
  </AppModal>
</template>
