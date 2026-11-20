import { DateTime } from 'luxon'
import type { NotificationListItem } from '@/composables/useNotifications'

export const SHOW_DAY_ALERT_TYPE = 'show_day_alert'
export const SHOW_DAY_AGENDA_TYPE = 'show_day_agenda'

/** Código de `ActivityType` que identifica un show (el backend filtra por `code`). */
export const SHOW_ACTIVITY_CODE = 'show'

export type ShowDayAlertState =
  | { kind: 'none' }
  | { kind: 'scheduled'; at: string; timezone: string }
  | { kind: 'sending' }
  | { kind: 'sent'; confirmed: number; total: number }
  | { kind: 'failed' }
  | { kind: 'cancelled' }

type AlertInput = Pick<
  NotificationListItem,
  | 'notification_type'
  | 'status'
  | 'scheduled_for'
  | 'created_at'
  | 'send_timezone'
  | 'confirmed_count'
  | 'recipient_count'
>

function sortKey(n: AlertInput): number {
  const iso = n.scheduled_for ?? n.created_at
  const dt = iso ? DateTime.fromISO(iso, { zone: 'utc' }) : null
  return dt && dt.isValid ? dt.toMillis() : 0
}

function latest<T extends AlertInput>(items: T[]): T | null {
  return items.reduce<T | null>((best, n) => (!best || sortKey(n) > sortKey(best) ? n : best), null)
}

/**
 * Estado de la alerta del día de show de una actividad a partir de sus notificaciones.
 * Gana la `show_day_alert` más reciente (por `scheduled_for ?? created_at`). Las canceladas
 * solo cuentan si no queda ninguna viva: al reprogramar, la nueva sustituye a la cancelada.
 */
export function currentShowDayAlert<T extends AlertInput>(notifications: T[]): T | null {
  const alerts = notifications.filter((n) => n.notification_type === SHOW_DAY_ALERT_TYPE)
  const alive = alerts.filter((n) => n.status !== 'cancelled')
  return latest(alive.length ? alive : alerts)
}

/** Estado visible de la alerta (ver `currentShowDayAlert` para qué notificación cuenta). */
export function showDayAlertState(notifications: AlertInput[]): ShowDayAlertState {
  const n = currentShowDayAlert(notifications)
  if (!n) return { kind: 'none' }
  switch (n.status) {
    case 'draft':
    case 'pending':
    case 'scheduled':
      return n.scheduled_for
        ? { kind: 'scheduled', at: n.scheduled_for, timezone: n.send_timezone }
        : { kind: 'none' }
    case 'sending':
      return { kind: 'sending' }
    case 'sent':
      return { kind: 'sent', confirmed: n.confirmed_count, total: n.recipient_count }
    case 'failed':
      return { kind: 'failed' }
    case 'cancelled':
      return { kind: 'cancelled' }
    default:
      return { kind: 'none' }
  }
}

/** Lo que pinta el bloque de estado en el show: el estado, más `disabled` y `hidden`. */
export type ShowDayAlertView = ShowDayAlertState['kind'] | 'disabled' | 'hidden'

/**
 * Sin alerta: si la gira la tiene desactivada, `disabled`; si el show ya pasó, `hidden` (ya no
 * se va a programar). Con alerta, su estado, aunque luego se desactivara en la gira.
 */
export function showDayAlertView(
  state: ShowDayAlertState,
  { activityPast = false, tourEnabled }: { activityPast?: boolean; tourEnabled?: boolean } = {}
): ShowDayAlertView {
  if (state.kind !== 'none') return state.kind
  if (tourEnabled === false) return 'disabled'
  if (activityPast) return 'hidden'
  return 'none'
}

// ─── Hora de la alerta (configuración de la gira) ─────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

/** `"HH:MM:SS"` del backend → `"HH:MM"` para `<input type="time">`; `''` si no hay hora. */
export function alertTimeToInput(value: string | null | undefined): string {
  if (!value) return ''
  const m = TIME_RE.exec(value)
  return m ? `${m[1]}:${m[2]}` : ''
}

/** ¿Hora válida en tramos de 15 min (`HH:00`, `HH:15`, `HH:30`, `HH:45`, sin segundos)? */
export function isQuarterHourTime(value: string): boolean {
  const m = TIME_RE.exec(value)
  if (!m) return false
  return Number(m[2]) % 15 === 0 && (m[3] === undefined || m[3] === '00')
}

/**
 * Valor del input → payload del PATCH. Vacío = `null` (hora por defecto).
 * Devuelve `undefined` si la hora no es válida o no va en tramos de 15 min.
 */
export function alertTimeToPayload(value: string): string | null | undefined {
  const v = value.trim()
  if (!v) return null
  if (!isQuarterHourTime(v)) return undefined
  return v.slice(0, 5)
}

/**
 * Parte del PATCH para la hora. Si no cambió respecto a la cargada no se manda (una hora
 * antigua fuera de tramo no bloquea otros guardados). Devuelve `null` si la nueva no es válida.
 */
export function alertTimePatch(
  current: string,
  initial: string
): { show_day_alert_time?: string | null } | null {
  if (current.trim() === initial.trim()) return {}
  const value = alertTimeToPayload(current)
  return value === undefined ? null : { show_day_alert_time: value }
}
