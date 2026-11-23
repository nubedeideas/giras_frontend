/**
 * Helpers puros del importador (F1, spec 2026-11-22-importacion-f1-equipo.md §4.1): confianza,
 * fases, orden y estado de las filas, si se puede confirmar, fuentes diferidas, claves i18n de
 * error y la validación previa de la subida. F2 (2026-11-22-importacion-f2-actividades.md §4.2):
 * filas de actividad (por día, orden, estado, issues, zona) y formato de horas y fechas locales.
 * F3 (2026-11-23-importacion-f3-ics-ical.md §4.2): filas de calendario (cambiadas o canceladas en
 * el calendario), avisos `ics_*` y origen de la zona `ics`/`ics_calendar`.
 */
import { DateTime } from 'luxon'
import { ApiError } from '@/utils/apiClient'
import { apiErrorCodes } from '@/utils/notificationErrors'
import type { ActivityType } from '@/composables/useActivityTypes'
import type {
  ImportActivityRow,
  ImportDeferredReason,
  ImportJob,
  ImportJobStatus,
  ImportMatchCandidate,
  ImportRowAction,
  ImportTeamRow,
  ImportTimezoneSource,
} from '@/composables/useImportJobs'

// ─── Confianza ────────────────────────────────────────────────────────────────

export type ConfidenceTone = 'high' | 'medium' | 'low'

export const CONFIDENCE_HIGH = 0.9
export const CONFIDENCE_MEDIUM = 0.7

/** Verde ≥ 0,90; ámbar 0,70-0,89; rojo < 0,70. */
export function confidenceTone(c: number): ConfidenceTone {
  if (c >= CONFIDENCE_HIGH) return 'high'
  if (c >= CONFIDENCE_MEDIUM) return 'medium'
  return 'low'
}

// ─── Fases del procesamiento ──────────────────────────────────────────────────

/** Fases que pinta `ImportProgress`, en orden. */
export const IMPORT_PHASES = ['uploaded', 'detecting', 'extracting', 'normalizing'] as const
export type ImportPhase = (typeof IMPORT_PHASES)[number]

/** Clave i18n de la fase en curso (`importer.progress.*`). */
export function phaseLabelKey(status: ImportJobStatus): string {
  if (status === 'confirming') return 'importer.progress.confirming'
  if ((IMPORT_PHASES as readonly string[]).includes(status)) return `importer.progress.${status}`
  return 'importer.progress.normalizing'
}

/** Índice de la fase del job (las terminales cuentan como pasadas todas). */
export function phaseIndex(status: ImportJobStatus): number {
  const i = (IMPORT_PHASES as readonly string[]).indexOf(status)
  return i === -1 ? IMPORT_PHASES.length : i
}

// ─── Filas ────────────────────────────────────────────────────────────────────

/** Primero las que piden acción, luego las rojas y después el orden de origen (estable). */
export function sortRows(rows: ImportTeamRow[]): ImportTeamRow[] {
  const rank = (r: ImportTeamRow) =>
    r.needs_action ? 0 : r.action !== 'skip' && confidenceTone(r.confidence) === 'low' ? 1 : 2
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => rank(a.row) - rank(b.row) || a.i - b.i)
    .map((x) => x.row)
}

export type RowStatus =
  | 'new'
  | 'existing'
  | 'adds_info'
  | 'already_in_tour'
  | 'name_suggestion'
  | 'skipped'

export function rowStatus(row: ImportTeamRow): RowStatus {
  if (row.action === 'skip') return 'skipped'
  switch (row.match?.status) {
    case 'existing':
      return 'existing'
    case 'existing_adds_info':
      return 'adds_info'
    case 'already_in_tour':
      return 'already_in_tour'
    case 'name_suggestion':
      // "Es otra persona" ya decidido: se crea como nuevo.
      return row.reviewed && row.action === 'create' ? 'new' : 'name_suggestion'
    default:
      return 'new'
  }
}

/** Clave i18n del estado de la fila (`importer.status.*`). */
export function rowStatusKey(row: ImportTeamRow): string {
  return `importer.status.${rowStatus(row)}`
}

/** Nombre visible de una fila (cae en empresa, puesto o la referencia de origen). */
export function rowDisplayName(r: ImportTeamRow): string {
  return (
    r.display_name ||
    [r.first_name, r.last_name].filter(Boolean).join(' ') ||
    r.company ||
    r.role_text ||
    r.source_ref?.row ||
    r.client_id
  )
}

