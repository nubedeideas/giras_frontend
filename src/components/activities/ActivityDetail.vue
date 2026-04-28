<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useActivitiesStore } from '@/stores/activities'
import { useActivities } from '@/composables/useActivities'
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  type ActivityStatus,
} from '@/composables/useActivities'
import { useNotifications, type NotificationListItem, type NotificationChannel } from '@/composables/useNotifications'
import GlassBlock from '@/components/ui/GlassBlock.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import EditActivityModal from '@/components/modals/EditActivityModal.vue'
import CreateNotificationModal from '@/components/modals/CreateNotificationModal.vue'
import AddContactsToNotificationModal from '@/components/modals/AddContactsToNotificationModal.vue'
import NotificationCard from '@/components/activities/NotificationCard.vue'

const store = useActivitiesStore()
const api = useActivities()
const notifApi = useNotifications()

const emit = defineEmits<{ close: [] }>()

const activity = computed(() => store.selectedDetail)

const actionLoading = ref(false)
const actionError = ref('')
const showStatusMenu = ref(false)
const showDeleteConfirm = ref(false)
const showEdit = ref(false)
const showCreateNotif = ref(false)
const showAddContactsForNew = ref(false)
const newNotifUuid = ref('')
const newNotifChannel = ref<NotificationChannel>('whatsapp')

// ─── Notifications ────────────────────────────────────────────────────────────

const notifications = ref<NotificationListItem[]>([])
const loadingNotifs = ref(false)

async function loadNotifications() {
  if (!activity.value) return
  loadingNotifs.value = true
  try {
    notifications.value = await notifApi.listForActivity(activity.value.uuid)
  } catch {
    notifications.value = []
  } finally {
    loadingNotifs.value = false
  }
}

watch(
  () => activity.value?.uuid,
  (uuid) => {
    if (uuid) loadNotifications()
    else notifications.value = []
  },
  { immediate: true },
)

const STATUSES: ActivityStatus[] = [
  'draft', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'delayed',
]

const CATEGORY_LABELS: Record<string, string> = {
  logistics: 'Logística', production: 'Producción', media: 'Medios',
  meetings: 'Reuniones', fan: 'Fan', personal: 'Personal', other: 'Otro',
}

function formatDateTime(iso: string | null | undefined, allDay = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const date = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  if (allDay) return date
  const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} · ${time}`
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}`.trim() : `${m}min`
}

async function changeStatus(status: ActivityStatus) {
  if (!activity.value) return
  showStatusMenu.value = false
  actionLoading.value = true
  actionError.value = ''
  try {
    const updated = await api.updateStatus(activity.value.uuid, status)
    store.replaceActivity({
      uuid: updated.uuid,
      title: updated.title,
      scheduled_at: updated.scheduled_at,
      end_at: updated.end_at,
      timezone: updated.timezone,
      local_start_time: null,
      status: updated.status,
      priority: updated.priority,
      all_day: updated.all_day,
      location_name: updated.location_name,
      destination_name: updated.destination_name,
      activity_type_name: updated.activity_type?.name ?? '',
      activity_type_code: updated.activity_type?.code ?? '',
      activity_type_icon: updated.activity_type?.icon ?? '',
      activity_type_color: updated.activity_type?.color ?? '#64748b',
      category: updated.activity_type?.category ?? 'other',
    })
    // Refresh detail
    await store.selectActivity(updated.uuid)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Error al cambiar estado'
  } finally {
    actionLoading.value = false
  }
}

