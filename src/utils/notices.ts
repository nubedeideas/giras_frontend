import { DateTime } from 'luxon'
import { ApiError } from '@/utils/apiClient'
import { formatRelativeTime } from '@/utils/relativeTime'
import { apiErrorCode, type Translate } from '@/utils/reminders'
import { isPlanLimitError } from '@/utils/notificationErrors'
import type {
  Notice,
  NoticeEdit,
  NoticeEditableKey,
  NoticeOrigin,
  NoticeSelection,
} from '@/composables/useNotices'

/**
 * Utilidades puras de los avisos bajo demanda (spec 2026-11-21-recordatorios-por-tipo-y-bajo-
 * demanda.md, C2.x): textos de tarjetas, estado, errores y el diff de lo que el usuario ha
 * cambiado (nunca se envían campos que no ha tocado).
 */

export const NOTICE_ORIGINS: NoticeOrigin[] = [
  'cirium_delay',
  'cirium_cancelled',
  'cirium_diverted',
  'cirium_early',
  'urgent',
]

/** Claves editables que en el contrato son campos propios y no `text_overrides` (D14). */
export const TOP_LEVEL_TEXT_KEYS = ['title', 'message'] as const

export const URGENT_TEMPLATE_SLUG = 'whatsapp_urgent_reminder'

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim()
}

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '') return Number(v)
  return Number.NaN
}

function translated(t: Translate, key: string, named?: Record<string, unknown>): string | null {
  const s = t(key, named)
  return s === key ? null : s
}

// ─── Tarjetas ─────────────────────────────────────────────────────────────────

export function originLabel(origin: string, t: Translate): string {
  return translated(t, `notices.origin.${origin}`) ?? t('notices.origin.unknown')
}

/** Clase de color del origen: cancelado, desviado y urgente en naranja; el resto, acento. */
export function originTone(origin: string): 'orange' | 'acid' {
  return origin === 'cirium_cancelled' || origin === 'cirium_diverted' || origin === 'urgent'
    ? 'orange'
    : 'acid'
}

/** "IB3456 · MAD → BCN", o el título de la actividad si no es un vuelo. */
export function noticeHeadline(notice: Pick<Notice, 'params' | 'activity' | 'title'>): string {
  const flight = str(notice.params?.flight_number)
  const route = str(notice.params?.route)
  const parts = [flight, route].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return notice.activity?.title || notice.title || ''
}

/** Resumen del cambio en el idioma de la UI, a partir de `origin` + `params`. */
export function noticeSummary(
  notice: Pick<Notice, 'origin' | 'params' | 'activity' | 'title'>,
  t: Translate
): string {
  const p = notice.params ?? {}
  switch (notice.origin) {
    case 'cirium_delay': {
      const delay = num(p.delay_minutes)
      if (Number.isNaN(delay)) return t('notices.summary.delayUnknown')
      return t('notices.summary.delay', { minutes: delay })
    }
    case 'cirium_early': {
      const shift = num(p.departure_shift_minutes)
      if (Number.isNaN(shift)) return t('notices.summary.earlyUnknown')
      return t('notices.summary.early', { minutes: Math.abs(shift) })
    }
    case 'cirium_cancelled':
      return t('notices.summary.cancelled')
    case 'cirium_diverted':
      return t('notices.summary.diverted')
    default:
      return notice.activity?.title || notice.title || ''
  }
}

/** "Caduca en 2 horas"; `null` sin caducidad o si ya ha vencido. */
export function expiresInLabel(
  expiresAt: string | null,
  t: Translate,
  locale: string,
  now: DateTime = DateTime.now()
): string | null {
  if (!expiresAt) return null
  const date = DateTime.fromISO(expiresAt)
  if (!date.isValid) return null
  const diff = date.toMillis() - now.toMillis()
  if (diff <= 0) return null
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.ceil(diff / 60_000)
  let when: string
  if (minutes < 60) when = rtf.format(minutes, 'minute')
  else if (minutes < 48 * 60) when = rtf.format(Math.round(minutes / 60), 'hour')
  else when = rtf.format(Math.round(minutes / 1440), 'day')
  return t('notices.expiresIn', { when })
}

