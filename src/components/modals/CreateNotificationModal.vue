<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  useNotifications,
  CHANNEL_LABELS,
  type NotificationChannel,
  type NotificationPriority,
} from '@/composables/useNotifications'
import {
  useNotificationTemplates,
  type NotificationTemplateListItem,
} from '@/composables/useNotificationTemplates'
import type { Activity } from '@/composables/useActivities'
import {
  browserZone,
  inputValueToIso,
  COMMON_TIMEZONES,
} from '@/utils/datetime'

const props = defineProps<{ show: boolean; activity: Activity | null }>()
const emit = defineEmits<{
  close: []
  created: [notifUuid: string]
  'add-contacts': [notifUuid: string, channel: NotificationChannel]
}>()

const api = useNotifications()
const templateApi = useNotificationTemplates()

// ─── Step ─────────────────────────────────────────────────────────────────────

type Step = 'form' | 'done'
const step = ref<Step>('form')
const createdUuid = ref('')
const createdChannel = ref<NotificationChannel>('whatsapp')

// ─── Form state ───────────────────────────────────────────────────────────────

const title = ref('')
const channel = ref<NotificationChannel>('whatsapp')
const message = ref('')
const priority = ref<NotificationPriority>('normal')
const scheduleMode = ref<'reminder' | 'datetime' | 'now'>('reminder')
const reminderMinutes = ref(60)
const scheduledAt = ref('')
const scheduleTimezone = ref(browserZone())
const selectedTemplateUuid = ref<string>('')

const saving = ref(false)
const saveError = ref('')

// ─── WhatsApp templates ───────────────────────────────────────────────────────

const waTemplates = ref<NotificationTemplateListItem[]>([])
const templatesLoading = ref(false)

async function loadWaTemplates() {
  if (waTemplates.value.length) return
  templatesLoading.value = true
  try {
    const all = await templateApi.listTemplates()
    waTemplates.value = all.filter((t) => t.channel === 'whatsapp' && t.is_active)
  } catch {
    // non-critical
  } finally {
    templatesLoading.value = false
  }
}

function autoSelectDefaultTemplate() {
  const def = waTemplates.value.find((t) => t.is_default) ?? waTemplates.value[0]
  selectedTemplateUuid.value = def?.uuid ?? ''
}

watch(
  () => channel.value,
  (ch) => {
    if (ch === 'whatsapp') loadWaTemplates().then(autoSelectDefaultTemplate)
  },
)

// ─── Static options ───────────────────────────────────────────────────────────

const CHANNELS: NotificationChannel[] = ['whatsapp', 'email', 'sms']
const PRIORITIES: NotificationPriority[] = ['low', 'normal', 'high', 'urgent']
const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
}
const REMINDER_OPTIONS = [
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 1440, label: '1 día antes' },
]

// ─── Init ─────────────────────────────────────────────────────────────────────

watch(
  () => props.show,
  async (v) => {
    if (v && props.activity) {
      step.value = 'form'
      createdUuid.value = ''
      title.value = `Recordatorio: ${props.activity.title}`
      channel.value = 'whatsapp'
      message.value = ''
      priority.value = 'normal'
      scheduleMode.value = 'reminder'
      reminderMinutes.value = props.activity.activity_type?.default_reminder_minutes?.[0] ?? 60
      scheduledAt.value = ''
      scheduleTimezone.value = props.activity.timezone || browserZone()
      saveError.value = ''
      selectedTemplateUuid.value = ''
      await loadWaTemplates()
      autoSelectDefaultTemplate()
    }
  },
)

// ─── Save ─────────────────────────────────────────────────────────────────────

