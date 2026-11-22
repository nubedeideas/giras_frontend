import { ref } from 'vue'
import { apiClient, buildQuery } from '@/utils/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/integrations/import-jobs/ (spec 2026-11-22-importacion-f1-equipo.md, §3.4.6,
// §3.5, §3.7 y §5; ampliado con F2 en 2026-11-22-importacion-f2-actividades.md, §3.5.1, §3.5.8,
// §3.6, §3.7.1, §3.11 y §5). Errores envueltos con `details.code` (`apiErrorCodes`).

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

export type ImportEntryPoint = 'tour' | 'onboarding' | 'contacts' | 'activities' | 'dashboard'

export const IMPORT_ENTRY_POINTS: readonly ImportEntryPoint[] = [
  'tour',
  'onboarding',
  'contacts',
  'activities',
  'dashboard',
]

/**
 * Qué espera encontrar quien importa (F2 §3.11). Solo desempata la detección y ordena los bloques
 * de la revisión: nunca descarta contenido. `any` no se manda al backend (es su valor por defecto).
 */
export type ImportExpected = 'team' | 'itinerary' | 'any'

export const IMPORT_EXPECTED: readonly ImportExpected[] = ['team', 'itinerary', 'any']

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

/**
 * Motivo de una fuente (o tramo de páginas de un PDF) diferida (§3.5.1). F2 ya no produce
 * `itinerary_coming_soon`, pero se conserva para los jobs de F1.
 */
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

/**
 * `source_ref` de una fila de actividad (F2 §3.5.8): añade página, el texto original de la fila
 * (`snippet`, sin enmascarar, máx. 300 caracteres; vacío en fotos y escaneados) y la cabecera de día
 * que la IA usó como contexto.
 */
export interface ImportActivitySourceRef extends ImportSourceRef {
  page: number | null
  snippet: string
  context: string | null
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
  /** F2: páginas de itinerario. Ausente en jobs de F1. */
  itinerary?: number[]
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
  /** F2. Ausente en jobs de F1. */
  activities_found?: number
}

export interface ImportDetected {
  sources: ImportDetectedSource[]
  /** F2: lo que pidió la entrada al crear el job (`any` por defecto). Ausente en jobs de F1. */
  expected?: ImportExpected
}

export type ImportWarningCode =
  | 'no_team_found'
  | 'rows_truncated'
  | 'sheet_truncated'
  | 'pdf_pages_truncated'
  | 'too_large_truncated'
  // F2 (§3.4, §3.5.2, §3.5.9)
  | 'no_content_found'
  | 'no_activities_found'
  | 'activity_rows_truncated'
  | 'block_truncated'
  | 'date_order_mixed'

/** Aviso de `draft.warnings[]` (§3.5.2): código con parámetros opcionales. */
export interface ImportWarning {
  code: ImportWarningCode
  limit?: number
  source?: string
}

export type ImportDateOrder = 'dmy' | 'mdy' | 'ymd'

export type ImportTimezoneSource =
  | 'iata'
  | 'city'
  | 'airports'
  | 'country'
  | 'geocoding'
  | 'ai_hint'
  | 'tour'
  | 'user'

/** Zona resuelta de una ciudad del job (`assumptions.cities[city_key]`, F2 §3.5.1). */
export interface ImportCityTz {
  label: string
  /** ISO 3166-1 alfa-2 o null si no se sabe. */
  country: string | null
  timezone: string
  source: ImportTimezoneSource
  candidates: string[]
}

/**
 * Supuestos del job (F1 + F2 §3.5.1). Las claves de F2 son opcionales porque los jobs de F1 solo
 * traen la región.
 */
export interface ImportAssumptions {
  /** ISO 3166-1 alfa-2. */
  default_region: string
  default_region_source: 'tour_timezone' | 'fallback' | 'user'
  year?: number
  year_source?: 'tour' | 'user'
  date_order?: ImportDateOrder
  date_order_source?: 'detected' | 'language' | 'user'
  date_order_conflict?: boolean
  default_timezone?: string
  default_timezone_source?: 'tour' | 'user'
  /** `YYYY-MM-DD` del "Día 1" o null. */
  day_one_date?: string | null
  /** Origen del "Día 1" (usuario o inferido de las filas); el contrato no cierra los valores. */
  day_one_source?: string | null
  /** `HH:MM`. */
  hotel_checkin_time?: string
  hotel_checkout_time?: string
  /** Clave `ciudad|país` ("madrid|es"). */
  cities?: Record<string, ImportCityTz>
}

