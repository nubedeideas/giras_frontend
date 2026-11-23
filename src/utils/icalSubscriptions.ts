/**
 * Helpers puros de las suscripciones iCal (spec 2026-11-23-importacion-f3-ics-ical.md, §4.2):
 * estado para `StatusBadge`, claves i18n de los errores de sincronización y de la API, y la
 * comprobación local de la dirección (el backend es quien manda).
 */
import { ApiError } from '@/utils/apiClient'
import { apiErrorCodes } from '@/utils/notificationErrors'
import type { BadgeStatus } from '@/utils/statusBadge'
import type { IcalSubscription } from '@/composables/useIcalSubscriptions'

// ─── Estado ───────────────────────────────────────────────────────────────────

export interface IcalBadge {
  status: BadgeStatus
  labelKey: string
}

/** Estado de la sincronización (`ical.status.*`). */
export function icalStatusBadge(sub: Pick<IcalSubscription, 'last_status'>): IcalBadge {
  switch (sub.last_status) {
    case 'ok':
    case 'not_modified':
      return { status: 'sent', labelKey: 'ical.status.ok' }
    case 'pending':
      return { status: 'scheduled', labelKey: 'ical.status.pending' }
    case 'error':
      return { status: 'failed', labelKey: 'ical.status.error' }
    case 'paused':
      return { status: 'off', labelKey: 'ical.status.paused' }
    case 'tour_closed':
    case 'tour_ended':
      return { status: 'off', labelKey: 'ical.status.ended' }
    default:
      return { status: 'off', labelKey: 'ical.status.paused' }
  }
}

/** Segundo badge "Cambios por revisar" si la sincronización ha dejado un job `ready`. */
export function icalReviewBadge(sub: Pick<IcalSubscription, 'pending_job'>): IcalBadge | null {
  return sub.pending_job?.status === 'ready'
    ? { status: 'pending', labelKey: 'ical.status.review' }
    : null
}

/** Eventos para revisar del job pendiente (nuevos + cambiados + cancelados). */
export function pendingJobCount(sub: Pick<IcalSubscription, 'pending_job'>): number {
  const j = sub.pending_job
  if (!j) return 0
  return (j.new || 0) + (j.changed || 0) + (j.cancelled || 0)
}

/** Recuentos de un calendario (job de suscripción, `pending_job`, ítem del buzón). */
export interface CalendarCounts {
  new: number
  changed: number
  cancelled: number
}

/** `t` con plural (`t(key, named, n)`): basta el de vue-i18n o `InboxTranslate`. */
export type PluralTranslate = (key: string, named: Record<string, number>, plural: number) => string

/**
 * "3 nuevas · 1 cambiada" (`ical.counts.*`, con plural): solo los recuentos mayores que 0, como el
 * cuerpo del aviso del backend. `""` si todos son 0.
 */
export function calendarCountsText(t: PluralTranslate, c: CalendarCounts): string {
  const parts: string[] = []
  for (const key of ['new', 'changed', 'cancelled'] as const) {
    const n = Number(c[key]) || 0
    if (n > 0) parts.push(t(`ical.counts.${key}`, { n }, n))
  }
  return parts.join(' · ')
}

// ─── Errores ──────────────────────────────────────────────────────────────────

const INVALID_URL = new Set(['invalid_url', 'https_required'])
/** Puerto o host que el backend no deja leer (privado, local, puerto raro): no es de formato. */
const NOT_PUBLIC = new Set(['port_not_allowed', 'host_not_allowed'])
const CONNECT = new Set([
  'dns_failed',
  'connection_failed',
  'tls_error',
  'timeout',
  'too_many_redirects',
  'http_5xx',
])
const GONE = new Set(['http_401', 'http_403', 'http_404', 'http_410'])
const TOO_LARGE = new Set(['too_large', 'ics_too_large'])
const NOT_ICS = new Set(['not_ics', 'ics_unreadable'])

/**
 * Clave i18n de un `last_error_code` o de un `details.reason` (tabla de §3.8.1); nunca el código
 * crudo. `credentials_in_url` tiene texto propio ("Quita el usuario y la contraseña").
 */
export function icalErrorKey(code: string | null | undefined): string {
  const c = (code ?? '').trim()
  if (c === 'credentials_in_url') return 'ical.errors.credentials_in_url'
  if (INVALID_URL.has(c)) return 'ical.errors.invalid_url'
  if (NOT_PUBLIC.has(c)) return 'ical.errors.not_public'
  if (GONE.has(c)) return 'ical.errors.gone'
  if (CONNECT.has(c) || /^http_5\d\d$/.test(c)) return 'ical.errors.connect'
  if (TOO_LARGE.has(c)) return 'ical.errors.tooLarge'
  if (NOT_ICS.has(c)) return 'ical.errors.notIcs'
  if (c === 'sync_failed') return 'ical.errors.syncFailed'
  if (c === 'url_unreadable') return 'ical.errors.urlUnreadable'
  // Otros `http_4xx` que el backend no enumera: la dirección no sirve el calendario.
  if (/^http_4\d\d$/.test(c)) return 'ical.errors.gone'
  return 'ical.errors.generic'
}

