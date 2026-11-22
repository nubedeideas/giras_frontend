import { ref } from 'vue'
import { apiClient, buildQuery } from '@/utils/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/integrations/import-jobs/ (spec 2026-11-22-importacion-f1-equipo.md, §3.4.6,
// §3.5, §3.7 y §5). Errores envueltos con `details.code` (`apiErrorCodes`).

export type ImportJobStatus =
  | 'uploaded'
  | 'detecting'
  | 'extracting'
  | 'normalizing'
  | 'ready'
  | 'confirming'
  | 'done'
  | 'failed'
  | 'discarded'

/** Estados en los que el job sigue procesándose (el front sondea). */
export const IMPORT_PROCESSING_STATUSES: readonly ImportJobStatus[] = [
  'uploaded',
  'detecting',
  'extracting',
  'normalizing',
  'confirming',
]

export type ImportEntryPoint = 'tour' | 'onboarding' | 'contacts'

/** `source_kind` del job. F1 solo usa `file` y `text`; el resto queda para F3/F5. */
export type ImportSourceKind = 'file' | 'text' | 'ics_file' | 'ical_sync' | 'google_calendar'

/** Tipo de fuente del preproceso (§3.4.2). */
export type ImportSourceType =
  | 'spreadsheet'
  | 'csv'
  | 'text'
  | 'image'
  | 'pdf_text'
  | 'pdf_scan'
  | 'ics'

export type ImportDocKind = 'team' | 'itinerary' | 'mixed' | 'calendar' | 'unknown'

/** Motivo de una fuente (o tramo de páginas de un PDF) diferida (§3.5.1). */
export type ImportDeferredReason =
  | 'calendar_coming_soon'
  | 'itinerary_coming_soon'
  | 'unmasked_disabled'
  | 'scan_pages_limit'
  | 'pdf_encrypted'
  | 'not_team'
  | 'file_unreadable'

/** `error_code` de un job fallido o descartado por la purga (§3.5.7). */
export type ImportJobErrorCode =
  | 'ai_unavailable'
  | 'ai_bad_response'
  | 'file_unreadable'
  | 'timeout'
  | 'internal_error'
  | 'expired'

/** Issues de una fila del equipo (§3.4.6, §3.4.5). */
export type ImportRowIssue =
  | 'phone_invalid'
  | 'phone_missing'
  | 'phone_not_mobile'
  | 'phone_unresolved'
  | 'email_unresolved'
  | 'role_uncertain'
  | 'name_partial'
  | 'ocr_uncertain'
  | 'partial_row'
  | 'name_mismatch'
  | 'multiple_matches'
  | 'duplicate_in_draft'
  | 'multiple_people'
  | 'email_invalid'

export type ImportMatchStatus =
  | 'new'
  | 'existing'
  | 'existing_adds_info'
  | 'already_in_tour'
  | 'name_suggestion'

export type ImportRowAction = 'create' | 'link' | 'skip'

export type ImportPhoneStatus = 'valid' | 'not_mobile' | 'invalid' | 'missing'

/** `source_ref` de una fila: de qué archivo, hoja y fila sale. */
export interface ImportSourceRef {
  /** `ref` de la fuente en `detected.sources` ("d1:Crew", "text", "img1"...). */
  source: string
  document_uuid: string | null
  filename: string
  sheet: string | null
  /** "Crew!12", "CSV!4", "L3", "p2:L7", "img1:3"... */
  row: string
  kind: ImportSourceType
}

/** Candidato de `match.candidates` (contrato real del backend tras la integración de F1). */
export interface ImportMatchCandidate {
  contact_uuid: string
  contact_name: string
  contact_phone: string | null
  contact_email?: string | null
  is_confirmed?: boolean
}

export interface ImportRowMatch {
  status: ImportMatchStatus
  /** `user` cuando el usuario ha elegido el contacto (`link_contact_uuid`). */
  by: 'phone' | 'email' | 'user' | null
  contact_uuid: string | null
  contact_name: string | null
  contact_phone: string | null
  candidates: ImportMatchCandidate[]
}