async function save() {
  if (!props.activity || !title.value.trim()) return
  saving.value = true
  saveError.value = ''
  try {
    const notif = await api.createNotification({
      title: title.value.trim(),
      message: message.value.trim() || undefined,
      channel: channel.value,
      priority: priority.value,
      activity: props.activity.uuid,
      tour: props.activity.tour ?? undefined,
      template: channel.value === 'whatsapp' && selectedTemplateUuid.value
        ? selectedTemplateUuid.value
        : undefined,
    })

    if (scheduleMode.value === 'reminder') {
      await api.scheduleNotification(notif.uuid, {
        reminder_minutes: reminderMinutes.value,
        send_timezone: scheduleTimezone.value,
      })
    } else if (scheduleMode.value === 'datetime' && scheduledAt.value) {
      await api.scheduleNotification(notif.uuid, {
        scheduled_for: inputValueToIso(scheduledAt.value, scheduleTimezone.value) ?? undefined,
        send_timezone: scheduleTimezone.value,
      })
    }

    createdUuid.value = notif.uuid
    createdChannel.value = notif.channel
    emit('created', notif.uuid)
    step.value = 'done'
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al crear notificación'
  } finally {
    saving.value = false
  }
}

function finish() {
  emit('close')
}

function goAddContacts() {
  emit('add-contacts', createdUuid.value, createdChannel.value)
  emit('close')
}

// ─── Derived ──────────────────────────────────────────────────────────────────

const canSave = computed(() => {
  if (!title.value.trim()) return false
  if (channel.value === 'whatsapp' && !selectedTemplateUuid.value) return false
  return true
})

const inputClass =
  'w-full bg-glass border border-line rounded-lg px-3 py-2 text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 transition-colors'
const labelClass = 'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
const selectClass =
  'w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors cursor-pointer'
</script>

