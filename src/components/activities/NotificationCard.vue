<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  useNotifications,
  CHANNEL_LABELS,
  NOTIF_STATUS_LABELS,
  NOTIF_STATUS_COLORS,
  type NotificationListItem,
  type NotificationRecipient,
} from '@/composables/useNotifications'
import { formatInZone, browserZone } from '@/utils/datetime'
import AddContactsToNotificationModal from '@/components/modals/AddContactsToNotificationModal.vue'
import EditRecipientModal from '@/components/modals/EditRecipientModal.vue'
import EditNotificationModal from '@/components/modals/EditNotificationModal.vue'

const props = defineProps<{ notification: NotificationListItem; activityUuid: string }>()
const emit = defineEmits<{ refresh: [] }>()

const api = useNotifications()
const showAddContacts = ref(false)
const showEdit = ref(false)
const actionLoading = ref(false)
const actionError = ref('')
const showDeleteConfirm = ref(false)
const expanded = ref(false)

// Recipients list
const recipients = ref<NotificationRecipient[]>([])
const loadingRecipients = ref(false)
const editingRecipient = ref<NotificationRecipient | null>(null)

watch(expanded, async (val) => {
  if (val && recipients.value.length === 0) {
    await loadRecipients()
  }
})

async function loadRecipients() {
  loadingRecipients.value = true
  try {
    recipients.value = await api.listContacts(props.notification.uuid)
  } catch {
    recipients.value = []
  } finally {
    loadingRecipients.value = false
  }
}

function formatDateTime(iso: string | null | undefined, zone?: string): string {
  return formatInZone(iso, zone || browserZone())
}

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  sent: '#1a8fff',
  delivered: '#1fad5a',
  read: '#a8d800',
  failed: '#f87171',
  skipped: '#64748b',
}

const n = props.notification
const colors = NOTIF_STATUS_COLORS[n.status]

async function send() {
  actionLoading.value = true
  actionError.value = ''
  try {
    await api.sendNotification(n.uuid)
    emit('refresh')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Error al enviar'
  } finally {
    actionLoading.value = false
  }
}

async function cancel() {
  actionLoading.value = true
  actionError.value = ''
  try {
    await api.cancelNotification(n.uuid)
    emit('refresh')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Error al cancelar'
  } finally {
    actionLoading.value = false
  }
}

async function doDelete() {
  actionLoading.value = true
  actionError.value = ''
  try {
    await api.deleteNotification(n.uuid)
    emit('refresh')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Error al eliminar'
    showDeleteConfirm.value = false
  } finally {
    actionLoading.value = false
  }
}

async function onContactsAdded() {
  showAddContacts.value = false
  await loadRecipients()
  emit('refresh')
}

const canSend = ['draft', 'scheduled', 'failed'].includes(n.status)
const canCancel = ['draft', 'scheduled'].includes(n.status)
const canDelete = !['sending', 'sent'].includes(n.status)
const canAddContacts = ['draft', 'scheduled'].includes(n.status)
const canEdit = ['draft', 'scheduled', 'failed'].includes(n.status)
</script>

