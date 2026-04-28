<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  useNotifications,
  CHANNEL_LABELS,
  NOTIF_STATUS_LABELS,
  type Notification,
  type NotificationPriority,
  type NotificationChannel,
} from '@/composables/useNotifications'
import {
  useNotificationTemplates,
  type NotificationTemplateListItem,
} from '@/composables/useNotificationTemplates'
import {
  browserZone,
  isoToInputValue,
  inputValueToIso,
  formatInZone,
  COMMON_TIMEZONES,
} from '@/utils/datetime'

const props = defineProps<{ show: boolean; notificationUuid: string | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const api = useNotifications()
const templateApi = useNotificationTemplates()

// ─── State ────────────────────────────────────────────────────────────────────

const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')

const original = ref<Notification | null>(null)

// Form fields
const title = ref('')
const message = ref('')
const priority = ref<NotificationPriority>('normal')
const selectedTemplateUuid = ref('')
const scheduledAt = ref('') // YYYY-MM-DDTHH:MM en la zona de scheduleTimezone
const scheduleTimezone = ref(browserZone())
const changeSchedule = ref(false)

const waTemplates = ref<NotificationTemplateListItem[]>([])
const templatesLoading = ref(false)

const PRIORITIES: NotificationPriority[] = ['low', 'normal', 'high', 'urgent']
const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
}

// ─── Load templates ───────────────────────────────────────────────────────────

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

// ─── Load notification ────────────────────────────────────────────────────────