export function isExpiredByClock(expiresAt: string | null, now: DateTime = DateTime.now()) {
  if (!expiresAt) return false
  const date = DateTime.fromISO(expiresAt)
  return date.isValid && date.toMillis() <= now.toMillis()
}

/** Motivo de cierre legible; `null` si no hay o no se conoce (nunca el código crudo). */
export function closeReasonLabel(reason: string, t: Translate): string | null {
  if (!reason) return null
  return translated(t, `notices.closeReason.${reason}`)
}

/** Línea de estado del historial: quién y cuándo, o por qué se cerró. */
export function noticeStatusLine(
  notice: Pick<
    Notice,
    'status' | 'sent_at' | 'sent_by_name' | 'closed_at' | 'closed_by_name' | 'close_reason'
  >,
  t: Translate,
  locale: string,
  now: DateTime = DateTime.now()
): string {
  const rel = (iso: string | null) => (iso ? formatRelativeTime(iso, locale, t('inbox.time.now'), now) : '')
  switch (notice.status) {
    case 'sent':
      return t('notices.status.sent', {
        who: notice.sent_by_name || t('notices.someone'),
        when: rel(notice.sent_at),
      }).trim()
    case 'discarded':
      return t('notices.status.discarded', { who: notice.closed_by_name || t('notices.someone') })
    case 'expired': {
      const reason =
        notice.close_reason && notice.close_reason !== 'expired'
          ? closeReasonLabel(notice.close_reason, t)
          : null
      return reason ? `${t('notices.status.expired')} · ${reason}` : t('notices.status.expired')
    }
    case 'superseded':
      return t('notices.status.superseded')
    default:
      return t('notices.status.pending')
  }
}

/**
 * La actividad ya ha terminado (mismo criterio que `activity_past` del backend): `end_at` pasado
 * o, sin `end_at`, `scheduled_at` + 2 h pasado.
 */
export function activityHasEnded(
  a: { scheduled_at: string; end_at?: string | null },
  now: DateTime = DateTime.now()
): boolean {
  const end = a.end_at
    ? DateTime.fromISO(a.end_at)
    : DateTime.fromISO(a.scheduled_at).plus({ hours: 2 })
  return end.isValid && end.toMillis() <= now.toMillis()
}

// ─── Plantillas y variables ───────────────────────────────────────────────────

export function templateLabel(
  tpl: { slug: string; name: string },
  t: Translate,
  activityTypeName?: string
): string {
  if (tpl.slug === URGENT_TEMPLATE_SLUG) return t('notices.urgent.template.urgent')
  if (activityTypeName) return t('notices.urgent.template.type', { type: activityTypeName })
  return tpl.name
}

/** Etiqueta de un campo editable (D14); `null` si no se conoce. */
export function editableKeyLabel(key: string, t: Translate): string {
  switch (key) {
    case 'flight_status':
      return t('notices.fields.flightStatus')
    case 'title':
      return t('notices.fields.title')
    case 'message':
      return t('notices.fields.message')
    case 'activity_title':
      return t('notices.fields.activityTitle')
    case 'activity_location':
      return t('notices.fields.activityLocation')
    default:
      return t('notices.fields.other')
  }
}

/** Etiqueta de una variable de plantilla de WhatsApp en la vista previa, o `null`. */
export function variableLabel(key: string, t: Translate): string | null {
  return translated(t, `notices.variables.${key}`)
}

// ─── Diff de edición ──────────────────────────────────────────────────────────

/**
 * Textos cambiados respecto a lo guardado en el servidor, repartidos en el formato del contrato:
 * `title`/`message` como campos propios y el resto en `text_overrides`. Solo claves editables
 * del canal actual y solo si su valor difiere.
 */
export function textEdit(
  editable: NoticeEditableKey[],
  drafts: Record<string, string>
): Pick<NoticeEdit, 'text_overrides' | 'title' | 'message'> {
  const out: Pick<NoticeEdit, 'text_overrides' | 'title' | 'message'> = {}
  const overrides: Record<string, string> = {}
  for (const k of editable) {
    const draft = drafts[k.key]
    if (draft === undefined || draft === k.value) continue
    if (k.key === 'title') out.title = draft
    else if (k.key === 'message') out.message = draft
    else overrides[k.key] = draft
  }
  if (Object.keys(overrides).length) out.text_overrides = overrides
  return out
}