// ─── Actividades (F2 §3.5.8) ─────────────────────────────────────────────────

/** Issues de una fila de actividad (§3.5.7). `in_past` es un booleano aparte, no un issue. */
export type ImportActivityIssue =
  | 'time_missing'
  | 'time_unverified'
  | 'time_assumed'
  | 'date_missing'
  | 'date_unverified'
  | 'year_assumed'
  | 'date_ambiguous_dmy'
  | 'weekday_mismatch'
  | 'outside_tour'
  | 'timezone_inherited'
  | 'type_uncertain'
  | 'flight_number_invalid'
  | 'ocr_uncertain'
  | 'partial_row'
  | 'possible_duplicate'

export type ImportActivityMatchStatus =
  | 'new'
  | 'duplicate'
  | 'possible_duplicate'
  | 'duplicate_in_draft'

export type ImportActivityAction = 'create' | 'skip' | 'replace'

export type ImportActivityDateSource = 'text' | 'year_assumed' | 'day_number' | 'user'

/** Coincidencia con una actividad existente de la gira (§3.5.6). */
export interface ImportActivityMatch {
  status: ImportActivityMatchStatus
  by: 'flight' | 'hotel' | 'type_time_title' | 'type_day' | null
  activity_uuid: string | null
  activity_title: string | null
  /** ISO UTC. */
  activity_scheduled_at: string | null
  activity_type_code: string | null
  activity_external_source: string | null
}

export interface ImportAirport {
  code: string
  name: string
  city: string
}

/**
 * `metadata` de la fila (la que irá a `Activity.metadata`). Claves según el tipo: vuelos
 * (`flight_number`, `airline`, `booking_reference`, aeropuertos) y hoteles (`hotel_name`,
 * `confirmation_number`, `check_in_time`, `check_out_time`).
 */
export interface ImportActivityMetadata {
  flight_number?: string
  airline?: string
  booking_reference?: string
  departure_airport?: ImportAirport
  arrival_airport?: ImportAirport
  hotel_name?: string
  confirmation_number?: string
  check_in_time?: string
  check_out_time?: string
  [key: string]: unknown
}

/** Fila de `draft.activities[]` (§3.5.8). Orden del servidor: por `scheduled_at`, sin fecha al final. */
export interface ImportActivityRow {
  /** `a…`; el check-out emparejado de un hotel lleva sufijo `o` (`a7o`). */
  client_id: string
  source_ref: ImportActivitySourceRef
  activity_type_code: string
  type_name: string
  /** `false` si la gira no tiene ese tipo vivo: `confirm` lo crea para el owner. */
  type_available: boolean
  title: string
  /** `YYYY-MM-DD` local o null (fila roja). */
  date: string | null
  /** Texto de fecha tal como venía ("Wed 3 Dec"). */
  date_text: string | null
  date_source: ImportActivityDateSource | null
  /** `HH:MM` local o null. */
  start_time: string | null
  end_time: string | null
  end_date: string | null
  all_day: boolean
  /** IANA. */
  timezone: string
  timezone_source: ImportTimezoneSource
  destination_timezone: string | null
  /** ISO UTC; null sin fecha u hora (salvo `all_day`). */
  scheduled_at: string | null
  end_at: string | null
  city: string | null
  city_key: string | null
  country: string | null
  location_name: string
  location_address: string
  destination_name: string
  destination_address: string
  metadata: ImportActivityMetadata
  notes: string
  priority: 'low' | 'normal' | 'high'
  /** Mismo valor en el check-in y el check-out de un hotel. */
  pair_id: string | null
  match: ImportActivityMatch
  /** `client_id` de la fila anterior repetida (`duplicate_in_draft`). */
  duplicate_of: string | null
  action: ImportActivityAction
  ai_confidence: number
  confidence: number
  issues: ImportActivityIssue[]
  needs_action: boolean
  reviewed: boolean
  edited: boolean
  /** Fecha local anterior a hoy: no tendrá recordatorios (informativo). */
  in_past: boolean
}

export interface ImportDraft {
  team: ImportTeamRow[]
  /** F2. Ausente o vacío en jobs de F1. */
  activities: ImportActivityRow[]
  warnings: ImportWarning[]
  assumptions: ImportAssumptions
}