async function load() {
  if (!props.notificationUuid) return
  loading.value = true
  loadError.value = ''
  try {
    const notif = await api.getNotification(props.notificationUuid)
    original.value = notif

    title.value = notif.title
    message.value = notif.message ?? ''
    priority.value = notif.priority
    selectedTemplateUuid.value = notif.template?.uuid ?? ''
    changeSchedule.value = false

    // Pre-fill scheduling: show time in the notification's own timezone
    const zone = notif.send_timezone || browserZone()
    scheduleTimezone.value = zone
    scheduledAt.value = isoToInputValue(notif.scheduled_for, zone)

    if (notif.channel === 'whatsapp') {
      await loadWaTemplates()
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Error al cargar notificación'
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (v) => {
    if (v) {
      original.value = null
      saveError.value = ''
      load()
    }
  },
)

// ─── Save ─────────────────────────────────────────────────────────────────────

async function save() {
  if (!props.notificationUuid || !title.value.trim()) return
  saving.value = true
  saveError.value = ''
  try {
    const payload: Parameters<typeof api.updateNotification>[1] = {
      title: title.value.trim(),
      priority: priority.value,
    }

    if (original.value?.channel !== 'whatsapp') {
      payload.message = message.value.trim() || undefined
    } else {
      payload.template = selectedTemplateUuid.value || null
    }

    if (changeSchedule.value) {
      payload.scheduled_for = inputValueToIso(scheduledAt.value, scheduleTimezone.value)
      payload.send_timezone = scheduleTimezone.value
    }

    await api.updateNotification(props.notificationUuid, payload)

    // If user changed schedule and notification is still draft, also call schedule endpoint
    if (changeSchedule.value && scheduledAt.value && original.value?.status === 'draft') {
      await api.scheduleNotification(props.notificationUuid, {
        scheduled_for: inputValueToIso(scheduledAt.value, scheduleTimezone.value) ?? undefined,
        send_timezone: scheduleTimezone.value,
      })
    }

    emit('saved')
    emit('close')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al guardar notificación'
  } finally {
    saving.value = false
  }
}

// ─── Derived ──────────────────────────────────────────────────────────────────

const channel = computed<NotificationChannel>(() => original.value?.channel ?? 'email')

const statusColor = computed(() => {
  const s = original.value?.status
  if (!s) return { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' }
  const map: Record<string, { bg: string; text: string }> = {
    draft:     { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
    scheduled: { bg: 'rgba(26,143,255,0.12)',  text: '#1a8fff' },
    sending:   { bg: 'rgba(168,216,0,0.12)',   text: '#a8d800' },
    sent:      { bg: 'rgba(31,173,90,0.15)',   text: '#34d399' },
    failed:    { bg: 'rgba(239,68,68,0.12)',   text: '#f87171' },
    cancelled: { bg: 'rgba(100,116,139,0.10)', text: '#64748b' },
  }
  return map[s] ?? map.draft
})

function formatScheduled(iso: string | null | undefined) {
  if (!iso) return 'Sin programar'
  return formatInZone(iso, scheduleTimezone.value)
}

const inputClass =
  'w-full bg-glass border border-line rounded-lg px-3 py-2 text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 transition-colors'
const labelClass = 'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
const selectClass =
  'w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors cursor-pointer'
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <!-- Header -->
    <div class="flex items-start justify-between mb-4">
      <div>
        <p class="text-base font-bold text-ink tracking-[-0.2px]">Editar Notificación</p>
        <div v-if="original" class="flex items-center gap-2 mt-1">
          <!-- Channel badge -->
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-glass border border-line text-ink-3">
            {{ CHANNEL_LABELS[channel] }}
          </span>
          <!-- Status badge -->
          <span
            class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            :style="{ background: statusColor.bg, color: statusColor.text }"
          >
            {{ NOTIF_STATUS_LABELS[original.status] }}
          </span>
        </div>
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

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-8">
      <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
      </svg>
    </div>

    <p v-else-if="loadError" class="text-[11px] text-red-400 py-4 text-center">{{ loadError }}</p>

    <template v-else-if="original">
      <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">

        <!-- Title -->
        <div>
          <label :class="labelClass">Título *</label>
          <input v-model="title" :class="inputClass" placeholder="Título de la notificación" />
        </div>

        <!-- Priority -->
        <div>
          <label :class="labelClass">Prioridad</label>
          <select v-model="priority" :class="selectClass">
            <option v-for="p in PRIORITIES" :key="p" :value="p">{{ PRIORITY_LABELS[p] }}</option>
          </select>
        </div>

        <!-- WhatsApp template -->
        <div v-if="channel === 'whatsapp'">
          <label :class="labelClass">Template WhatsApp</label>
          <select v-model="selectedTemplateUuid" :class="selectClass" :disabled="templatesLoading">
            <option value="">{{ templatesLoading ? 'Cargando…' : 'Sin template' }}</option>
            <option v-for="t in waTemplates" :key="t.uuid" :value="t.uuid">
              {{ t.name }}{{ t.is_default ? ' (predeterminado)' : '' }}
            </option>
          </select>
        </div>

        <!-- Message -->
        <div v-else>
          <label :class="labelClass">Mensaje</label>
          <textarea
            v-model="message"
            :class="inputClass"
            rows="3"
            placeholder="Contenido del mensaje…"
            style="resize: vertical;"
          />
        </div>

        <!-- Scheduling -->
        <div class="bg-glass border border-line rounded-lg px-3 py-2.5">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase">Programación</span>
            <button
              class="text-[10px] font-medium cursor-pointer border-none bg-transparent transition-colors"
              :class="changeSchedule ? 'text-acid' : 'text-ink-4 hover:text-ink'"
              @click="changeSchedule = !changeSchedule"
            >
              {{ changeSchedule ? 'Cancelar cambio' : 'Cambiar' }}
            </button>
          </div>

          <!-- Current scheduled time (read-only display) -->
          <p v-if="!changeSchedule" class="text-[12px] text-ink">
            {{ formatScheduled(original.scheduled_for) }}
          </p>

          <!-- New datetime picker + timezone -->
          <div v-else class="mt-1.5 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[9px] text-ink-4 uppercase tracking-[0.4px] block mb-1">Fecha y hora</label>
                <input
                  v-model="scheduledAt"
                  type="datetime-local"
                  :class="inputClass"
                />
              </div>
              <div>
                <label class="text-[9px] text-ink-4 uppercase tracking-[0.4px] block mb-1">Zona horaria</label>
                <select v-model="scheduleTimezone" :class="selectClass">
                  <option v-for="tz in COMMON_TIMEZONES" :key="tz.value" :value="tz.value">
                    {{ tz.label }}
                  </option>
                </select>
              </div>
            </div>
            <p class="text-[10px] text-ink-4">Deja la fecha en blanco para guardar como borrador sin programar.</p>
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
          :class="saving || !title.trim() ? 'bg-glass text-ink-4 cursor-not-allowed' : 'bg-acid text-black'"
          :disabled="saving || !title.trim()"
          @click="save"
        >
          {{ saving ? 'Guardando…' : 'Guardar cambios' }}
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