/**
 * Contactos entre los que elegir en el resolutor: con `name_suggestion`, los candidatos (o el
 * contacto sugerido); con `multiple_matches`, el contacto elegido por el servidor más el resto.
 * Sin duplicados por `contact_uuid`.
 */
export function matchCandidates(r: ImportTeamRow): ImportMatchCandidate[] {
  const m = r.match
  if (!m) return []
  const multiple = r.issues.includes('multiple_matches')
  if (m.status !== 'name_suggestion' && !multiple) return []
  const out: ImportMatchCandidate[] = []
  const seen = new Set<string>()
  const push = (c: ImportMatchCandidate) => {
    if (!c.contact_uuid || seen.has(c.contact_uuid)) return
    seen.add(c.contact_uuid)
    out.push(c)
  }
  if (m.contact_uuid && (multiple || !m.candidates?.length)) {
    push({ contact_uuid: m.contact_uuid, contact_name: m.contact_name ?? '', contact_phone: m.contact_phone })
  }
  for (const c of m.candidates ?? []) push(c)
  return out
}

/** La fila pide elegir contacto ("¿Es la misma persona?" o varios contactos coinciden). */
export function needsResolver(r: ImportTeamRow): boolean {
  return r.action !== 'skip' && matchCandidates(r).length > 0
}

/** `uuid` del contacto con el que se vinculará la fila, o `null` si se crea. */
export function linkedContactUuid(r: ImportTeamRow): string | null {
  if (r.action !== 'link') return null
  return r.link_contact_uuid ?? r.match?.contact_uuid ?? null
}

/** Acción al recuperar una fila omitida: vincular si el servidor encontró el contacto, si no crear. */
export function restoreAction(r: ImportTeamRow): ImportRowAction {
  return r.match?.contact_uuid && r.match.status !== 'name_suggestion' ? 'link' : 'create'
}

export interface DetectedTeamItem {
  key: string
  /** `""` para el texto pegado (la vista pone "Texto pegado"). */
  filename: string
  people: number
}

/** Fuentes con equipo, agrupadas por documento (un PDF puede dar fuente de texto y escaneada). */
export function detectedTeam(job: Pick<ImportJob, 'detected'> | null | undefined): DetectedTeamItem[] {
  const sources = (job?.detected && 'sources' in job.detected ? job.detected.sources : []) ?? []
  const byKey = new Map<string, DetectedTeamItem>()
  for (const s of sources) {
    if (!s.processed || s.deferred || !s.people_found) continue
    const key = s.document_uuid ?? s.ref
    const item = byKey.get(key)
    if (item) item.people += s.people_found
    else byKey.set(key, { key, filename: s.filename, people: s.people_found })
  }
  return [...byKey.values()]
}

// ─── Actividades (F2) ─────────────────────────────────────────────────────────

/** Los 24 códigos que admite `PATCH draft/` (`importer/activity_types.py` del backend). */
export const ACTIVITY_TYPE_CODES: readonly string[] = [
  'show',
  'soundcheck',
  'rehearsal',
  'load_in',
  'load_out',
  'flight',
  'transport',
  'hotel_checkin',
  'hotel_checkout',
  'radio_interview',
  'tv_interview',
  'press_conference',
  'photo_session',
  'marketing',
  'team_meeting',
  'production_meeting',
  'security_meeting',
  'urgent_meeting',
  'meet_greet',
  'fan_activity',
  'signing',
  'day_off',
  'personal',
  'other',
]

export interface ActivityTypeOption {
  code: string
  name: string
  /** Color del tipo de la gira (solo para el punto) o `null` si la gira aún no lo tiene. */
  color: string | null
}

/**
 * Tipos que se pueden elegir en la revisión: los de la gira con uno de los 24 códigos (activos) y
 * los que traen las filas aunque la gira no los tenga (`type_available=false`: `confirm` los crea).
 * Ordenados por `display_order` de la gira y después por nombre.
 */
