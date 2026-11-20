import { apiClient } from '@/utils/apiClient'
import { toArray } from '@/utils/pagination'
import type { Paginated } from '@/types'
import type { Activity } from './useActivities'
import { formatInZoneShort, browserZone } from '@/utils/datetime'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push'
export type NotificationStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface NotificationRecipient {
  contact_uuid: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  email: string | null
  phone: string | null
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped'
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  error_message: string | null
  attempts: number
  external_id: string
  recipient_display: string | null
  created_at: string
}

export interface Notification {
  uuid: string
  title: string
  message: string
  notification_type: string
  channel: NotificationChannel
  priority: NotificationPriority
  status: NotificationStatus
  tour: string | null
  tour_name: string | null
  event: string | null
  activity: string | null
  template: { uuid: string; name: string; slug: string; twilio_template_sid?: string } | null
  sender: string | null
  sender_name: string | null
  scheduled_for: string | null
  send_timezone: string
  sent_at: string | null
  metadata: Record<string, unknown> | null
  recipients: NotificationRecipient[]
  recipient_count: number
  sent_count: number
  failed_count: number
  created_at: string
  updated_at: string
}

export interface NotificationListItem {
  uuid: string
  title: string
  notification_type: string
  channel: NotificationChannel
  priority: NotificationPriority
  status: NotificationStatus
  sender_name: string | null
  recipient_count: number
  scheduled_for: string | null
  send_timezone: string
  sent_at: string | null
  created_at: string
}

export interface CreateNotificationPayload {
  title: string
  message?: string
  notification_type?: string
  channel: NotificationChannel
  priority?: NotificationPriority
  activity?: string
  tour?: string
  scheduled_for?: string
  metadata?: Record<string, unknown>
  recipient_contacts?: string[]
  template?: string  // NotificationTemplate UUID
}

export interface SchedulePayload {
  reminder_minutes?: number
  scheduled_for?: string
  send_timezone?: string
}

export interface UpdateNotificationPayload {
  title?: string
  message?: string
  priority?: NotificationPriority
  scheduled_for?: string | null
  send_timezone?: string
  template?: string | null
}

export interface ContactListItem {
  uuid: string
  full_name: string
  first_name: string
  last_name: string
  company_name: string
  primary_email: string
  primary_phone: string
  role: { uuid: string; name: string; color: string } | null
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  push: 'Push',
}

export const CHANNEL_ICONS: Record<NotificationChannel, string> = {
  email: '✉',
  sms: '📱',
  whatsapp: '💬',
  push: '🔔',
}

export const NOTIF_STATUS_LABELS: Record<NotificationStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  sent: 'Enviada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
}

export const NOTIF_STATUS_COLORS: Record<NotificationStatus, { bg: string; text: string }> = {
  draft: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
  scheduled: { bg: 'rgba(26,143,255,0.12)', text: '#1a8fff' },
  sending: { bg: 'rgba(168,216,0,0.12)', text: '#a8d800' },
  sent: { bg: 'rgba(31,173,90,0.15)', text: '#34d399' },
  failed: { bg: 'rgba(239,68,68,0.12)', text: '#f87171' },
  cancelled: { bg: 'rgba(100,116,139,0.10)', text: '#64748b' },
}

// Populated by the backend in `metadata.auto_cancelled_reason` when a reminder is
// cancelled automatically (e.g. the linked Activity was rescheduled into the past)
// instead of by a user action — lets the UI explain why, not just that it happened.
export const AUTO_CANCEL_REASON_LABELS: Record<string, string> = {
  activity_rescheduled_past:
    'Cancelada automáticamente: el evento se reprogramó y este recordatorio quedó en el pasado.',
  activity_deleted: 'Cancelada automáticamente: la actividad se eliminó.',
  tour_deleted: 'Cancelada automáticamente: la gira se eliminó.',
  no_recipients: 'Cancelada automáticamente: no había ningún destinatario.',
}

// ─── WhatsApp variable resolver ───────────────────────────────────────────────

/**
 * Resolves twilio_variables mapping from ActivityType metadata_schema against an Activity.
 *
 * Variable path formats:
 *   field:<field_name>        → activity[field_name]
 *   field:scheduled_at_local  → activity.local_start_time (formatted)
 *   metadata:<key>            → activity.metadata[key]
 *   literal:<text>            → text verbatim
 *
 * Returns resolved variables dict: { "1": "value1", "2": "value2" }
 */
