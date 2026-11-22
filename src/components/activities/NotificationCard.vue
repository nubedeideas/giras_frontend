<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useNotifications,
  CHANNEL_LABELS,
  notifStatusLabel,
  notifStatusColors,
  type NotificationListItem,
  type NotificationRecipient,
} from '@/composables/useNotifications'
import { formatInZone, browserZone } from '@/utils/datetime'
import { isPlanLimitError } from '@/utils/notificationErrors'
import AddContactsToNotificationModal from '@/components/modals/AddContactsToNotificationModal.vue'
import EditRecipientModal from '@/components/modals/EditRecipientModal.vue'
import EditNotificationModal from '@/components/modals/EditNotificationModal.vue'
import RecipientStatusChip from '@/components/activities/RecipientStatusChip.vue'
import RemindUnconfirmedButton from '@/components/activities/RemindUnconfirmedButton.vue'
import {
  canRemindUnconfirmed,
  isActivityPast,
  sortRecipientsForConfirmation,
} from '@/utils/confirmations'

const props = defineProps<{
  notification: NotificationListItem
  activityUuid: string
  /** `scheduled_at` de la actividad: si ya pasó, el backend no admite recordatorios. */
  activityScheduledAt?: string | null
}>()
const emit = defineEmits<{ refresh: [] }>()

const { t } = useI18n()
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
const recipientsError = ref('')
const editingRecipient = ref<NotificationRecipient | null>(null)

const sortedRecipients = computed(() =>
  sortRecipientsForConfirmation(recipients.value, props.notification.confirmable)
)

watch(expanded, async (val) => {
  if (val && recipients.value.length === 0) {
    await loadRecipients()
  }
})

async function loadRecipients() {
  loadingRecipients.value = true
  recipientsError.value = ''
  try {
    recipients.value = await api.listContacts(props.notification.uuid)
  } catch (e) {
    recipients.value = []
    recipientsError.value = e instanceof Error ? e.message : 'Error al cargar contactos'
  } finally {
    loadingRecipients.value = false
  }
}

function formatDateTime(iso: string | null | undefined, zone?: string): string {
  return formatInZone(iso, zone || browserZone())
}

const RECIPIENT_DOT_CLASS: Record<string, string> = {
  pending: 'bg-ink-4',
  sent: 'bg-brand-blue',
  delivered: 'bg-wa-green',
  read: 'bg-acid-muted',
  confirmed: 'bg-acid',
  failed: 'bg-red-400',
  bounced: 'bg-red-400',
}

// Las acciones y colores siguen a la prop: tras un `refresh` el padre pasa un objeto nuevo
// con la misma key y el componente se reutiliza.
const n = computed(() => props.notification)
const colors = computed(() => notifStatusColors(props.notification.status))

const showConfirmBadge = computed(
  () => props.notification.confirmable && props.notification.status === 'sent'
)
const canRemind = computed(() =>
  canRemindUnconfirmed(props.notification, isActivityPast(props.activityScheduledAt))
)

let reloadTimer: ReturnType<typeof setTimeout> | null = null
function onReminderQueued() {
  if (reloadTimer) clearTimeout(reloadTimer)
  // El envío va en una task de Celery: se recargan los destinatarios cuando ya ha salido.
  reloadTimer = setTimeout(() => {
    reloadTimer = null
    loadRecipients()
    emit('refresh')
  }, 5000)
}
onBeforeUnmount(() => {
  if (reloadTimer) clearTimeout(reloadTimer)
})

async function send() {
  actionLoading.value = true
  actionError.value = ''
  try {
    await api.sendNotification(n.value.uuid)
    emit('refresh')
  } catch (e) {
    actionError.value = isPlanLimitError(e)
      ? t('notif.planLimitReached')
      : e instanceof Error
        ? e.message
        : 'Error al enviar'
  } finally {
    actionLoading.value = false
  }
}