export function activityTypeOptions(
  types: Pick<ActivityType, 'code' | 'name' | 'color' | 'is_active' | 'display_order'>[],
  rows: Pick<ImportActivityRow, 'activity_type_code' | 'type_name'>[] = []
): ActivityTypeOption[] {
  const valid = new Set(ACTIVITY_TYPE_CODES)
  const out = new Map<string, ActivityTypeOption & { order: number }>()
  for (const ty of types) {
    if (!valid.has(ty.code) || ty.is_active === false || out.has(ty.code)) continue
    out.set(ty.code, { code: ty.code, name: ty.name, color: ty.color || null, order: ty.display_order ?? 0 })
  }
  for (const r of rows) {
    if (!r.activity_type_code || out.has(r.activity_type_code)) continue
    out.set(r.activity_type_code, {
      code: r.activity_type_code,
      name: r.type_name || r.activity_type_code,
      color: null,
      order: Number.MAX_SAFE_INTEGER,
    })
  }
  return [...out.values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(({ code, name, color }) => ({ code, name, color }))
}

/**
 * La fila de actividad pide decisión: la marca del servidor (`needs_action`) o, sin omitir, que no
 * tenga instante (sin fecha o sin hora y sin "Todo el día"): `confirm` la rechazaría con
 * `unresolved_rows` aunque su confianza no baje de 0,70.
 */
export function activityNeedsAction(r: ImportActivityRow): boolean {
  // F3: "Cancelada en el calendario" llega con `skip` ("Mantener") y `needs_action` hasta que el
  // usuario elige: omitida no basta para darla por resuelta.
  if (r.match?.status === 'cancelled_in_source') return r.action !== 'cancel' && r.needs_action
  if (r.action === 'skip') return false
  return r.needs_action || !r.scheduled_at
}

/** Primero las que piden acción, luego las rojas y después por `scheduled_at` (sin hora al final). */
export function sortActivityRows(rows: ImportActivityRow[]): ImportActivityRow[] {
  const rank = (r: ImportActivityRow) =>
    activityNeedsAction(r) ? 0 : r.action !== 'skip' && confidenceTone(r.confidence) === 'low' ? 1 : 2
  const time = (r: ImportActivityRow) => (r.scheduled_at ? Date.parse(r.scheduled_at) : Infinity)
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => rank(a.row) - rank(b.row) || time(a.row) - time(b.row) || a.i - b.i)
    .map((x) => x.row)
}

export interface ActivityDayGroup {
  /** `YYYY-MM-DD` local o `null` ("Sin fecha", siempre al final). */
  date: string | null
  rows: ImportActivityRow[]
}

/**
 * Agrupa por la fecha local de la fila (`date`); si no la trae pero sí `scheduled_at`, por su día en
 * `tz` (la zona de la gira). Días en orden y, dentro de cada uno, el orden de `sortActivityRows`.
 */
