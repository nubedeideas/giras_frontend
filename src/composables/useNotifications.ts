import { apiClient } from '@/utils/apiClient'
import { toArray } from '@/utils/pagination'
import type { Paginated } from '@/types'
import type { Activity } from './useActivities'
import { formatInZoneShort, browserZone } from '@/utils/datetime'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app'
// `pending` es un valor heredado que existe en datos reales aunque no esté en STATUS_CHOICES.
export type NotificationStatus =
  | 'draft'
  | 'pending'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type RecipientStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'confirmed'
  | 'failed'
  | 'bounced'

// GET /api/notifications/{uuid}/contacts/ y `recipients` del detalle (NotificationRecipientSerializer)
export interface NotificationRecipient {
  contact_uuid: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  email: string | null
  phone: string | null
  status: RecipientStatus
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  confirmed_at: string | null
  error_message: string | null
  attempts: number
  external_id: string
  recipient_display: string | null
  /** Recordatorios de confirmación reenviados (remind-unconfirmed). */
  reminder_count: number
  last_reminded_at: string | null
  /** `''` si no hay. */
  last_reminder_error: string
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
  confirmed_count: number
  /** WhatsApp con template aprobada (con SID) que lleva botón "Confirmar". */
  confirmable: boolean
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
  confirmed_count: number
  /** WhatsApp con template aprobada (con SID) que lleva botón "Confirmar". */
  confirmable: boolean
  scheduled_for: string | null
  send_timezone: string
  sent_at: string | null
  created_at: string
}

// POST /api/notifications/{uuid}/remind-unconfirmed/
export interface RemindUnconfirmedExcluded {
  confirmed: number
  /** pending, failed o bounced */
  not_delivered: number
  no_phone: number
  /** Ya tienen el máximo de recordatorios. */
  max_reminders: number
  /** Último envío hace menos de `min_interval_minutes`. */
  too_soon: number
}

export interface RemindUnconfirmedResult {
  dry_run: boolean
  /** A quién se reenviaría (o se ha encolado). */
  eligible: number
  /** 0 si `dry_run` o si no había elegibles. */
  queued: number
  excluded: RemindUnconfirmedExcluded
  max_reminders_per_recipient: number
  min_interval_minutes: number
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
  in_app: 'En la app',
}

export const CHANNEL_ICONS: Record<NotificationChannel, string> = {
  email: '✉',
  sms: '📱',
  whatsapp: '💬',
  push: '🔔',
  in_app: '📥',
}

export const NOTIF_STATUS_LABELS: Record<NotificationStatus, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  scheduled: 'Programada',
  sending: 'Enviando',
  sent: 'Enviada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
}

/** Etiqueta de estado con fallback al valor crudo (el backend puede traer estados heredados). */
export function notifStatusLabel(status: string): string {
  return NOTIF_STATUS_LABELS[status as NotificationStatus] ?? status
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
  event_deleted: 'Cancelada automáticamente: el evento se eliminó.',
  subscription_cancelled: 'Cancelada automáticamente: la suscripción de la gira se canceló.',
  show_day_alert_disabled:
    'Cancelada automáticamente: la alerta del día de show se desactivó para esta gira.',
  show_changed: 'Cancelada automáticamente: el show cambió de día o se canceló.',
  template_not_approved:
    'Cancelada automáticamente: la plantilla de WhatsApp aún no está aprobada.',
  show_passed: 'Cancelada automáticamente: el día del show ya había pasado.',
  // Bloque 3.6 (reglas de notificación)
  rule_disabled: 'Cancelada automáticamente: la regla que la generó se desactivó o se eliminó.',
  rule_changed: 'Cancelada automáticamente: la regla que la generó cambió y se volvió a programar.',
  rule_rescheduled:
    'Cancelada automáticamente: la actividad cambió de hora y el aviso se volvió a programar.',
  replaced_by_rule: 'Cancelada automáticamente: una regla de la gira sustituye a este recordatorio.',
  activity_unavailable:
    'Cancelada automáticamente: la actividad se canceló, se completó o volvió a borrador.',
  activity_type_changed:
    'Cancelada automáticamente: la actividad cambió de tipo y sus recordatorios se regeneraron.',
  activity_type_mismatch:
    'Cancelada automáticamente: la actividad ya no es del tipo que cubre la regla.',
  template_unavailable:
    'Cancelada automáticamente: la plantilla de la regla ya no está disponible para la gira.',
  // Recordatorios por tipo (spec 2026-11-21, C1.8)
  reminder_config_changed:
    'Cancelada automáticamente: cambió la configuración de recordatorios de este tipo.',
  plan_limit_degraded:
    'Cancelada automáticamente: se acabó el cupo de WhatsApp del plan y se envió por email o en la app.',
  plan_limit_reached: 'Cancelada automáticamente: se acabó el cupo de WhatsApp del plan.',
  flight_cancelled: 'Cancelada automáticamente: la aerolínea canceló el vuelo.',
  // Recordatorio que habría salido después del inicio (fix de gnotif, 2026-11-22)
  activity_already_started: 'Cancelada automáticamente: la actividad ya había empezado.',
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

  /**
   * Reenvía la misma template a los destinatarios que no han confirmado.
   * Con `dryRun` solo devuelve los recuentos: sin envío, sin cupo y sin gastar el throttle de
   * recordatorios (que solo cuenta el envío real).
   */
  function remindUnconfirmed(uuid: string, dryRun = false): Promise<RemindUnconfirmedResult> {
    return apiClient.post<RemindUnconfirmedResult>(
      `/notifications/${uuid}/remind-unconfirmed/`,
      { dry_run: dryRun },
      { fallback: 'No se ha podido enviar el recordatorio' }
    )
  }

  /**
   * GET /api/contacts/ (una página). Con `tourUuid`, `?tour=` devuelve también los contactos
   * asignables de la gira (los del owner y del resto de admins), no solo los propios.
   */
  async function listGlobalContacts(search = '', tourUuid?: string): Promise<ContactListItem[]> {
    const qs = new URLSearchParams({ page_size: '100' })
    if (search) qs.set('search', search)
    if (tourUuid) qs.set('tour', tourUuid)
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
    remindUnconfirmed,
    listGlobalContacts,
  }
}