/** `summary.activities` (F2 §3.11). */
export interface ImportActivitySummary {
  total: number
  to_create: number
  to_replace: number
  to_skip: number
  needs_action: number
  duplicates: number
  possible_duplicates: number
  outside_tour: number
  in_past: number
  by_type: Record<string, number>
  days: number
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
  /** F2. Ausente en jobs de F1. */
  activities?: ImportActivitySummary
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
  // F2 (§3.7.1). Opcionales: los jobs confirmados con F1 no los traen.
  activities_created?: number
  activities_replaced?: number
  activities_skipped?: number
  /** Ya creadas por un `confirm` anterior del mismo job (idempotencia). */
  already_created?: number
  /** Códigos de tipo creados para el owner al confirmar. */
  types_created?: string[]
  types_fallback?: number
  metadata_fixed?: number
  flights_to_enrich?: number
  activity_uuids?: string[]
  /** ISO UTC. */
  first_activity_at?: string | null
  tour_activated?: boolean
  notifications_paused?: boolean
  post_import?: ImportPostImport
}

/** Lo escribe `task_post_import` al terminar; el front sondea mientras sea `pending` (máx. 60 s). */
export interface ImportPostImport {
  status: 'pending' | 'done' | 'failed'
  reminders_created: number | null
  /** ISO UTC. */
  first_send_at: string | null
}

/**
 * D11: estimación de WhatsApp de la gira con las personas que entran al grupo (solo lectura, en el
 * detalle del job en `ready`). `remaining`/`plan_limit` son `null` sin cupo de suscripción.
 */
export interface ImportWhatsappEstimate {
  /** Pasos de WhatsApp futuros de la gira por persona (F2: también los de las actividades del borrador). */
  per_person: number
  /** F1: altas y vínculos nuevos con móvil válido. F2: personas del grupo por defecto con móvil + altas. */
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
  /** F2. Filas de `draft.activities` o, mientras procesa, suma de `detected.sources[]`. */
  activities_found?: number
  /** F2. Ausente en jobs de F1. */
  expected?: ImportExpected
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
  /** `team`/`activities`/`warnings`/`assumptions` pueden faltar mientras procesa o tras la purga. */
  draft: Partial<ImportDraft>
  team_group: ImportTeamGroup | null
  /** D11. `null` fuera de `ready` o si no aplica. Opcional hasta que lo despliegue el backend. */
  whatsapp_estimate?: ImportWhatsappEstimate | null
  result: ImportResult | Record<string, never>
  error_message: string
  purged_at: string | null
  documents: ImportJobDocument[]
}

/** Campos editables de una fila de equipo (`PATCH draft/`, §3.4.6). */
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

export type ImportTeamRowFields = ImportRowFields

/** `PATCH draft/` de una fila de equipo (`client_id` `t…`). */
export interface ImportTeamRowPatch {
  client_id: string
  action?: ImportRowAction
  link_contact_uuid?: string | null
  reviewed?: boolean
  fields?: Partial<ImportRowFields>
}

/** Campos editables de una fila de actividad (F2 §3.6). Horas `HH:MM`, fecha `YYYY-MM-DD`. */
export interface ImportActivityFields {
  activity_type_code: string
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  timezone: string
  location_name: string
  location_address: string
  destination_name: string
  destination_address: string
  flight_number: string
  booking_reference: string
  hotel_name: string
  confirmation_number: string
  notes: string
}

/** `PATCH draft/` de una fila de actividad (`client_id` `a…`). `replace` exige `match.activity_uuid`. */
export interface ImportActivityRowPatch {
  client_id: string
  action?: ImportActivityAction
  /** No aplica con `date=null` (400 `date_required`). */
  reviewed?: boolean
  fields?: Partial<ImportActivityFields>
}

export type ImportRowPatch = ImportTeamRowPatch | ImportActivityRowPatch

/** Supuestos editables (F2 §3.6). Cualquier cambio recalcula todas las filas sin IA ni red. */
export interface ImportAssumptionsPatch {
  default_region?: string
  year?: number
  date_order?: ImportDateOrder
  default_timezone?: string
  day_one_date?: string | null
  hotel_checkin_time?: string
  hotel_checkout_time?: string
  /** Solo claves existentes en `assumptions.cities` (si no, 400 `unknown_city`). */
  cities?: Record<string, string>
}