export function groupActivitiesByDay(rows: ImportActivityRow[], tz: string): ActivityDayGroup[] {
  const byDate = new Map<string | null, ImportActivityRow[]>()
  for (const r of rows) {
    let date = r.date
    if (!date && r.scheduled_at) {
      const dt = DateTime.fromISO(r.scheduled_at, { zone: 'utc' }).setZone(tz)
      date = dt.isValid ? dt.toISODate() : null
    }
    const list = byDate.get(date ?? null)
    if (list) list.push(r)
    else byDate.set(date ?? null, [r])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
    .map(([date, list]) => ({ date, rows: sortActivityRows(list) }))
}

/** Documento de origen de una fila ("Abrir documento" lo descarga con el token, vía `apiClient`). */
export interface ImportSourceDocument {
  tourUuid: string
  uuid: string
  filename: string
}

export type ActivityStatus =
  | 'new'
  | 'duplicate'
  | 'possible_duplicate'
  | 'duplicate_in_draft'
  | 'replace'
  | 'skipped'
  | 'duplicate_kept'
  | 'duplicate_in_draft_kept'
  // F3: filas de calendario ya importadas
  | 'updated_in_source'
  | 'updated_conflict'
  | 'updated_kept'
  | 'cancelled_in_source'
  | 'cancelled_kept'
  | 'cancel'

/** La fila sale de un calendario (`.ics` subido o suscripción iCal). */
export function isCalendarRow(r: Pick<ImportActivityRow, 'source_ref'>): boolean {
  return r.source_ref?.kind === 'ics'
}

/** El evento del calendario ya importado cambió (`updated_in_source`). */
export function isCalendarChangeRow(r: Pick<ImportActivityRow, 'match'>): boolean {
  return r.match?.status === 'updated_in_source'
}

/** El evento del calendario ya importado se canceló o desapareció (`cancelled_in_source`). */
export function isCalendarCancelRow(r: Pick<ImportActivityRow, 'match'>): boolean {
  return r.match?.status === 'cancelled_in_source'
}

/**
 * Estado de la fila. Un duplicado seguro (`duplicate`, `duplicate_in_draft`) que el usuario recupera
 * (`create`) conserva su insignia (`*_kept`) y el resolutor de duplicado. F3: "Cambió en el
 * calendario" (con conflicto, por decidir hasta elegir) y "Cancelada en el calendario" (por decidir
 * hasta elegir "Cancelar actividad" o "Mantener").
 */
export function activityStatus(r: ImportActivityRow): ActivityStatus {
  if (r.action === 'cancel') return 'cancel'
  if (isCalendarCancelRow(r)) return activityNeedsAction(r) ? 'cancelled_in_source' : 'cancelled_kept'
  if (isCalendarChangeRow(r)) {
    if (r.action === 'skip') return 'updated_kept'
    if (r.match.conflict && r.needs_action) return 'updated_conflict'
    if (r.action === 'replace') return 'updated_in_source'
  }
  if (r.action === 'replace') return 'replace'
  const status = r.match?.status
  if (r.action === 'skip') {
    if (status === 'duplicate') return 'duplicate'
    if (status === 'duplicate_in_draft' || r.duplicate_of) return 'duplicate_in_draft'
    return 'skipped'
  }
  if (status === 'duplicate') return 'duplicate_kept'
  if (status === 'duplicate_in_draft' || r.duplicate_of) return 'duplicate_in_draft_kept'
  // "Crear igualmente" ya decidido (`reviewed`): se crea como nueva.
  if (status === 'possible_duplicate' && !r.reviewed) return 'possible_duplicate'
  return 'new'
}

/** Clave i18n del estado de la fila (`importer.activityStatus.*`). */
export function activityStatusKey(r: ImportActivityRow): string {
  return `importer.activityStatus.${activityStatus(r)}`
}

const ACTIVITY_ISSUES = new Set([
  'month_inferred',
  'replace_target_changed',
  'time_missing',
  'time_unverified',
  'time_assumed',
  'date_missing',
  'date_unverified',
  'year_assumed',
  'date_ambiguous_dmy',
  'weekday_mismatch',
  'outside_tour',
  'timezone_inherited',
  'type_uncertain',
  'flight_number_invalid',
  'ocr_uncertain',
  'partial_row',
  'in_past',
  'checkout_inferred',
])

/**
 * Clave i18n de un issue de actividad, o `null` si no tiene texto propio (`possible_duplicate` lo
 * cuenta el estado; uno desconocido no se pinta nunca en crudo).
 */
export function activityIssueKey(code: string): string | null {
  return ACTIVITY_ISSUES.has(code) ? `importer.activityIssues.${code}` : null
}

const TZ_SOURCES = new Set<ImportTimezoneSource>([
  'iata',
  'city',
  'airports',
  'country',
  'geocoding',
  'ai_hint',
  'tour',
  'user',
  'ics',
  'ics_calendar',
])

/** Clave i18n de por qué la fila tiene esa zona (`importer.tzSource.*`). */
export function timezoneSourceKey(source: string | null | undefined): string | null {
  return source && TZ_SOURCES.has(source as ImportTimezoneSource)
    ? `importer.tzSource.${source}`
    : null
}

/** `HH:mm` local de un instante UTC en `tz` (`""` si no hay instante o no es válido). */
export function formatLocalTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz)
  return dt.isValid ? dt.toFormat('HH:mm') : ''
}

/** Fecha local corta ("mié 3 dic") de un instante UTC en `tz`. */
export function formatLocalDate(iso: string | null | undefined, tz: string, locale = 'es'): string {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz).setLocale(locale)
  return dt.isValid ? dt.toFormat('ccc d LLL') : ''
}

/** Fecha de calendario `YYYY-MM-DD` como "mié 3 dic" (sin zona: ya es local). */
export function formatDayLabel(date: string, locale = 'es'): string {
  const dt = DateTime.fromISO(date).setLocale(locale)
  return dt.isValid ? dt.toFormat('ccc d LLL') : date
}

/** Abreviatura de la zona en ese instante ("CET", "GMT-6"); la IANA si no hay instante. */
export function zoneShortName(tz: string, iso: string | null | undefined, locale = 'es'): string {
  const base = iso ? DateTime.fromISO(iso, { zone: 'utc' }) : DateTime.now()
  const dt = base.setZone(tz).setLocale(locale)
  if (!dt.isValid) return tz
  return dt.offsetNameShort ?? tz
}