<template>
  <AppModal :show="show" @close="emit('close')">

    <!-- ── STEP: done ──────────────────────────────────────────────────────── -->
    <template v-if="step === 'done'">
      <div class="flex flex-col items-center py-6 gap-4">
        <!-- Icon -->
        <div class="w-12 h-12 rounded-full flex items-center justify-center"
          style="background: rgba(168,216,0,0.12)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a8d800" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="text-center">
          <p class="text-[15px] font-bold text-ink">Notificación creada</p>
          <p class="text-[11px] text-ink-3 mt-1">¿Deseas agregar contactos ahora?</p>
        </div>
        <div class="flex gap-2 w-full mt-1">
          <button
            class="flex-1 py-2.5 rounded-lg font-semibold text-[12px] bg-acid text-black cursor-pointer border-none transition-all hover:bg-[#b8e800]"
            @click="goAddContacts"
          >
            <svg class="inline mr-1.5 -mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>
            </svg>
            Agregar contactos
          </button>
          <button
            class="px-4 py-2.5 rounded-lg font-semibold text-[12px] bg-glass border border-line text-ink-2 cursor-pointer hover:bg-glass-hover transition-colors"
            @click="finish"
          >
            Listo
          </button>
        </div>
      </div>
    </template>

    <!-- ── STEP: form ──────────────────────────────────────────────────────── -->
    <template v-else>
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div>
          <p class="text-base font-bold text-ink tracking-[-0.2px]">Nueva Notificación</p>
          <p v-if="activity" class="text-[10px] text-ink-3 mt-0.5 truncate max-w-[260px]">
            {{ activity.title }}
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

      <div class="space-y-3 max-h-[65vh] overflow-y-auto pr-1">

        <!-- Title -->
        <div>
          <label :class="labelClass">Título *</label>
          <input v-model="title" :class="inputClass" placeholder="Título de la notificación" />
        </div>

        <!-- Channel + Priority -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">Canal</label>
            <select v-model="channel" :class="selectClass">
              <option v-for="c in CHANNELS" :key="c" :value="c">{{ CHANNEL_LABELS[c] }}</option>
            </select>
          </div>
          <div>
            <label :class="labelClass">Prioridad</label>
            <select v-model="priority" :class="selectClass">
              <option v-for="p in PRIORITIES" :key="p" :value="p">{{ PRIORITY_LABELS[p] }}</option>
            </select>
          </div>
        </div>

        <!-- WhatsApp template -->
        <div v-if="channel === 'whatsapp'">
          <label :class="labelClass">Template WhatsApp *</label>
          <select v-model="selectedTemplateUuid" :class="selectClass" :disabled="templatesLoading">
            <option value="" disabled>
              {{ templatesLoading ? 'Cargando templates…' : 'Selecciona un template' }}
            </option>
            <option v-for="t in waTemplates" :key="t.uuid" :value="t.uuid">
              {{ t.name }}{{ t.is_default ? ' (predeterminado)' : '' }}
            </option>
          </select>
          <p v-if="!templatesLoading && waTemplates.length === 0" class="text-[11px] text-[#f59e0b] mt-1">
            No hay templates de WhatsApp activos. Crea uno en Configuración → Templates.
          </p>
        </div>

        <!-- Message (email/sms) -->
        <div v-if="channel !== 'whatsapp'">
          <label :class="labelClass">Mensaje</label>
          <textarea v-model="message" :class="inputClass" rows="3" placeholder="Contenido del mensaje…" style="resize: vertical;" />
        </div>

        <!-- Scheduling -->
        <div>
          <label :class="labelClass">Programación</label>
          <div class="grid grid-cols-3 gap-1.5 mb-2">
            <button
              v-for="mode in (['reminder', 'datetime', 'now'] as const)"
              :key="mode"
              class="py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer"
              :class="scheduleMode === mode
                ? 'bg-acid text-black border-acid'
                : 'bg-glass text-ink-2 border-line hover:bg-glass-hover'"
              @click="scheduleMode = mode"
            >
              {{ mode === 'reminder' ? 'Recordatorio' : mode === 'datetime' ? 'Fecha exacta' : 'Borrador' }}
            </button>
          </div>
          <select v-if="scheduleMode === 'reminder'" v-model="reminderMinutes" :class="selectClass">
            <option v-for="opt in REMINDER_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <input
            v-else-if="scheduleMode === 'datetime'"
            v-model="scheduledAt"
            type="datetime-local"
            :class="inputClass"
          />
          <p v-else class="text-[11px] text-ink-3">
            Se guardará como borrador. Podrás programarla o enviarla manualmente después.
          </p>

          <!-- Timezone selector — visible for reminder and datetime modes -->
          <div v-if="scheduleMode !== 'now'" class="mt-2">
            <label :class="labelClass">Zona horaria</label>
            <select v-model="scheduleTimezone" :class="selectClass">
              <option v-for="tz in COMMON_TIMEZONES" :key="tz.value" :value="tz.value">
                {{ tz.label }}
              </option>
            </select>
            <p class="text-[10px] text-ink-4 mt-1">
              La notificación se enviará a la hora indicada en esta zona. Zona de la actividad:
              <span class="text-ink-3 font-medium">{{ activity?.timezone || 'UTC' }}</span>
            </p>
          </div>
        </div>

      </div>

      <!-- Error -->
      <div v-if="saveError" class="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
        <p class="text-[11px] text-red-400 whitespace-pre-line font-mono">{{ saveError }}</p>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 mt-4">
        <button
          class="flex-1 py-2.5 rounded-lg font-semibold text-[12px] border-none cursor-pointer transition-all"
          :class="saving || !canSave ? 'bg-glass text-ink-4 cursor-not-allowed' : 'bg-acid text-black'"
          :disabled="saving || !canSave"
          @click="save"
        >
          {{ saving ? 'Creando…' : 'Crear notificación' }}
        </button>
        <button
          class="px-4 py-2.5 rounded-lg font-semibold text-[12px] bg-glass border border-line text-ink-2 cursor-pointer hover:bg-glass-hover transition-colors"
          @click="emit('close')"
        >
          Cancelar
        </button>
      </div>
    </template>

  </AppModal>
</template>