/** Valor de `details.<key>` de un `ApiError`, envuelto o en plano; listas → primer elemento. */
export function apiErrorDetail(e: unknown, key: string): string | number | null {
  if (!(e instanceof ApiError) || !e.fieldErrors) return null
  const fe = e.fieldErrors as Record<string, unknown>
  const nested = fe.details
  const raw =
    fe[key] ??
    (nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)[key]
      : undefined)
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' || typeof v === 'number' ? v : null
}

export interface IcalApiErrorText {
  key: string
  named?: Record<string, string | number>
}

/** Tope por gira por defecto (`ICAL_MAX_SUBSCRIPTIONS_PER_TOUR`) si el error no trae `details.max`. */
export const ICAL_DEFAULT_MAX_PER_TOUR = 5
/** Espera mínima entre sincronizaciones manuales (`ICAL_MANUAL_SYNC_MIN_MINUTES`). */
export const ICAL_MANUAL_SYNC_MIN_MINUTES = 5

/** Minutos que faltan para poder sincronizar a mano (`retry_after_seconds` redondeado arriba). */
export function retryMinutes(e: unknown): number {
  const raw = Number(apiErrorDetail(e, 'retry_after_seconds'))
  if (!Number.isFinite(raw) || raw <= 0) return ICAL_MANUAL_SYNC_MIN_MINUTES
  return Math.max(1, Math.ceil(raw / 60))
}

/**
 * Texto i18n de un error de la API de suscripciones (§3.9); nunca el código crudo. `create`: el
 * 404 del alta es de la gira (no existe o no la ves), no de una suscripción que ya no existe.
 */
export function icalApiErrorKey(
  e: unknown,
  context: 'create' | 'manage' = 'manage'
): IcalApiErrorText {
  const codes = apiErrorCodes(e)
  for (const code of codes) {
    switch (code) {
      case 'invalid_url': {
        const reason = apiErrorDetail(e, 'reason')
        return { key: icalErrorKey(typeof reason === 'string' ? reason : 'invalid_url') }
      }
      case 'already_subscribed':
        return { key: 'ical.errors.already_subscribed' }
      case 'too_many_subscriptions': {
        const max = Number(apiErrorDetail(e, 'max'))
        return {
          key: 'ical.errors.too_many_subscriptions',
          named: { max: Number.isFinite(max) && max > 0 ? max : ICAL_DEFAULT_MAX_PER_TOUR },
        }
      }
      case 'tour_closed':
        return { key: 'ical.errors.tour_closed' }
      case 'sync_too_soon':
        return { key: 'ical.errors.sync_too_soon', named: { minutes: retryMinutes(e) } }
      case 'sync_disabled':
        return { key: 'ical.errors.sync_disabled' }
      case 'tour_required':
        return { key: 'ical.form.tourRequired' }
    }
  }
  if (e instanceof ApiError) {
    if (e.status === 0) return { key: 'importer.errors.network' }
    if (e.status === 403) return { key: 'ical.errors.forbidden' }
    if (e.status === 404) {
      return { key: context === 'create' ? 'ical.errors.tourNotFound' : 'ical.errors.notFound' }
    }
    if (e.status === 429) return { key: 'common.tooManyRequests' }
  }
  return { key: 'ical.errors.generic' }
}

// ─── Dirección ────────────────────────────────────────────────────────────────

export type IcalUrlProblem = 'invalid_url' | 'credentials_in_url'

/**
 * Comprobación local de la dirección: `https://`, `webcal://` o `webcals://`, con host y sin
 * usuario ni contraseña. Devuelve el problema o `null`. El backend valida además puerto, host e
 * IP (`normalize_ical_url`) y responde con `details.reason`.
 */
export function icalUrlProblem(value: string): IcalUrlProblem | null {
  const v = value.trim()
  if (!v || v.length > 2000) return 'invalid_url'
  const m = /^(https|webcals?):\/\/([^/?#]*)/i.exec(v)
  if (!m) return 'invalid_url'
  const authority = m[2]
  if (authority.includes('@')) return 'credentials_in_url'
  const host = authority.replace(/:\d*$/, '')
  if (!host || /\s/.test(v)) return 'invalid_url'
  return null
}

export function isValidIcalUrlInput(value: string): boolean {
  return icalUrlProblem(value) === null
}
