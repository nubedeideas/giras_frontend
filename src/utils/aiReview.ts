import { ApiError } from '@/utils/apiClient'
import {
  apiErrorCode,
  reminderErrorMessage,
  type ReminderErrorOptions,
  type Translate,
} from '@/utils/reminders'

/**
 * D15.1: a qué grupos por rol se avisa de cada tipo al aplicar los destinos por tipo. Espejo de
 * `TYPE_DESTINATIONS` del backend (`services/role_groups.py`), que es quien lo aplica: el apply no
 * envía `type_destinations` y el backend filtra por los grupos vivos tras crearlos. Aquí solo se
 * usa para el resumen visible del modal.
 */
export const ROLE_TYPE_DESTINATIONS: {
  activity_type_code: string
  buckets: string[]
  include_team: boolean
}[] = [
  ...['soundcheck', 'rehearsal'].map((code) => ({
    activity_type_code: code,
    buckets: ['band', 'technicians'],
    include_team: false,
  })),
  ...['load_in', 'load_out'].map((code) => ({
    activity_type_code: code,
    buckets: ['technicians', 'production'],
    include_team: false,
  })),
  ...[
    'radio_interview',
    'tv_interview',
    'press_conference',
    'photo_session',
    'marketing',
    'meet_greet',
    'fan_activity',
    'signing',
  ].map((code) => ({
    activity_type_code: code,
    buckets: ['band', 'production'],
    include_team: false,
  })),
  ...['security_meeting', 'production_meeting'].map((code) => ({
    activity_type_code: code,
    buckets: ['production'],
    include_team: false,
  })),
  { activity_type_code: 'transport', buckets: ['drivers'], include_team: true },
]

/**
 * Mensaje para los errores de grupos por rol y sugerencias de la IA (spec de recordatorios por
 * tipo, R3). Sobre `reminderErrorMessage` (429, 403/404, `reminders.errors.<code>`) añade el 502
 * con `code` `ai_unavailable`; cualquier otro 5xx usa el genérico. Nunca devuelve un código crudo.
 */
export function aiErrorMessage(
  e: unknown,
  t: Translate,
  fallbackKey: string,
  options: ReminderErrorOptions = {}
): string {
  if (e instanceof ApiError && e.status >= 500) {
    // Solo el 502 con `code` es la IA caída: un 502/503 de nginx (reinicio) es un error genérico.
    if (apiErrorCode(e) === 'ai_unavailable') return t('reminders.errors.ai_unavailable')
    return t(fallbackKey)
  }
  const code = apiErrorCode(e)
  const msg = reminderErrorMessage(e, t, fallbackKey, options)
  return code && msg === code ? t(fallbackKey) : msg
}

/** 409 `not_suggested` / `no_pending_review`: otra pestaña o persona ya lo revisó. */
export function isAlreadyReviewed(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409
}

/** Nombre del grupo por rol en el idioma de la UI (`roleGroups.names.<key>`). */
export function roleBucketName(key: string, t: Translate, fallback = ''): string {
  const k = `roleGroups.names.${key}`
  const s = t(k)
  return s === k ? fallback || key : s
}

/**
 * Error al crear o editar una actividad: 400 `activity_type_invalid` (el tipo no es de la gira ni
 * se puede traducir por código al del owner) con texto propio; si no, el mensaje legible del
 * `ApiError`.
 */
export function activitySaveErrorMessage(e: unknown, t: Translate, fallback: string): string {
  if (apiErrorCode(e) === 'activity_type_invalid') return t('reminders.errors.activity_type_invalid')
  return e instanceof Error && e.message ? e.message : fallback
}