/** Borradores de texto que siguen siendo editables y distintos de lo guardado. */
export function keepDirtyDrafts(
  editable: NoticeEditableKey[],
  drafts: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of editable) {
    const d = drafts[k.key]
    if (d !== undefined && d !== k.value) out[k.key] = d
  }
  return out
}

/**
 * `title` o `message` vaciados: el backend ignora un texto vacío y conservaría el anterior, así
 * que no se permite guardarlos ni enviarlos vacíos.
 */
export function blankRequiredTexts(drafts: Record<string, string>): string[] {
  return TOP_LEVEL_TEXT_KEYS.filter((k) => drafts[k] !== undefined && drafts[k].trim() === '')
}

/** Cupo restante que se puede enseñar ("te quedan N"); `null` sin límite o sin suscripción. */
export function shownRemaining(remaining: number | null | undefined): number | null {
  return typeof remaining === 'number' && remaining >= 0 ? remaining : null
}

/** Texto demasiado largo para su `max_length`. */
export function textTooLong(editable: NoticeEditableKey[], drafts: Record<string, string>) {
  return editable.some((k) => (drafts[k.key] ?? k.value).length > k.max_length)
}

function sameList(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

/** Solo las claves de la selección que han cambiado, con su lista completa. */
export function selectionEdit(
  base: NoticeSelection,
  next: NoticeSelection
): Partial<NoticeSelection> | null {
  const out: Partial<NoticeSelection> = {}
  if (base.use_activity_audience !== next.use_activity_audience) {
    out.use_activity_audience = next.use_activity_audience
  }
  for (const k of ['groups', 'contacts', 'excluded_contacts'] as const) {
    if (!sameList(base[k], next[k])) out[k] = [...next[k]]
  }
  return Object.keys(out).length ? out : null
}

export function emptySelection(): NoticeSelection {
  return { use_activity_audience: true, groups: [], contacts: [], excluded_contacts: [] }
}

export function normalizeSelection(s: Partial<NoticeSelection> | null | undefined): NoticeSelection {
  return {
    use_activity_audience: s?.use_activity_audience ?? true,
    groups: [...(s?.groups ?? [])],
    contacts: [...(s?.contacts ?? [])],
    excluded_contacts: [...(s?.excluded_contacts ?? [])],
  }
}

// ─── Errores ──────────────────────────────────────────────────────────────────

export interface NoticeErrorOptions {
  /** Carga de la lista: un 404 es que la gira ya no es visible (como un 403). */
  load?: boolean
}

/**
 * Mensaje para un error de la API de avisos: 429, 403 (y 404 en cargas), 404 en acciones (el
 * aviso ya no existe, no "no eres admin"), el `code` (`notices.errors.<code>`, luego
 * `reminders.errors.<code>`) o el mensaje legible del backend. Nunca el código crudo.
 */
export function noticeErrorMessage(
  e: unknown,
  t: Translate,
  fallbackKey: string,
  { load = false }: NoticeErrorOptions = {}
): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return t('common.tooManyRequests')
    if (e.status === 403 || (load && e.status === 404)) return t('notices.errors.notAdmin')
    if (e.status === 404) return t('notices.errors.notFound')
    const code = (e as { code?: string | null }).code ?? apiErrorCode(e)
    if (code) {
      return (
        translated(t, `notices.errors.${code}`) ??
        translated(t, `reminders.errors.${code}`) ??
        (e.message && e.message !== code ? e.message : t(fallbackKey))
      )
    }
    return e.message || t(fallbackKey)
  }
  return e instanceof Error && e.message ? e.message : t(fallbackKey)
}

/**
 * Errores tras los que hay que recargar el aviso para ver su estado real: cualquier 409
 * (`notice_not_pending`, `notice_expired`, `activity_unavailable`, `tour_notifications_blocked`).
 */
export function isStaleNotice(e: unknown): boolean {
  // Sin cupo (409 plan_limit_reached) el aviso sigue pendiente: no hace falta recargarlo.
  return e instanceof ApiError && e.status === 409 && !isPlanLimitError(e)
}
