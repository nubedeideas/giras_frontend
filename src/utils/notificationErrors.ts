/**
 * Códigos de error de las APIs de notificaciones (`details.code`).
 *
 * El backend los manda en dos formas:
 * - envuelta: `{success: false, error: {details: {code: [...]}}}` → `fieldErrors.code`;
 * - 403 heredado de `send` y `remind-unconfirmed`: `{error, detail, usage, details: {code: [...]}}`
 *   en plano → `fieldErrors.details.code`.
 */
import { ApiError } from '@/utils/apiClient'

export const PLAN_LIMIT_REACHED = 'plan_limit_reached'
/** 503 de `send` síncrono y `metadata.quota_error` de una notificación: el limitador no respondió. */
export const PLAN_LIMIT_UNAVAILABLE = 'plan_limit_unavailable'
export const SCHEDULED_AFTER_ACTIVITY = 'scheduled_after_activity'
/** 403 al borrar, renombrar o mover de gira el Equipo de la gira (`system_key='tour_team'`). */
export const SYSTEM_GROUP_LOCKED = 'system_group_locked'

function asStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return []
}

export function apiErrorCodes(e: unknown): string[] {
  if (!(e instanceof ApiError) || !e.fieldErrors) return []
  const fe = e.fieldErrors as Record<string, unknown>
  const nested = fe.details
  const nestedCode =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>).code
      : undefined
  return [...asStrings(fe.code), ...asStrings(nestedCode)]
}

export function hasApiErrorCode(e: unknown, code: string): boolean {
  return apiErrorCodes(e).includes(code)
}

/** Cupo de WhatsApp agotado (403 de envíos manuales, 409 de avisos). */
export function isPlanLimitError(e: unknown): boolean {
  return hasApiErrorCode(e, PLAN_LIMIT_REACHED)
}

/** No se ha podido comprobar el cupo (503 del limitador caído): se puede reintentar. */
export function isQuotaUnavailableError(e: unknown): boolean {
  return hasApiErrorCode(e, PLAN_LIMIT_UNAVAILABLE)
}

/**
 * Notificación retenida porque el limitador de cupo no respondió (`metadata.quota_error`):
 * `scheduled` mientras se reintenta, `failed` al agotar los reintentos (la recoge la tarea de
 * fallidas). En los demás estados la marca ya no aplica.
 */
export function isQuotaRetryPending(n: {
  status: string
  metadata?: Record<string, unknown> | null
}): boolean {
  return (
    (n.status === 'failed' || n.status === 'scheduled') &&
    n.metadata?.quota_error === PLAN_LIMIT_UNAVAILABLE
  )
}
