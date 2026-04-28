import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateChannel = 'email' | 'sms' | 'whatsapp' | 'telegram' | 'push' | 'in_app'
export type TemplateType =
  | 'event_reminder'
  | 'event_cancelled'
  | 'event_updated'
  | 'flight_reminder'
  | 'tour_update'
  | 'task_assigned'
  | 'announcement'
  | 'alert'
  | 'night_off_report'
  | 'custom'

export interface NotificationTemplate {
  uuid: string
  name: string
  slug: string
  notification_type: TemplateType
  channel: TemplateChannel
  is_active: boolean
  is_default: boolean
  twilio_template_sid?: string
  subject?: string
  body?: string
  variables: Record<string, string> | string[]
  created_at: string
  updated_at: string
}

export interface NotificationTemplateListItem {
  uuid: string
  name: string
  slug: string
  notification_type: TemplateType
  channel: TemplateChannel
  is_active: boolean
  is_default: boolean
  twilio_template_sid?: string
}

export interface TemplatePayload {
  name: string
  notification_type: TemplateType
  channel: TemplateChannel
  is_active?: boolean
  subject?: string
  body?: string
  twilio_template_sid?: string
  variables?: Record<string, string> | string[]
}

export interface BackendErrors {
  [key: string]: unknown
  non_field_errors?: string[]
}

export class TemplateApiError extends Error {
  constructor(public readonly fieldErrors: BackendErrors) {
    // Only pick string values — ignore booleans, nulls, etc.
    const firstString = Object.values(fieldErrors)
      .flat()
      .find((v): v is string => typeof v === 'string')
    const msg = fieldErrors.non_field_errors?.[0] ?? firstString ?? 'Error de validación'
    super(msg)
  }
}

/** Extract a human-readable message from any non-ok API response. */
export function extractApiError(data: Record<string, unknown>): string {
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message
  if (typeof data.error === 'string') return data.error
  const firstString = Object.values(data)
    .flat()
    .find((v): v is string => typeof v === 'string')
  return firstString ?? 'Error del servidor'
}

// ─── Display constants ────────────────────────────────────────────────────────

export const TEMPLATE_TYPES: TemplateType[] = [
  'event_reminder',
  'event_cancelled',
  'event_updated',
  'flight_reminder',
  'tour_update',
  'task_assigned',
  'announcement',
  'alert',
  'night_off_report',
  'custom',
]

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  event_reminder: 'Recordatorio de Evento',
  event_cancelled: 'Evento Cancelado',
  event_updated: 'Evento Actualizado',
  flight_reminder: 'Recordatorio de Vuelo',
  tour_update: 'Actualización de Tour',
  task_assigned: 'Tarea Asignada',
  announcement: 'Anuncio',
  alert: 'Alerta',
  night_off_report: 'Reporte Nocturno',
  custom: 'Personalizado',
}

export const TEMPLATE_CHANNELS: TemplateChannel[] = [
  'email',
  'sms',
  'whatsapp',
  'telegram',
  'push',
  'in_app',
]

export const TEMPLATE_CHANNEL_LABELS: Record<TemplateChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  push: 'Push',
  in_app: 'In-App',
}

