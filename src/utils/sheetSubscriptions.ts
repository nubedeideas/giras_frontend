/**
 * Helpers puros de las hojas de Google vinculadas (spec 2026-11-23-importacion-f4-google-sheets.md,
 * §4.2): estado para `StatusBadge`, claves i18n de los errores de lectura, de la API y del selector,
 * y el enlace a una celda. No hay validación de URL: no se pega ningún enlace (D-F4-14).
 */
import { ApiError } from '@/utils/apiClient'
import { apiErrorCodes } from '@/utils/notificationErrors'
import { apiErrorDetail, retryMinutes } from '@/utils/icalSubscriptions'
import type { BadgeStatus } from '@/utils/statusBadge'
import type { SheetSubscription } from '@/composables/useSheetSubscriptions'
import type { PickerErrorCode } from '@/composables/useGooglePicker'

// ─── Estado ───────────────────────────────────────────────────────────────────

export interface SheetBadge {
  status: BadgeStatus
  labelKey: string
}

/** Estado de la lectura (`sheets.status.*`). */
export function sheetStatusBadge(sub: Pick<SheetSubscription, 'last_status'>): SheetBadge {
  switch (sub.last_status) {
    case 'ok':
    case 'not_modified':
      return { status: 'sent', labelKey: 'sheets.status.ok' }
    case 'pending':
      return { status: 'scheduled', labelKey: 'sheets.status.pending' }
    case 'error':
      return { status: 'failed', labelKey: 'sheets.status.error' }
    case 'paused':
      return { status: 'off', labelKey: 'sheets.status.paused' }
    case 'tour_closed':
    case 'tour_ended':
      return { status: 'off', labelKey: 'sheets.status.ended' }
    default:
      return { status: 'off', labelKey: 'sheets.status.paused' }
  }
}

/** Segundo badge "Cambios por revisar" si la lectura ha dejado un job `ready`. */
export function sheetReviewBadge(sub: Pick<SheetSubscription, 'pending_job'>): SheetBadge | null {
  return sub.pending_job?.status === 'ready'
    ? { status: 'pending', labelKey: 'sheets.status.review' }
    : null
}

/** Filas para revisar del job pendiente (nuevas + cambiadas + ya no están). */
export function sheetPendingCount(sub: Pick<SheetSubscription, 'pending_job'>): number {
  const j = sub.pending_job
  if (!j) return 0
  return (j.new || 0) + (j.changed || 0) + (j.removed || 0)
}

/** Nombre a mostrar: el de la vinculación, el título de la hoja o "Hoja sin nombre". */
export function sheetDisplayName(
  sub: Pick<SheetSubscription, 'name' | 'spreadsheet_title'>
): string | null {
  return sub.name || sub.spreadsheet_title || null
}

/** Recuentos de una hoja (job de la vinculación, `pending_job`, ítem del buzón). */
export interface SheetCounts {
  new: number
  changed: number
  removed: number
}

/** `t` con plural (`t(key, named, n)`): basta el de vue-i18n o `InboxTranslate`. */
export type SheetPluralTranslate = (
  key: string,
  named: Record<string, number>,
  plural: number
) => string

/** "3 nuevas · 1 ya no está" (`sheets.counts.*`): solo los mayores que 0; `""` si todos son 0. */
export function sheetCountsText(t: SheetPluralTranslate, c: SheetCounts): string {
  const parts: string[] = []
  for (const key of ['new', 'changed', 'removed'] as const) {
    const n = Number(c[key]) || 0
    if (n > 0) parts.push(t(`sheets.counts.${key}`, { n }, n))
  }
  return parts.join(' · ')
}

// ─── Errores ──────────────────────────────────────────────────────────────────

/** Errores de lectura que se arreglan eligiendo la hoja otra vez o leyéndola con otra cuenta. */
export const SHEET_ACCESS_ERRORS: readonly string[] = [
  'no_access',
  'sheet_not_found',
  'google_access_lost',
  'google_disconnected',
  'reader_not_admin',
]

/** Clave i18n de un `last_error_code` (tabla de §3.4.3); nunca el código crudo. */
export function sheetErrorKey(code: string | null | undefined): string {
  switch ((code ?? '').trim()) {
    case 'google_access_lost':
    case 'google_disconnected':
      return 'sheets.errors.accessLost'
    case 'reader_not_admin':
      return 'sheets.errors.readerNotAdmin'
    case 'no_access':
      return 'sheets.errors.readerNoAccess'
    case 'sheet_not_found':
      return 'sheets.errors.readerNotFound'
    case 'tab_missing':
      return 'sheets.errors.tabMissing'
    default:
      return 'sheets.errors.generic'
  }
}

/** Clave i18n de un error del selector de Google; `null` en `cancelled` (no es un error). */
export function pickerErrorKey(code: PickerErrorCode): string | null {
  switch (code) {
    case 'cancelled':
      return null
    case 'script_failed':
      return 'sheets.errors.script_failed'
    case 'token_failed':
      return 'sheets.errors.token_failed'
    case 'scope_missing':
      return 'sheets.errors.accessLost'
    case 'too_many_requests':
      return 'common.tooManyRequests'
    case 'mobile_unsupported':
      return 'sheets.errors.mobile_unsupported'
    default:
      return 'sheets.errors.not_configured'
  }
}

