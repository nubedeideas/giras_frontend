/**
 * Helpers puros del importador (F1, spec 2026-11-22-importacion-f1-equipo.md §4.1): confianza,
 * fases, orden y estado de las filas, si se puede confirmar, fuentes diferidas, claves i18n de
 * error y la validación previa de la subida.
 */
import { ApiError } from '@/utils/apiClient'
import { apiErrorCodes } from '@/utils/notificationErrors'
import type {
  ImportDeferredReason,
  ImportJob,
  ImportJobStatus,
  ImportMatchCandidate,
  ImportRowAction,
  ImportTeamRow,
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

// ─── Confirmar ────────────────────────────────────────────────────────────────

export function canConfirm(job: ImportJob | null | undefined): boolean {
  if (!job || job.status !== 'ready' || !job.summary) return false
  if (job.summary.needs_action !== 0) return false
  return (job.draft?.team ?? []).some((r) => r.action !== 'skip')
}

// ─── Fuentes diferidas ────────────────────────────────────────────────────────

export interface DeferredItem {
  filename: string
  reason: ImportDeferredReason
  /** Solo en tramos de páginas de un PDF. */
  pages: number[] | null
}

/** Una entrada por fuente diferida entera y otra por cada tramo de páginas de PDF diferido. */
export function deferredSources(job: Pick<ImportJob, 'detected'> | null | undefined): DeferredItem[] {
  const sources = (job?.detected && 'sources' in job.detected ? job.detected.sources : []) ?? []
  const out: DeferredItem[] = []
  const seen = new Set<string>()
  for (const s of sources) {
    if (s.deferred && s.deferred_reason) {
      // Un PDF puede dar dos fuentes (texto y escaneada) diferidas por lo mismo: una sola línea.
      const key = `${s.document_uuid ?? s.filename}|${s.deferred_reason}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ filename: s.filename, reason: s.deferred_reason, pages: null })
      }
    }
    for (const dp of s.deferred_pages ?? []) {
      if (dp.pages.length) out.push({ filename: s.filename, reason: dp.reason, pages: [...dp.pages] })
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

export function hasIcs(files: Pick<File, 'name' | 'type'>[]): boolean {
  return files.some((f) => importFileKind(f) === 'ics')
}