export const TEMPLATE_CHANNEL_COLORS: Record<TemplateChannel, { bg: string; text: string }> = {
  email: { bg: 'rgba(26,143,255,0.12)', text: '#1a8fff' },
  sms: { bg: 'rgba(232,93,0,0.12)', text: '#e85d00' },
  whatsapp: { bg: 'rgba(31,173,90,0.12)', text: '#1fad5a' },
  telegram: { bg: 'rgba(41,182,246,0.12)', text: '#29b6f6' },
  push: { bg: 'rgba(149,117,205,0.12)', text: '#9575cd' },
  in_app: { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
}

// ─── Canonical variable groups ────────────────────────────────────────────────

export interface CanonicalVar {
  key: string
  label: string
}

export interface CanonicalVarGroup {
  label: string
  vars: CanonicalVar[]
}

export const CANONICAL_VAR_GROUPS: CanonicalVarGroup[] = [
  {
    label: 'Destinatario',
    vars: [{ key: 'recipient_name', label: 'Nombre del destinatario' }],
  },
  {
    label: 'Tour',
    vars: [
      { key: 'tour_name', label: 'Nombre del tour' },
      { key: 'tour_uuid', label: 'UUID del tour' },
      { key: 'artist_name', label: 'Nombre del artista' },
    ],
  },
  {
    label: 'Evento',
    vars: [
      { key: 'event_title', label: 'Título del evento' },
      { key: 'event_date', label: 'Fecha del evento' },
      { key: 'event_city', label: 'Ciudad del evento' },
      { key: 'venue_name', label: 'Nombre del venue' },
    ],
  },
  {
    label: 'Actividad',
    vars: [
      { key: 'activity_title', label: 'Título de la actividad' },
      { key: 'activity_date', label: 'Fecha (dd/mm/yyyy)' },
      { key: 'activity_time', label: 'Hora local (hh:mm)' },
      { key: 'activity_location', label: 'Lugar' },
      { key: 'activity_type', label: 'Tipo de actividad' },
      { key: 'activity_flight_number', label: 'Número de vuelo' },
      { key: 'activity_airline', label: 'Aerolínea' },
      { key: 'activity_confirmation', label: 'Número de confirmación' },
      { key: 'activity_hotel_name', label: 'Nombre del hotel' },
    ],
  },
  {
    label: 'Notificación',
    vars: [
      { key: 'notification_title', label: 'Título de la notificación' },
      { key: 'notification_message', label: 'Mensaje de la notificación' },
      { key: 'notification_url', label: 'URL de la actividad' },
    ],
  },
]

export const ALL_CANONICAL_VARS: CanonicalVar[] = CANONICAL_VAR_GROUPS.flatMap((g) => g.vars)

// ─── Composable ───────────────────────────────────────────────────────────────

export function useNotificationTemplates() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function listTemplates(): Promise<NotificationTemplateListItem[]> {
    const all: NotificationTemplateListItem[] = []
    let url: string | null = `${API_BASE}/notifications/templates/?page_size=100`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar templates')
      const data = await res.json()
      all.push(...(data.results ?? data))
      url = data.next ?? null
    }
    return all
  }

  async function getTemplate(uuid: string): Promise<NotificationTemplate> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/templates/${uuid}/`)
    if (!res.ok) throw new Error('Error al cargar template')
    return res.json()
  }

  async function createTemplate(payload: TemplatePayload): Promise<NotificationTemplate> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/templates/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      // If it's a plain detail/message error (auth, permission, etc.), throw as simple Error
      if (typeof data.detail === 'string' || typeof data.message === 'string') {
        throw new Error(extractApiError(data as Record<string, unknown>))
      }
      throw new TemplateApiError(data as BackendErrors)
    }
    return data
  }

  async function updateTemplate(
    uuid: string,
    payload: TemplatePayload,
  ): Promise<NotificationTemplate> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/templates/${uuid}/`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      if (typeof data.detail === 'string' || typeof data.message === 'string') {
        throw new Error(extractApiError(data as Record<string, unknown>))
      }
      throw new TemplateApiError(data as BackendErrors)
    }
    return data
  }

  async function deleteTemplate(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/templates/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar template')
    }
  }

  async function setAsDefault(uuid: string): Promise<{
    success: boolean
    message: string
    template: Pick<NotificationTemplate, 'uuid' | 'name' | 'notification_type' | 'channel' | 'is_default'>
  }> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/templates/${uuid}/set_as_default/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({}) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? data.message ?? 'Error al establecer predeterminado')
    return data
  }

  async function previewTemplate(
    uuid: string,
    context: Record<string, string>,
  ): Promise<{ template: { uuid: string; name: string }; preview: { subject?: string; body: string } }> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/templates/${uuid}/preview/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ context }) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al generar preview')
    return data
  }

  return {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
    previewTemplate,
  }
}