const DAY_NUMBER_RE = /\b(day|d[ií]a|jour|tag|giorno|dia)\s*\d{1,3}\b/i

/**
 * Algún indicio de días numerados ("DAY 3", "Día 3"): el supuesto "Día 1 = …" solo tiene sentido
 * entonces. El contrato de la fila no trae `day_number`: se mira `date_source`, el "Día 1" ya fijado
 * y el texto de fecha o la cabecera de contexto.
 */
export function hasDayNumbers(
  rows: ImportActivityRow[],
  dayOneDate?: string | null
): boolean {
  if (dayOneDate) return true
  return rows.some(
    (r) =>
      r.date_source === 'day_number' ||
      DAY_NUMBER_RE.test(r.date_text ?? '') ||
      DAY_NUMBER_RE.test(r.source_ref?.context ?? '')
  )
}

const HOTEL_CODES = new Set(['hotel_checkin', 'hotel_checkout'])

export function isHotelRow(r: Pick<ImportActivityRow, 'activity_type_code'>): boolean {
  return HOTEL_CODES.has(r.activity_type_code)
}

/** Check-out emparejado de una estancia (la marca "Salida de {hotel}"). */
export function isPairedCheckout(r: ImportActivityRow): boolean {
  return r.activity_type_code === 'hotel_checkout' && !!r.pair_id
}

/** Hora local que se pinta: `start_time` (`HH:MM`) o, si no, la de `scheduled_at`. */
export function activityTime(r: ImportActivityRow): string {
  if (r.all_day) return ''
  return r.start_time || formatLocalTime(r.scheduled_at, r.timezone)
}

export interface DetectedActivitiesItem {
  key: string
  filename: string
  activities: number
}

/** Fuentes con actividades, agrupadas por documento (como `detectedTeam`). */
export function detectedActivities(
  job: Pick<ImportJob, 'detected'> | null | undefined
): DetectedActivitiesItem[] {
  const sources = (job?.detected && 'sources' in job.detected ? job.detected.sources : []) ?? []
  const byKey = new Map<string, DetectedActivitiesItem>()
  for (const s of sources) {
    if (!s.processed || s.deferred || !s.activities_found) continue
    const key = s.document_uuid ?? s.ref
    const item = byKey.get(key)
    if (item) item.activities += s.activities_found
    else byKey.set(key, { key, filename: s.filename, activities: s.activities_found })
  }
  return [...byKey.values()]
}

/** Filas por resolver del job: equipo (`needs_action`) y actividades (`activityNeedsAction`). */
export function pendingCounts(job: ImportJob | null | undefined): {
  team: number
  activities: number
  total: number
} {
  const team = (job?.draft?.team ?? []).filter((r) => r.needs_action).length
  const activities = (job?.draft?.activities ?? []).filter(activityNeedsAction).length
  return { team, activities, total: team + activities }
}

// ─── Calendario (F3) ──────────────────────────────────────────────────────────

/** `activity_uuid` de las actividades que ya no están en el feed (`detected.ical.removed`). */
export function removedActivityUuids(job: Pick<ImportJob, 'detected'> | null | undefined): string[] {
  const d = job?.detected
  const removed = d && 'ical' in d ? (d.ical?.removed ?? []) : []
  return removed.map((x) => x.activity_uuid).filter(Boolean)
}

/**
 * `20261203T200000Z` (UTC), `20261203T200000` (local) o `20261203` (día) de `RECURRENCE-ID` como
 * fecha legible ("mié 3 dic 21:00"); en `tz` si es UTC. `""` si no se entiende.
 */
export function formatRecurrenceId(value: string | null | undefined, tz: string, locale = 'es'): string {
  if (!value) return ''
  const v = value.trim()
  const utc = v.endsWith('Z')
  const raw = utc ? v.slice(0, -1) : v
  const withTime = raw.includes('T')
  let dt = withTime
    ? DateTime.fromFormat(raw, "yyyyMMdd'T'HHmmss", { zone: utc ? 'utc' : tz })
    : DateTime.fromFormat(raw, 'yyyyMMdd', { zone: tz })
  if (!dt.isValid) return ''
  if (utc) dt = dt.setZone(tz)
  return dt.setLocale(locale).toFormat(withTime ? 'ccc d LLL HH:mm' : 'ccc d LLL')
}