/** Fila de `draft.team[]` (§3.4.6). */
export interface ImportTeamRow {
  client_id: string
  source_ref: ImportSourceRef
  entity_type: 'person' | 'company'
  first_name: string
  last_name: string
  company: string
  display_name: string
  /** Puesto tal como venía en la hoja ("Monitores", "FOH"...). */
  role_text: string
  role_slug: string | null
  role_uuid: string | null
  role_name: string | null
  is_artist: boolean
  /** E.164 si es válido; si no, vacío o null. */
  phone: string | null
  phone_raw: string
  phone_status: ImportPhoneStatus
  extra_phones: string[]
  email: string
  extra_emails: string[]
  in_group: boolean
  in_group_default: boolean
  /** Ya está en el Equipo de la gira: la casilla "en el grupo" no aplica. */
  already_in_group: boolean
  match: ImportRowMatch
  action: ImportRowAction
  link_contact_uuid: string | null
  ai_confidence: number
  confidence: number
  issues: ImportRowIssue[]
  /** `client_id` de la primera fila con el mismo teléfono o email (`duplicate_in_draft`). */
  duplicate_of?: string | null
  needs_action: boolean
  reviewed: boolean
  edited: boolean
  // `user_action` y `phone_edited` son internos del borrador: el serializer no los expone.
}

export interface ImportPdfPages {
  total: number
  text: number[]
  scanned: number[]
  team: number[]
}

export interface ImportDeferredPages {
  pages: number[]
  reason: ImportDeferredReason
}

/** Fuente de `detected.sources[]` (§3.5.1). */
export interface ImportDetectedSource {
  ref: string
  document_uuid: string | null
  filename: string
  kind: ImportSourceType
  sheet: string | null
  doc_kind: ImportDocKind
  processed: boolean
  deferred: boolean
  deferred_reason: ImportDeferredReason | null
  /** Solo en fuentes `pdf_text`/`pdf_scan`. */
  pages?: ImportPdfPages
  /** Solo en fuentes `pdf_text`/`pdf_scan`. */
  deferred_pages?: ImportDeferredPages[]
  rows_scanned: number
  truncated: boolean
  people_found: number
}

export interface ImportDetected {
  sources: ImportDetectedSource[]
}

export type ImportWarningCode =
  | 'no_team_found'
  | 'rows_truncated'
  | 'sheet_truncated'
  | 'pdf_pages_truncated'
  | 'too_large_truncated'

/** Aviso de `draft.warnings[]` (§3.5.2): código con parámetros opcionales. */
export interface ImportWarning {
  code: ImportWarningCode
  limit?: number
  source?: string
}

export interface ImportAssumptions {
  /** ISO 3166-1 alfa-2. */
  default_region: string
  default_region_source: 'tour_timezone' | 'fallback' | 'user'
}

export interface ImportDraft {
  team: ImportTeamRow[]
  warnings: ImportWarning[]
  assumptions: ImportAssumptions
}

/** Resumen calculado por el serializer (§3.5.4). */
export interface ImportSummary {
  total: number
  to_create: number
  to_link: number
  to_skip: number
  in_group: number
  needs_action: number
  without_phone: number
  not_mobile: number
}

/** Equipo de la gira (§3.5.4): el front avisa si el grupo por defecto de la gira es otro. */
export interface ImportTeamGroup {
  uuid: string | null
  name: string
  exists: boolean
  is_default: boolean
  default_group_name: string | null
}

/** Recuentos de `confirm` (§3.6). `{}` hasta `done`. */
export interface ImportResult {
  contacts_created: number
  /** Incluye `linked_late`. */
  contacts_linked: number
  linked_late: number
  already_in_tour: number
  added_to_group: number
  skipped: number
  team_group_uuid: string
  team_group_is_default: boolean
  contact_uuids: string[]
  /**
   * D10: quien confirma está (o ha entrado) en el Equipo de la gira. `false` si no tiene contacto
   * en la gira. Ausente en jobs confirmados antes de D10.
   */
  confirmer_in_team?: boolean
}

/**
 * D11: estimación de WhatsApp de la gira con las personas que entran al grupo (solo lectura, en el
 * detalle del job en `ready`). `remaining`/`plan_limit` son `null` sin cupo de suscripción.
 */
export interface ImportWhatsappEstimate {
  /** Pasos de WhatsApp futuros de la gira por persona. */
  per_person: number
  /** Altas y vínculos nuevos en el grupo con móvil válido. */
  people: number
  total: number
  remaining: number | null
  plan_limit: number | null
  exceeds: boolean
}

export interface ImportProgress {
  calls_done: number
  calls_total: number
}

export interface ImportJobDocument {
  uuid: string
  filename: string
  /** Absoluta (la de F0b). */
  download_url: string
}