export interface SheetApiErrorText {
  key: string
  named?: Record<string, string | number>
}

/** Tope por gira por defecto (`SHEETS_MAX_SUBSCRIPTIONS_PER_TOUR`) si el error no trae `details.max`. */
export const SHEETS_DEFAULT_MAX_PER_TOUR = 3

/**
 * Campo de un 400 `invalid_value` → texto. El backend no manda `details.field`: el campo es la
 * clave presente en `details` (`{<campo>: [msg], code: ['invalid_value']}`), en este orden.
 */
const INVALID_FIELD_KEYS: ReadonlyArray<[string, string]> = [
  ['range', 'sheets.errors.invalidRange'],
  ['tabs', 'sheets.errors.invalidTabs'],
  ['name', 'sheets.errors.invalidName'],
  ['spreadsheet_id', 'sheets.errors.invalidSheet'],
]

function invalidFieldKey(e: unknown): string {
  for (const [field, key] of INVALID_FIELD_KEYS) {
    if (apiErrorDetail(e, field) !== null) return key
  }
  return 'sheets.errors.invalidSheet'
}

/** Código de negocio del error, envuelto (`details.code`) o en plano (`code`). */
export function sheetApiErrorCode(e: unknown): string | null {
  const codes = apiErrorCodes(e)
  if (codes.length) return codes[0]
  if (e instanceof ApiError) {
    const code = (e.data as { code?: unknown } | null)?.code
    if (typeof code === 'string') return code
  }
  return null
}

/**
 * Texto i18n de un error de la API de hojas (§3.8); nunca el código crudo. `create`: el 404 es de
 * la gira. `sheetName` completa `spreadsheet_mismatch` ("elige {name}").
 */
export function sheetApiErrorKey(
  e: unknown,
  context: 'create' | 'manage' = 'manage',
  sheetName = ''
): SheetApiErrorText {
  const codes = apiErrorCodes(e)
  const plain = sheetApiErrorCode(e)
  if (plain && !codes.includes(plain)) codes.push(plain)
  for (const code of codes) {
    switch (code) {
      case 'invalid_value':
        return { key: invalidFieldKey(e) }
      case 'already_subscribed':
        return { key: 'sheets.form.alreadyLinked' }
      case 'too_many_subscriptions': {
        const max = Number(apiErrorDetail(e, 'max'))
        return {
          key: 'sheets.errors.too_many_subscriptions',
          named: { max: Number.isFinite(max) && max > 0 ? max : SHEETS_DEFAULT_MAX_PER_TOUR },
        }
      }
      case 'tour_closed':
        return { key: 'sheets.errors.tour_closed' }
      case 'sync_too_soon':
        return { key: 'sheets.errors.sync_too_soon', named: { minutes: retryMinutes(e) } }
      case 'sync_disabled':
        return { key: 'sheets.errors.sync_disabled' }
      case 'tour_required':
        return { key: 'sheets.form.tourRequired' }
      case 'no_access':
        return { key: 'sheets.errors.no_access' }
      case 'sheet_not_found':
        return { key: 'sheets.errors.sheet_not_found' }
      case 'google_unavailable':
        return { key: 'sheets.errors.google_unavailable' }
      case 'picker_token_unavailable':
        return { key: 'sheets.errors.token_failed' }
      case 'google_scope_missing':
        return { key: 'sheets.errors.accessLost' }
      case 'spreadsheet_mismatch':
        return { key: 'sheets.errors.spreadsheet_mismatch', named: { name: sheetName } }
    }
  }
  if (e instanceof ApiError) {
    if (e.status === 0) return { key: 'importer.errors.network' }
    if (e.status === 403) return { key: 'sheets.errors.forbidden' }
    if (e.status === 404) {
      return { key: context === 'create' ? 'sheets.errors.tourNotFound' : 'sheets.errors.notFound' }
    }
    if (e.status === 429) return { key: 'common.tooManyRequests' }
    if (e.status === 502 || e.status === 503) return { key: 'sheets.errors.google_unavailable' }
  }
  return { key: 'sheets.errors.generic' }
}

// ─── Enlaces ──────────────────────────────────────────────────────────────────

/**
 * Enlace a una fila de una pestaña: `{open_url sin #}#gid={gid}&range=A{row}`. `null` sin
 * `open_url` (solo lo recibe quien lee la hoja) o con datos no válidos.
 */
export function sheetCellUrl(
  openUrl: string | null | undefined,
  gid: number | null | undefined,
  row?: number | null
): string | null {
  if (!openUrl || typeof gid !== 'number' || !Number.isInteger(gid) || gid < 0) return null
  const base = openUrl.split('#')[0]
  const range = typeof row === 'number' && Number.isInteger(row) && row > 0 ? `&range=A${row}` : ''
  return `${base}#gid=${gid}${range}`
}