const WARNING_CODES = new Set([
  'no_team_found',
  'rows_truncated',
  'sheet_truncated',
  'pdf_pages_truncated',
  'too_large_truncated',
  'no_content_found',
  'no_activities_found',
  'activity_rows_truncated',
  'block_truncated',
  'date_order_mixed',
  'ics_outside_window',
  'ics_series_truncated',
  'ics_cancelled_ignored',
  'ics_classification_unavailable',
])

/** Clave i18n de un aviso del borrador (`importer.warnings.*`) o `null` si no tiene texto propio. */
export function warningKey(code: string | null | undefined): string | null {
  return code && WARNING_CODES.has(code) ? `importer.warnings.${code}` : null
}

// ─── Confirmar ────────────────────────────────────────────────────────────────

/**
 * `ready`, sin nada por resolver (equipo ni actividades) y con al menos una fila no omitida en
 * total. Se cuenta sobre las filas (no `summary.needs_action`) para incluir las actividades sin
 * instante, que el servidor rechazaría aunque no lleven `needs_action`.
 */
export function canConfirm(job: ImportJob | null | undefined): boolean {
  if (!job || job.status !== 'ready' || !job.summary) return false
  if (pendingCounts(job).total > 0) return false
  return (
    (job.draft?.team ?? []).some((r) => r.action !== 'skip') ||
    (job.draft?.activities ?? []).some((r) => r.action !== 'skip')
  )
}

// ─── Fuentes diferidas ────────────────────────────────────────────────────────

export interface DeferredItem {
  filename: string
  reason: ImportDeferredReason
  /** Solo en tramos de páginas de un PDF. */
  pages: number[] | null
}

/**
 * Una entrada por cada tramo de páginas de PDF diferido y otra por fuente diferida entera que no
 * traiga tramos.
 */
export function deferredSources(job: Pick<ImportJob, 'detected'> | null | undefined): DeferredItem[] {
  const sources = (job?.detected && 'sources' in job.detected ? job.detected.sources : []) ?? []
  const out: DeferredItem[] = []
  const seen = new Set<string>()
  for (const s of sources) {
    const pageSpans = (s.deferred_pages ?? []).filter((dp) => dp.pages.length)
    // Si la fuente trae sus tramos de páginas, ya dicen qué se aplaza y por qué: la línea de la
    // fuente entera los repetiría.
    if (s.deferred && s.deferred_reason && !pageSpans.length) {
      // Un PDF puede dar dos fuentes (texto y escaneada) diferidas por lo mismo: una sola línea.
      const key = `${s.document_uuid ?? s.filename}|${s.deferred_reason}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ filename: s.filename, reason: s.deferred_reason, pages: null })
      }
    }
    for (const dp of pageSpans) {
      out.push({ filename: s.filename, reason: dp.reason, pages: [...dp.pages] })
    }
  }
  return out
}

/** `[3, 4, 5, 7]` → `"3-5, 7"`. */
export function pageRanges(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    parts.push(j === i ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`)
    i = j + 1
  }
  return parts.join(', ')
}

// ─── Errores ──────────────────────────────────────────────────────────────────

/** Códigos con mensaje propio en `importer.errors.*` (del job y de la API). */
const ERROR_CODES = new Set([
  'ai_unavailable',
  'ai_bad_response',
  'file_unreadable',
  'timeout',
  'internal_error',
  'expired',
  'empty_import',
  'too_large',
  'too_many_active_imports',
  'tour_closed',
  'unmasked_disabled',
  'unresolved_rows',
  'already_confirmed',
  'job_not_ready',
  // PATCH draft/ (§5)
  'unknown_row',
  'invalid_contact',
  'invalid_email',
  'invalid_role',
  'invalid_region',
  'too_many_rows',
  'invalid_value',
  'tour_required',
  // PATCH draft/ y confirm de actividades (F2 §3.6, §3.7)
  'invalid_action',
  'invalid_type',
  'invalid_timezone',
  'unknown_city',
  'date_required',
  'activity_gone',
])

/** Errores de validación del archivo (`apps/core/validators.py`, `validate_tour_document_file`). */
const FILE_CODES = new Set([
  'invalid_document_format',
  'invalid_image_format',
  'image_validation_error',
  'invalid_excel_format',
  'invalid_csv_format',
  'invalid_csv_content',
  'invalid_ics_format',
  'invalid_ics_content',
  'invalid_pdf_format',
  'invalid_pdf_content',
  'pdf_validation_error',
  'file_too_large',
])