export function resolveWhatsAppVariables(
  activity: Activity,
  twilioVariables: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {}

  for (const [key, path] of Object.entries(twilioVariables)) {
    const [type, ...rest] = path.split(':')
    const arg = rest.join(':')

    if (type === 'field') {
      if (arg === 'scheduled_at_local') {
        resolved[key] = activity.local_start_time
          ? formatLocalDateTime(activity.local_start_time, activity.timezone)
          : formatUtcDateTime(activity.scheduled_at)
      } else {
        const val = (activity as unknown as Record<string, unknown>)[arg]
        resolved[key] = val != null ? String(val) : ''
      }
    } else if (type === 'metadata') {
      const val = activity.metadata?.[arg]
      resolved[key] = val != null ? String(val) : ''
    } else if (type === 'literal') {
      resolved[key] = arg
    } else {
      resolved[key] = ''
    }
  }

  return resolved
}

function formatLocalDateTime(iso: string, zone?: string): string {
  return formatInZoneShort(iso, zone || browserZone())
}

function formatUtcDateTime(iso: string): string {
  return formatInZoneShort(iso, 'UTC')
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useNotifications() {
  async function listForActivity(activityUuid: string): Promise<NotificationListItem[]> {
    const data = await apiClient.get<Paginated<NotificationListItem> | NotificationListItem[]>(
      `/notifications/?activity=${activityUuid}&page_size=50`,
      { fallback: 'Error al cargar notificaciones' }
    )
    return toArray(data)
  }

  function getNotification(uuid: string): Promise<Notification> {
    return apiClient.get<Notification>(`/notifications/${uuid}/`, {
      fallback: 'Error al cargar notificación',
    })
  }

  function createNotification(payload: CreateNotificationPayload): Promise<Notification> {
    return apiClient.post<Notification>('/notifications/', payload, {
      fallback: 'Error al crear notificación',
      allFieldErrors: true,
    })
  }

  function scheduleNotification(
    uuid: string,
    payload: SchedulePayload
  ): Promise<{ notification: Notification; available_reminder_minutes?: number[] }> {
    return apiClient.post(`/notifications/${uuid}/schedule/`, payload, {
      fallback: 'Error al programar notificación',
    })
  }

  function sendNotification(
    uuid: string
  ): Promise<{ notification: Notification; result: unknown }> {
    return apiClient.post(
      `/notifications/${uuid}/send/`,
      {},
      { fallback: 'Error al enviar notificación' }
    )
  }

  function updateNotification(
    uuid: string,
    payload: UpdateNotificationPayload
  ): Promise<Notification> {
    return apiClient.patch<Notification>(`/notifications/${uuid}/`, payload, {
      fallback: 'Error al actualizar notificación',
      allFieldErrors: true,
    })
  }

  function cancelNotification(uuid: string): Promise<Notification> {
    return apiClient.post<Notification>(
      `/notifications/${uuid}/cancel/`,
      {},
      { fallback: 'Error al cancelar notificación' }
    )
  }

  function deleteNotification(uuid: string): Promise<void> {
    return apiClient.delete(`/notifications/${uuid}/`, {
      fallback: 'Error al eliminar notificación',
    })
  }

  function addContacts(uuid: string, contactUuids: string[]): Promise<unknown> {
    return apiClient.post(
      `/notifications/${uuid}/contacts/add/`,
      { contact_uuids: contactUuids },
      { fallback: 'Error al añadir contactos' }
    )
  }

  function removeContacts(uuid: string, contactUuids: string[]): Promise<unknown> {
    return apiClient.post(
      `/notifications/${uuid}/contacts/remove/`,
      { contact_uuids: contactUuids },
      { fallback: 'Error al eliminar contactos' }
    )
  }

  async function listContacts(uuid: string): Promise<NotificationRecipient[]> {
    const data = await apiClient.get<Paginated<NotificationRecipient> | NotificationRecipient[]>(
      `/notifications/${uuid}/contacts/`,
      { fallback: 'Error al cargar contactos' }
    )
    return toArray(data)
  }

  function sendWhatsAppBulk(
    uuid: string,
    templateSid: string,
    variables: Record<string, string>
  ): Promise<unknown> {
    return apiClient.post(
      `/notifications/${uuid}/send-whatsapp-bulk/`,
      { template_sid: templateSid, variables },
      { fallback: 'Error al enviar WhatsApp' }
    )
  }

  async function listGlobalContacts(search = ''): Promise<ContactListItem[]> {
    const qs = new URLSearchParams({ page_size: '100' })
    if (search) qs.set('search', search)
    const data = await apiClient.get<Paginated<ContactListItem> | ContactListItem[]>(
      `/contacts/?${qs}`,
      { fallback: 'Error al cargar contactos' }
    )
    return toArray(data)
  }

  return {
    listForActivity,
    getNotification,
    createNotification,
    updateNotification,
    scheduleNotification,
    sendNotification,
    cancelNotification,
    deleteNotification,
    addContacts,
    removeContacts,
    listContacts,
    sendWhatsAppBulk,
    listGlobalContacts,
  }
}
