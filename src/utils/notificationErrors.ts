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
export const SCHEDULED_AFTER_ACTIVITY = 'scheduled_after_activity'

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