/** Elemento de GET /api/integrations/import-jobs/?tour= (ImportJobListSerializer). */
export interface ImportJobListItem {
  uuid: string
  /** uuid de la gira. */
  tour: string
  tour_name: string
  status: ImportJobStatus
  entry_point: ImportEntryPoint
  source_kind: ImportSourceKind
  filenames: string[]
  people_found: number
  /** Solo con status `ready`/`done`. */
  summary: ImportSummary | null
  /** `""` si no hay error. */
  error_code: ImportJobErrorCode | ''
  created_at: string
  finished_at: string | null
  confirmed_at: string | null
  created_by_name: string | null
}

/** Detalle de GET /api/integrations/import-jobs/{uuid}/ (ImportJobDetailSerializer). */
export interface ImportJob extends ImportJobListItem {
  progress: ImportProgress | Record<string, never>
  detected: ImportDetected | Record<string, never>
  /** `team`/`warnings`/`assumptions` pueden faltar mientras procesa o tras la purga. */
  draft: Partial<ImportDraft>
  team_group: ImportTeamGroup | null
  /** D11. `null` fuera de `ready` o si no aplica. Opcional hasta que lo despliegue el backend. */
  whatsapp_estimate?: ImportWhatsappEstimate | null
  result: ImportResult | Record<string, never>
  error_message: string
  purged_at: string | null
  documents: ImportJobDocument[]
}

/** Campos editables de una fila (`PATCH draft/`, §3.4.6). */
export interface ImportRowFields {
  first_name: string
  last_name: string
  company: string
  entity_type: 'person' | 'company'
  phone: string
  email: string
  role_uuid: string
  in_group: boolean
}

export interface ImportRowPatch {
  client_id: string
  action?: ImportRowAction
  link_contact_uuid?: string | null
  reviewed?: boolean
  fields?: Partial<ImportRowFields>
}

export interface ImportDraftPatch {
  rows?: ImportRowPatch[]
  assumptions?: { default_region: string }
}

export interface CreateImportJobPayload {
  tourUuid: string
  files: File[]
  text?: string
  entryPoint: ImportEntryPoint
}

// ─── Funciones (sin estado) ──────────────────────────────────────────────────

const BASE = '/integrations/import-jobs/'

/** POST multipart: `tour`, un `files` por archivo, `text` y `entry_point`. Responde 202. */
export function createImportJob(p: CreateImportJobPayload): Promise<ImportJob> {
  const form = new FormData()
  form.append('tour', p.tourUuid)
  for (const f of p.files) form.append('files', f, f.name)
  const text = p.text?.trim()
  if (text) form.append('text', text)
  form.append('entry_point', p.entryPoint)
  return apiClient.post<ImportJob>(BASE, form)
}

export function getImportJob(uuid: string): Promise<ImportJob> {
  return apiClient.get<ImportJob>(`${BASE}${uuid}/`)
}

/** Jobs de la gira (paginado DRF), opcionalmente filtrados por estado. */
export function listImportJobs(
  tourUuid: string,
  status?: ImportJobStatus
): Promise<ImportJobListItem[]> {
  return apiClient.getAll<ImportJobListItem>(`${BASE}?${buildQuery({ tour: tourUuid, status })}`)
}

export function patchImportDraft(uuid: string, body: ImportDraftPatch): Promise<ImportJob> {
  return apiClient.patch<ImportJob>(`${BASE}${uuid}/draft/`, body)
}

export function confirmImportJob(uuid: string): Promise<ImportJob> {
  return apiClient.post<ImportJob>(`${BASE}${uuid}/confirm/`, {})
}

export function discardImportJob(
  uuid: string,
  opts: { deleteDocuments?: boolean } = {}
): Promise<ImportJob> {
  return apiClient.post<ImportJob>(`${BASE}${uuid}/discard/`, {
    delete_documents: !!opts.deleteDocuments,
  })
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Envoltorio con `loading`/`error` para las vistas. Las funciones relanzan el `ApiError`: el
 * llamador traduce el `details.code` con `importErrorKey` (`utils/importReview.ts`).
 */
export function useImportJobs() {
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function track<T>(fn: () => Promise<T>): Promise<T> {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e) {
      error.value = e
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    createImportJob: (p: CreateImportJobPayload) => track(() => createImportJob(p)),
    getImportJob: (uuid: string) => track(() => getImportJob(uuid)),
    listImportJobs: (tourUuid: string, status?: ImportJobStatus) =>
      track(() => listImportJobs(tourUuid, status)),
    patchImportDraft: (uuid: string, body: ImportDraftPatch) =>
      track(() => patchImportDraft(uuid, body)),
    confirmImportJob: (uuid: string) => track(() => confirmImportJob(uuid)),
    discardImportJob: (uuid: string, opts?: { deleteDocuments?: boolean }) =>
      track(() => discardImportJob(uuid, opts)),
  }
}