async function confirmDelete() {
  if (!activity.value) return
  actionLoading.value = true
  actionError.value = ''
  try {
    await api.deleteActivity(activity.value.uuid)
    store.removeActivity(activity.value.uuid)
    emit('close')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Error al eliminar'
    showDeleteConfirm.value = false
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="flex-1 bg-bg-3 flex flex-col overflow-hidden">

    <!-- Loading detail -->
    <div v-if="store.loadingDetail" class="flex-1 flex items-center justify-center">
      <svg class="animate-spin text-ink-4" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
      </svg>
    </div>

    <template v-else-if="activity">
      <!-- Header -->
      <div class="px-[22px] pt-[18px] pb-3.5 border-b border-line flex-shrink-0 flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-[5px]">
            <!-- Type color dot -->
            <div
              class="w-2 h-2 rounded-full flex-shrink-0"
              :style="{ background: activity.activity_type?.color ?? 'var(--ink-3)' }"
            />
            <p class="text-[9px] font-bold tracking-[1px] uppercase"
              :style="{ color: activity.activity_type?.color ?? 'var(--ink-3)' }">
              {{ activity.activity_type?.name ?? '—' }} · {{ CATEGORY_LABELS[activity.activity_type?.category ?? ''] ?? '—' }}
            </p>
          </div>
          <p class="text-lg font-bold tracking-[-0.3px] mb-1.5 text-ink">{{ activity.title }}</p>
          <div class="flex flex-wrap gap-2.5 text-[11px] text-ink-2">
            <!-- Date/time -->
            <span class="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {{ formatDateTime(activity.scheduled_at, activity.all_day) }}
            </span>
            <!-- End time -->
            <span v-if="activity.end_at && !activity.all_day" class="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {{ new Date(activity.end_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false }) }}
            </span>
            <!-- Location -->
            <span v-if="activity.location_name" class="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {{ activity.location_name }}
              <span v-if="activity.destination_name"> → {{ activity.destination_name }}</span>
            </span>
          </div>
        </div>

        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink ml-3.5 flex-shrink-0"
          @click="emit('close')"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto px-[22px] py-[18px]">

        <!-- Error -->
        <p v-if="actionError" class="text-[11px] text-red-400 mb-3">{{ actionError }}</p>

        <!-- Actions -->
        <div class="flex gap-[7px] mb-4">
          <!-- Edit -->
          <BtnSecondary @click="showEdit = true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </BtnSecondary>

          <!-- Status change -->
          <div class="relative">
            <BtnPrimary :class="actionLoading ? 'opacity-50' : ''" @click="showStatusMenu = !showStatusMenu">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              Estado
            </BtnPrimary>
            <!-- Status dropdown -->
            <div
              v-if="showStatusMenu"
              class="absolute left-0 top-full mt-1 w-40 bg-bg-4 border border-line-2 rounded-xl shadow-xl z-50 py-1 overflow-hidden"
            >
              <button
                v-for="s in STATUSES"
                :key="s"
                class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-glass-hover cursor-pointer border-none bg-transparent transition-colors"
                :class="activity.status === s ? 'text-acid' : 'text-ink-2'"
                @click="changeStatus(s)"
              >
                <span
                  class="w-[7px] h-[7px] rounded-full flex-shrink-0"
                  :style="{ background: STATUS_COLORS[s].text }"
                />
                {{ STATUS_LABELS[s] }}
              </button>
            </div>
            <!-- Backdrop -->
            <div v-if="showStatusMenu" class="fixed inset-0 z-40" @click="showStatusMenu = false" />
          </div>

          <!-- Delete -->
          <BtnSecondary v-if="!showDeleteConfirm" @click="showDeleteConfirm = true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
            Eliminar
          </BtnSecondary>
          <div v-else class="flex gap-1.5">
            <button
              class="px-3 py-[6px] rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-opacity"
              style="background: rgba(239,68,68,0.15); color: #f87171"
              :class="actionLoading ? 'opacity-50' : ''"
              @click="confirmDelete"
            >
              {{ actionLoading ? '…' : 'Confirmar' }}
            </button>
            <button
              class="px-3 py-[6px] rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
              @click="showDeleteConfirm = false"
            >
              Cancelar
            </button>
          </div>
        </div>

        <!-- Info block -->
        <GlassBlock title="Información">
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-0.5">
              <span class="text-[9px] font-semibold text-ink-3 tracking-[0.5px] uppercase">Estado</span>
              <span
                class="text-[11px] font-semibold px-1.5 py-0.5 rounded-full w-fit"
                :style="{ background: STATUS_COLORS[activity.status].bg, color: STATUS_COLORS[activity.status].text }"
              >
                {{ STATUS_LABELS[activity.status] }}
              </span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[9px] font-semibold text-ink-3 tracking-[0.5px] uppercase">Prioridad</span>
              <span class="text-[12px] text-ink font-medium" :style="{ color: PRIORITY_COLORS[activity.priority] }">
                {{ PRIORITY_LABELS[activity.priority] }}
              </span>
            </div>
            <div v-if="activity.location_name" class="flex flex-col gap-0.5">
              <span class="text-[9px] font-semibold text-ink-3 tracking-[0.5px] uppercase">Ubicación</span>
              <span class="text-[12px] text-ink">{{ activity.location_name }}</span>
            </div>
            <div v-if="activity.destination_name" class="flex flex-col gap-0.5">
              <span class="text-[9px] font-semibold text-ink-3 tracking-[0.5px] uppercase">Destino</span>
              <span class="text-[12px] text-ink">{{ activity.destination_name }}</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[9px] font-semibold text-ink-3 tracking-[0.5px] uppercase">Zona Horaria</span>
              <span class="text-[12px] text-ink">{{ activity.timezone || 'UTC' }}</span>
            </div>
            <div v-if="activity.duration" class="flex flex-col gap-0.5">
              <span class="text-[9px] font-semibold text-ink-3 tracking-[0.5px] uppercase">Duración</span>
              <span class="text-[12px] text-ink">{{ formatDuration(activity.duration) }}</span>
            </div>
            <div v-if="activity.external_source" class="flex flex-col gap-0.5 col-span-2">
              <span class="text-[9px] font-semibold text-ink-3 tracking-[0.5px] uppercase">Fuente</span>
              <span class="text-[11px] text-ink-3 flex items-center gap-1">
                <svg v-if="activity.external_source === 'google_calendar'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {{ activity.external_source === 'google_calendar' ? 'Google Calendar' : activity.external_source }}
              </span>
            </div>
          </div>
        </GlassBlock>

        <!-- Notes -->
        <GlassBlock v-if="activity.notes" title="Notas">
          <p class="text-[12px] leading-[1.7] text-ink whitespace-pre-line">{{ activity.notes }}</p>
        </GlassBlock>

        <!-- Description -->
        <GlassBlock v-if="activity.description" title="Descripción">
          <p class="text-[12px] leading-[1.7] text-ink whitespace-pre-line">{{ activity.description }}</p>
        </GlassBlock>

        <!-- Notifications -->
        <GlassBlock title="Notificaciones">
          <div class="space-y-2">
            <!-- Loading -->
            <div v-if="loadingNotifs" class="flex items-center justify-center py-3">
              <svg class="animate-spin text-ink-4" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
              </svg>
            </div>

            <!-- List -->
            <NotificationCard
              v-for="notif in notifications"
              :key="notif.uuid"
              :notification="notif"
              :activity-uuid="activity.uuid"
              @refresh="loadNotifications"
            />

            <!-- Empty state -->
            <p v-if="!loadingNotifs && notifications.length === 0" class="text-[11px] text-ink-4 text-center py-2">
              Sin notificaciones creadas
            </p>

            <!-- Create button -->
            <button
              class="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-line text-[11px] font-medium text-ink-3 hover:text-ink hover:border-line-2 cursor-pointer bg-transparent transition-colors"
              @click="showCreateNotif = true"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Crear notificación
            </button>
          </div>
        </GlassBlock>
      </div>
    </template>

    <!-- Edit modal -->
    <EditActivityModal
      :show="showEdit"
      :activity="activity"
      @close="showEdit = false"
      @saved="(act) => { showEdit = false; store.selectActivity(act.uuid) }"
    />

    <!-- Create notification modal -->
    <CreateNotificationModal
      :show="showCreateNotif"
      :activity="activity"
      @close="showCreateNotif = false"
      @created="() => loadNotifications()"
      @add-contacts="(uuid, ch) => { newNotifUuid = uuid; newNotifChannel = ch; showCreateNotif = false; showAddContactsForNew = true }"
    />

    <!-- Add contacts to freshly created notification -->
    <AddContactsToNotificationModal
      :show="showAddContactsForNew"
      :notification-uuid="newNotifUuid"
      :channel="newNotifChannel"
      @close="showAddContactsForNew = false"
      @added="() => { showAddContactsForNew = false; loadNotifications() }"
    />
  </div>
</template>
