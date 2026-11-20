import { ApiError, apiClient } from '@/utils/apiClient'

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

/** Error 400 de validación con los errores por campo ya normalizados (sin el envoltorio del backend). */
export class TemplateApiError extends ApiError {
  readonly fieldErrors: BackendErrors

  constructor(source: ApiError) {
    super(source.status, source.data, { fallback: 'Error de validación' })
    this.name = 'TemplateApiError'
    this.fieldErrors = (source.fieldErrors ?? {}) as BackendErrors
  }
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

/**
 * Errores de validación por campo → `TemplateApiError`; el resto (auth, permisos...) sigue
 * como `ApiError`.
 */
function toTemplateError(e: unknown): unknown {
  if (e instanceof ApiError && e.status === 400 && e.fieldErrors) return new TemplateApiError(e)
  return e
}

export function useNotificationTemplates() {
  function listTemplates(): Promise<NotificationTemplateListItem[]> {
    return apiClient.getAll<NotificationTemplateListItem>(
      '/notifications/templates/?page_size=100',
      { fallback: 'Error al cargar templates' }
    )
  }

  function getTemplate(uuid: string): Promise<NotificationTemplate> {
    return apiClient.get<NotificationTemplate>(`/notifications/templates/${uuid}/`, {
      fallback: 'Error al cargar template',
    })
  }

  async function createTemplate(payload: TemplatePayload): Promise<NotificationTemplate> {
    try {
      return await apiClient.post<NotificationTemplate>('/notifications/templates/', payload, {
        fallback: 'Error de validación',
      })
    } catch (e) {
      throw toTemplateError(e)
    }
  }

  async function updateTemplate(
    uuid: string,
    payload: TemplatePayload
  ): Promise<NotificationTemplate> {
    try {
      return await apiClient.put<NotificationTemplate>(
        `/notifications/templates/${uuid}/`,
        payload,
        { fallback: 'Error de validación' }
      )
    } catch (e) {
      throw toTemplateError(e)
    }
  }

  function deleteTemplate(uuid: string): Promise<void> {
    return apiClient.delete(`/notifications/templates/${uuid}/`, {
      fallback: 'Error al eliminar template',
    })
  }

  function setAsDefault(uuid: string): Promise<{
    success: boolean
    message: string
    template: Pick<
      NotificationTemplate,
      'uuid' | 'name' | 'notification_type' | 'channel' | 'is_default'
    >
  }> {
    return apiClient.post(
      `/notifications/templates/${uuid}/set_as_default/`,
      {},
      { fallback: 'Error al establecer predeterminado' }
    )
  }

  function previewTemplate(
    uuid: string,
    context: Record<string, string>
  ): Promise<{
    template: { uuid: string; name: string }
    preview: { subject?: string; body: string }
  }> {
    return apiClient.post(
      `/notifications/templates/${uuid}/preview/`,
      { context },
      { fallback: 'Error al generar preview' }
    )
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