async function cancel() {
  actionLoading.value = true
  actionError.value = ''
  try {
    await api.cancelNotification(n.value.uuid)
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
    await api.deleteNotification(n.value.uuid)
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

const canSend = computed(() => ['draft', 'scheduled', 'failed'].includes(n.value.status))
const canCancel = computed(() => ['draft', 'scheduled'].includes(n.value.status))
const canDelete = computed(() => !['sending', 'sent'].includes(n.value.status))
const canAddContacts = computed(() => ['draft', 'scheduled'].includes(n.value.status))
const canEdit = computed(() => ['draft', 'scheduled', 'failed'].includes(n.value.status))
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
        <p class="text-[12px] font-medium text-ink truncate">
          {{ notification.title }}
        </p>
        <p class="text-[10px] text-ink-4">
          <span v-if="notification.scheduled_for">{{ formatDateTime(notification.scheduled_for, notification.send_timezone) }}</span>
          <span v-else>Sin programar</span>
          <span v-if="notification.recipient_count"> · {{ notification.recipient_count }} contacto{{ notification.recipient_count !== 1 ? 's' : '' }}</span>
        </p>
      </div>

      <!-- Confirmaciones -->
      <span
        v-if="showConfirmBadge"
        class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
        :class="
          notification.confirmed_count >= notification.recipient_count && notification.recipient_count > 0
            ? 'bg-acid-dim text-acid'
            : 'bg-glass-2 text-ink-2'
        "
      >
        {{
          t('confirmations.badge', {
            confirmed: notification.confirmed_count,
            total: notification.recipient_count,
          })
        }}
      </span>

      <!-- Status pill -->
      <span
        class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
        :style="{ background: colors.bg, color: colors.text }"
      >
        {{ notifStatusLabel(notification.status) }}
      </span>

      <!-- Chevron -->
      <svg
        class="flex-shrink-0 text-ink-4 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <!-- Expanded content -->
    <div
      v-if="expanded"
      class="border-t border-line"
    >
      <!-- Recipients list -->
      <div class="px-3 pt-2.5 pb-2">
        <p class="text-[9px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-1.5">
          Contactos
        </p>

        <div
          v-if="loadingRecipients"
          class="flex items-center justify-center py-2"
        >
          <svg
            class="animate-spin text-ink-4"
            width="12"
            height="12"
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
          v-else-if="recipientsError"
          class="text-[11px] text-red-400 py-1"
        >
          {{ recipientsError }}
        </p>

        <p
          v-else-if="recipients.length === 0"
          class="text-[11px] text-ink-4 italic py-1"
        >
          Sin contactos asignados
        </p>

        <div
          v-else
          class="space-y-0.5 max-h-36 overflow-y-auto"
        >
          <button
            v-for="(r, i) in sortedRecipients"
            :key="r.contact_uuid || r.email || r.phone || i"
            class="w-full flex items-center gap-2 py-1.5 px-1.5 rounded-lg border-none bg-transparent text-left cursor-pointer hover:bg-glass transition-colors group"
            @click="editingRecipient = r"
          >
            <!-- Status dot -->
            <span
              class="w-1.5 h-1.5 rounded-full flex-shrink-0"
              :class="RECIPIENT_DOT_CLASS[r.status] ?? 'bg-ink-4'"
            />
            <!-- Name + contact -->
            <div class="flex-1 min-w-0">
              <p class="text-[11px] text-ink truncate">
                {{ r.contact_name || r.recipient_display || '—' }}
              </p>
              <p class="text-[10px] text-ink-4 truncate">
                {{ r.contact_email || r.contact_phone || r.email || r.phone || '' }}
              </p>
            </div>
            <!-- Status label + edit hint -->
            <RecipientStatusChip
              :recipient="r"
              :confirmable="notification.confirmable"
              class="group-hover:hidden"
            />
            <svg
              class="hidden group-hover:block flex-shrink-0 text-ink-3"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="px-3 pb-3 space-y-2">
        <p
          v-if="actionError"
          class="text-[11px] text-red-400"
        >
          {{ actionError }}
        </p>

        <div class="flex flex-wrap gap-1.5">
          <!-- Edit -->
          <button
            v-if="canEdit"
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
            @click="showEdit = true"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar
          </button>

          <!-- Add contacts -->
          <button
            v-if="canAddContacts"
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
            @click="showAddContacts = true"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
                cx="9"
                cy="7"
                r="4"
              /><line
                x1="23"
                y1="11"
                x2="17"
                y2="11"
              /><line
                x1="20"
                y1="8"
                x2="20"
                y2="14"
              />
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
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line
                x1="22"
                y1="2"
                x2="11"
                y2="13"
              /><polygon points="22 2 15 22 11 13 2 9 22 2" />
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
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              Eliminar
            </button>
            <div
              v-else
              class="flex gap-1"
            >
              <button
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border-none"
                style="background: rgba(239,68,68,0.15); color: #f87171"
                :class="actionLoading ? 'opacity-50' : ''"
                @click="doDelete"
              >
                {{ actionLoading ? '…' : 'Confirmar' }}
              </button>
              <button
                class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
                @click="showDeleteConfirm = false"
              >
                Cancelar
              </button>
            </div>
          </template>
        </div>

        <!-- Recordar a los que no han confirmado -->
        <RemindUnconfirmedButton
          v-if="canRemind"
          :notification-uuid="notification.uuid"
          @queued="onReminderQueued"
        />

        <!-- Sent summary -->
        <p
          v-if="notification.status === 'sent'"
          class="text-[11px] text-ink-3"
        >
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