export interface ImportDraftPatch {
  rows?: ImportRowPatch[]
  assumptions?: ImportAssumptionsPatch
}

export interface CreateImportJobPayload {
  tourUuid: string
  files: File[]
  text?: string
  entryPoint: ImportEntryPoint
  /** Se manda solo si no es `any` (F2 §4.1). */
  expected?: ImportExpected
}

/** Cuerpo de `preview-notifications/` y de `confirm/` (F2 §3.7, §3.8). */
export interface ImportConfirmOptions {
  pause_notifications?: boolean
  activate_tour?: boolean
}

// ─── Vista previa de avisos (F2 §5) ──────────────────────────────────────────

export type ImportNotificationChannel = 'whatsapp' | 'email' | 'in_app'

export interface ImportPreviewGroup {
  uuid: string | null
  name: string
  is_tour_team: boolean
  is_default: boolean
}

export interface ImportPreviewRecipients {
  group: ImportPreviewGroup | null
  people: number
  people_from_import: number
  with_mobile: number
  with_email: number
  with_account: number
  /** Nombres de las personas sin móvil válido. */
  without_phone: string[]
  type_groups: { code: string; group_names: string[] }[]
}

export interface ImportPreviewReminderType {
  code: string
  name: string
  activities: number
  steps: { minutes: number; channel: ImportNotificationChannel }[]
  messages: Record<ImportNotificationChannel, number>
}

export interface ImportPreviewRule {
  uuid: string
  name: string
  trigger: string
  channel: ImportNotificationChannel
  /** `skipped_on_import` para las `activity_created`/`activity_updated`; otros valores según gnotif. */
  effect: string
  count: number
}

/** Respuesta de POST `{uuid}/preview-notifications/`. */
export interface ImportNotificationsPreview {
  recipients: ImportPreviewRecipients
  reminders_by_type: ImportPreviewReminderType[]
  rules: ImportPreviewRule[]
  show_day_alert: {
    enabled: boolean
    will_activate: boolean
    days: number
    channel: ImportNotificationChannel
  }
  totals: Record<ImportNotificationChannel, number>
  /** ISO UTC o null si no hay nada que enviar. */
  first_send_at: string | null
  quota: {
    remaining: number | null
    plan_limit: number | null
    exceeds: boolean
    overflow: number
  }
  paused: { current: boolean; after_confirm: boolean }
  tour_will_activate: boolean
  warnings: string[]
}

// ─── Funciones (sin estado) ──────────────────────────────────────────────────

const BASE = '/integrations/import-jobs/'

/**
 * POST multipart: `tour`, un `files` por archivo, `text`, `entry_point` y `expected` (solo si no es
 * `any`). Responde 202.
 */
export function createImportJob(p: CreateImportJobPayload): Promise<ImportJob> {
  const form = new FormData()
  form.append('tour', p.tourUuid)
  for (const f of p.files) form.append('files', f, f.name)
  const text = p.text?.trim()
  if (text) form.append('text', text)
  form.append('entry_point', p.entryPoint)
  if (p.expected && p.expected !== 'any') form.append('expected', p.expected)
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

/** Confirma el borrador. F2: `{pause_notifications, activate_tour}` (por defecto `{}`: el backend usa `false`/`true`). */
export function confirmImportJob(uuid: string, body: ImportConfirmOptions = {}): Promise<ImportJob> {
  return apiClient.post<ImportJob>(`${BASE}${uuid}/confirm/`, body)
}

/** Qué se va a enviar y a quién si se confirma (F2 §3.8). Sin escrituras. 409 `job_not_ready`. */
export function previewImportNotifications(
  uuid: string,
  body: ImportConfirmOptions = {}
): Promise<ImportNotificationsPreview> {
  return apiClient.post<ImportNotificationsPreview>(`${BASE}${uuid}/preview-notifications/`, body)
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
    confirmImportJob: (uuid: string, body?: ImportConfirmOptions) =>
      track(() => confirmImportJob(uuid, body)),
    previewImportNotifications: (uuid: string, body?: ImportConfirmOptions) =>
      track(() => previewImportNotifications(uuid, body)),
    discardImportJob: (uuid: string, opts?: { deleteDocuments?: boolean }) =>
      track(() => discardImportJob(uuid, opts)),
  }
}
