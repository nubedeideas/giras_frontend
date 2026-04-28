import { useAuthStore } from '@/stores/auth'
import type { Activity } from './useActivities'
import { formatInZoneShort, browserZone } from '@/utils/datetime'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function listForActivity(activityUuid: string): Promise<NotificationListItem[]> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/?activity=${activityUuid}&page_size=50`,
    )
    if (!res.ok) throw new Error('Error al cargar notificaciones')
    const data = await res.json()
    return data.results ?? data
  }

  async function getNotification(uuid: string): Promise<Notification> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/${uuid}/`)
    if (!res.ok) throw new Error('Error al cargar notificación')
    return res.json()
  }

  async function createNotification(payload: CreateNotificationPayload): Promise<Notification> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const lines: string[] = []
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        if (Array.isArray(val)) {
          val.forEach((v) => {
            if (typeof v === 'string')
              lines.push(key === 'non_field_errors' ? v : `${key}: ${v}`)
          })
        } else if (typeof val === 'string') {
          lines.push(key === 'detail' ? val : `${key}: ${val}`)
        }
      }
      throw new Error(lines.join('\n') || 'Error al crear notificación')
    }
    return data
  }

  async function scheduleNotification(
    uuid: string,
    payload: SchedulePayload,
  ): Promise<{ notification: Notification; available_reminder_minutes?: number[] }> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/${uuid}/schedule/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? data.detail ?? 'Error al programar notificación')
    return data
  }

  async function sendNotification(uuid: string): Promise<{ notification: Notification; result: unknown }> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/${uuid}/send/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({}) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? data.detail ?? 'Error al enviar notificación')
    return data
  }

  async function updateNotification(
    uuid: string,
    payload: UpdateNotificationPayload,
  ): Promise<Notification> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const lines: string[] = []
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        if (Array.isArray(val)) {
          val.forEach((v) => {
            if (typeof v === 'string')
              lines.push(key === 'non_field_errors' ? v : `${key}: ${v}`)
          })
        } else if (typeof val === 'string') {
          lines.push(key === 'detail' ? val : `${key}: ${val}`)
        }
      }
      throw new Error(lines.join('\n') || 'Error al actualizar notificación')
    }
    return data
  }

  async function cancelNotification(uuid: string): Promise<Notification> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/${uuid}/cancel/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({}) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? data.detail ?? 'Error al cancelar notificación')
    return data
  }

  async function deleteNotification(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/${uuid}/`,
      { method: 'DELETE' },
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar notificación')
    }
  }

  async function addContacts(uuid: string, contactUuids: string[]): Promise<unknown> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/${uuid}/contacts/add/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ contact_uuids: contactUuids }) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al agregar contactos')
    return data
  }

  async function removeContacts(uuid: string, contactUuids: string[]): Promise<unknown> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/${uuid}/contacts/remove/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ contact_uuids: contactUuids }) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al eliminar contactos')
    return data
  }

  async function listContacts(uuid: string): Promise<NotificationRecipient[]> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/${uuid}/contacts/`,
    )
    if (!res.ok) throw new Error('Error al cargar contactos')
    const data = await res.json()
    return data.results ?? data
  }

  async function sendWhatsAppBulk(
    uuid: string,
    templateSid: string,
    variables: Record<string, string>,
  ): Promise<unknown> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/${uuid}/send-whatsapp-bulk/`,
      {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ template_sid: templateSid, variables }),
      },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? data.detail ?? 'Error al enviar WhatsApp')
    return data
  }

  async function listGlobalContacts(search = ''): Promise<ContactListItem[]> {
    const qs = new URLSearchParams({ page_size: '100' })
    if (search) qs.set('search', search)
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/?${qs}`)
    if (!res.ok) throw new Error('Error al cargar contactos')
    const data = await res.json()
    return data.results ?? data
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