<template>
  <div class="bg-glass border border-line rounded-xl overflow-hidden">
    <!-- Main row -->
    <button
      class="w-full flex items-center gap-3 px-3 py-2.5 text-left border-none bg-transparent cursor-pointer hover:bg-glass-hover transition-colors"
      @click="expanded = !expanded"
    >
      <!-- Channel badge -->
      <span
        class="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
        style="background: rgba(168,216,0,0.1); color: #a8d800"
      >{{ CHANNEL_LABELS[notification.channel] }}</span>

      <!-- Title + meta -->
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-medium text-ink truncate">{{ notification.title }}</p>
        <p class="text-[10px] text-ink-4">
          <span v-if="notification.scheduled_for">{{ formatDateTime(notification.scheduled_for, notification.send_timezone) }}</span>
          <span v-else>Sin programar</span>
          <span v-if="notification.recipient_count"> · {{ notification.recipient_count }} contacto{{ notification.recipient_count !== 1 ? 's' : '' }}</span>
        </p>
      </div>

      <!-- Status pill -->
      <span
        class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
        :style="{ background: colors.bg, color: colors.text }"
      >
        {{ NOTIF_STATUS_LABELS[notification.status] }}
      </span>

      <!-- Chevron -->
      <svg
        class="flex-shrink-0 text-ink-4 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- Expanded content -->
    <div v-if="expanded" class="border-t border-line">

      <!-- Recipients list -->
      <div class="px-3 pt-2.5 pb-2">
        <p class="text-[9px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-1.5">Contactos</p>

        <div v-if="loadingRecipients" class="flex items-center justify-center py-2">
          <svg class="animate-spin text-ink-4" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
          </svg>
        </div>

        <p v-else-if="recipients.length === 0" class="text-[11px] text-ink-4 italic py-1">
          Sin contactos asignados
        </p>

        <div v-else class="space-y-0.5 max-h-36 overflow-y-auto">
          <button
            v-for="r in recipients"
            :key="r.contact_uuid ?? r.email ?? r.phone ?? ''"
            class="w-full flex items-center gap-2 py-1.5 px-1.5 rounded-lg border-none bg-transparent text-left cursor-pointer hover:bg-glass transition-colors group"
            @click="editingRecipient = r"
          >
            <!-- Status dot -->
            <span
              class="w-1.5 h-1.5 rounded-full flex-shrink-0"
              :style="{ background: RECIPIENT_STATUS_COLORS[r.status] ?? '#94a3b8' }"
            />
            <!-- Name + contact -->
            <div class="flex-1 min-w-0">
              <p class="text-[11px] text-ink truncate">{{ r.contact_name || r.recipient_display || '—' }}</p>
              <p class="text-[10px] text-ink-4 truncate">{{ r.contact_email || r.contact_phone || r.email || r.phone || '' }}</p>
            </div>
            <!-- Status label + edit hint -->
            <span class="text-[9px] text-ink-4 flex-shrink-0 capitalize group-hover:hidden">{{ r.status }}</span>
            <svg class="hidden group-hover:block flex-shrink-0 text-ink-3" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="px-3 pb-3 space-y-2">
        <p v-if="actionError" class="text-[11px] text-red-400">{{ actionError }}</p>

        <div class="flex flex-wrap gap-1.5">
          <!-- Edit -->
          <button
            v-if="canEdit"
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
            @click="showEdit = true"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </button>

          <!-- Add contacts -->
          <button
            v-if="canAddContacts"
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
            @click="showAddContacts = true"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>
            </svg>
            Agregar contactos
          </button>

          <!-- Send now -->
          <button
            v-if="canSend"
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border-none cursor-pointer transition-all"
            :class="actionLoading ? 'opacity-50 bg-acid/80 text-black' : 'bg-acid text-black'"
            :disabled="actionLoading"
            @click="send"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {{ actionLoading ? '…' : 'Enviar ahora' }}
          </button>

          <!-- Cancel -->
          <button
            v-if="canCancel"
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
            :disabled="actionLoading"
            @click="cancel"
          >
            Cancelar
          </button>

          <!-- Delete -->
          <template v-if="canDelete">
            <button
              v-if="!showDeleteConfirm"
              class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-4 hover:text-red-400 hover:border-red-400/30 cursor-pointer transition-colors"
              @click="showDeleteConfirm = true"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
              Eliminar
            </button>
            <div v-else class="flex gap-1">
              <button
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border-none"
                style="background: rgba(239,68,68,0.15); color: #f87171"
                :class="actionLoading ? 'opacity-50' : ''"
                @click="doDelete"
              >{{ actionLoading ? '…' : 'Confirmar' }}</button>
              <button
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
                @click="showDeleteConfirm = false"
              >Cancelar</button>
            </div>
          </template>
        </div>

        <!-- Sent summary -->
        <p v-if="notification.status === 'sent'" class="text-[11px] text-ink-3">
          Enviada {{ formatDateTime(notification.sent_at, notification.send_timezone) }}
          <span v-if="notification.recipient_count">
            · {{ notification.recipient_count }} destinatario{{ notification.recipient_count !== 1 ? 's' : '' }}
          </span>
        </p>
      </div>
    </div>

    <!-- Modals -->
    <AddContactsToNotificationModal
      :show="showAddContacts"
      :notification-uuid="notification.uuid"
      :channel="notification.channel"
      @close="showAddContacts = false"
      @added="onContactsAdded"
    />

    <EditNotificationModal
      :show="showEdit"
      :notification-uuid="notification.uuid"
      @close="showEdit = false"
      @saved="() => { showEdit = false; emit('refresh') }"
    />

    <EditRecipientModal
      :show="!!editingRecipient"
      :recipient="editingRecipient"
      :notification-uuid="notification.uuid"
      @close="editingRecipient = null"
      @updated="() => { editingRecipient = null; loadRecipients() }"
      @removed="() => { editingRecipient = null; loadRecipients(); emit('refresh') }"
    />
  </div>
</template>