/** Clave i18n de un código de error del job o de la API; nunca el código crudo. */
export function errorKey(code: string | null | undefined): string {
  if (code && ERROR_CODES.has(code)) return `importer.errors.${code}`
  if (code && FILE_CODES.has(code)) return 'importer.errors.invalidFile'
  return 'importer.errors.generic'
}

/**
 * `client_id` de las filas a las que se refiere un error (`details.rows`: `unknown_row`,
 * `invalid_contact`, `invalid_email`, `invalid_role`, `unresolved_rows`). Envuelto o en plano.
 */
export function apiErrorRows(e: unknown): string[] {
  if (!(e instanceof ApiError) || !e.fieldErrors) return []
  const fe = e.fieldErrors as Record<string, unknown>
  const nested = fe.details
  const nestedRows =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>).rows
      : undefined
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []
  return [...new Set([...strings(fe.rows), ...strings(nestedRows)])]
}

/** Clave i18n de un error de la API del importador (`details.code`, o por estado). */
export function importErrorKey(e: unknown): string {
  for (const code of apiErrorCodes(e)) {
    const key = errorKey(code)
    if (key !== 'importer.errors.generic') return key
  }
  if (e instanceof ApiError) {
    if (e.status === 0) return 'importer.errors.network'
    if (e.status === 403) return 'importer.errors.forbidden'
    if (e.status === 404) return 'importer.errors.notFound'
    if (e.status === 429) return 'importer.errors.throttled'
  }
  return 'importer.errors.generic'
}

// ─── Subida: validación previa ────────────────────────────────────────────────

export const IMPORT_MAX_FILES = 6
export const IMPORT_MAX_TOTAL_BYTES = 20 * 1024 * 1024
export const IMPORT_MAX_TEXT_CHARS = 20_000

const MB = 1024 * 1024

export type ImportFileKind = 'pdf' | 'excel' | 'csv' | 'ics' | 'image'

const KIND_BY_EXT: Record<string, ImportFileKind> = {
  pdf: 'pdf',
  xlsx: 'excel',
  xls: 'excel',
  csv: 'csv',
  ics: 'ics',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  gif: 'image',
  // HEIC/HEIF: solo si el navegador sabe decodificarla (`downscaleImage` la pasa a JPEG).
  heic: 'image',
  heif: 'image',
}

/** Tamaño máximo por tipo (el de imagen, ya reducida con `downscaleImage`). */
export const IMPORT_MAX_BYTES: Record<ImportFileKind, number> = {
  pdf: 15 * MB,
  excel: 20 * MB,
  csv: 10 * MB,
  ics: 5 * MB,
  image: 5 * MB,
}

export function importFileKind(file: Pick<File, 'name' | 'type'>): ImportFileKind | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (KIND_BY_EXT[ext]) return KIND_BY_EXT[ext]
  if (file.type.startsWith('image/')) return 'image'
  return null
}

export type ImportFileProblem =
  | { code: 'fileType'; file: string }
  | { code: 'fileTooLarge'; file: string; mb: number }
  | { code: 'tooManyFiles' }
  | { code: 'too_large' }

/**
 * Comprueba tipos, tamaño por tipo, número de archivos y total. Se llama con las imágenes ya
 * reducidas. Devuelve el primer problema o `null`.
 */
export function validateImportFiles(files: Pick<File, 'name' | 'type' | 'size'>[]): ImportFileProblem | null {
  if (files.length > IMPORT_MAX_FILES) return { code: 'tooManyFiles' }
  let total = 0
  for (const f of files) {
    const kind = importFileKind(f)
    if (!kind) return { code: 'fileType', file: f.name }
    const max = IMPORT_MAX_BYTES[kind]
    if (f.size > max) return { code: 'fileTooLarge', file: f.name, mb: Math.round(max / MB) }
    total += f.size
  }
  if (total > IMPORT_MAX_TOTAL_BYTES) return { code: 'too_large' }
  return null
}

/** Hay algún `.ics` entre los archivos (F3: pista neutra en la subida, ya no "llegará pronto"). */
export function hasIcs(files: Pick<File, 'name' | 'type'>[]): boolean {
  return files.some((f) => importFileKind(f) === 'ics')
}
