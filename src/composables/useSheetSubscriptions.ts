import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'
import { apiClient, ApiError, buildQuery } from '@/utils/apiClient'
import {
  IMPORT_PROCESSING_STATUSES,
  type DateOrderSetting,
  type ImportJobStatus,
} from '@/composables/useImportJobs'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/integrations/sheet-subscriptions/ (spec 2026-11-23-importacion-f4-google-sheets.md,
// §3.8 y §5; `SheetSubscriptionSerializer` de `apps/integrations/serializers_sheets.py`). La API
// nunca devuelve el ID de la hoja suelto: solo `open_url`, y solo a quien la lee (`reader.is_me`).
// El front solo envía el `spreadsheet_id` que devuelve el selector de Google (no se pega ningún
// enlace). Errores de negocio con el envoltorio de `ImportJobError` (`details.code`, más
// `details.field`, `details.subscription_uuid` o `details.retry_after_seconds`); la falta del
// permiso de Google, con el 403 plano `google_scope_missing` (`purpose: "sheets"`).

/** `last_status` de la vinculación (los mismos que iCal). */
export type SheetSyncStatus =
  | 'pending'
  | 'ok'
  | 'not_modified'
  | 'error'
  | 'paused'
  | 'tour_closed'
  | 'tour_ended'

/** `last_error_code` (§3.4.2). */
export type SheetErrorCode =
  | 'google_access_lost'
  | 'google_disconnected'
  | 'reader_not_admin'
  | 'no_access'
  | 'sheet_not_found'
  | 'tab_missing'
  | 'google_unavailable'
  | 'sync_failed'

/** Pestaña vinculada (`tabs[]` del serializer). */
export interface SheetTab {
  /** `sheetId` de la pestaña (estable al renombrarla). */
  gid: number
  /** `""` hasta la primera lectura. */
  title: string
  /** `""` = toda la pestaña; si no, `A3:H200`. */
  range: string
  doc_kind: string | null
  /** La pestaña ya no existe en la hoja. */
  missing: boolean
  rows: number
}

export interface SheetSubscriptionStats {
  rows_seen?: number
  last_new?: number
  last_changed?: number
  last_removed?: number
  /** Desaparecieron muchas filas de golpe: no se proponen cancelaciones. */
  removal_guard?: boolean
  pending_review?: boolean
  tabs_missing?: number
}

/** `pending_job`: el último job de la lectura mientras esté entre `uploaded` y `ready`. */
export interface SheetSubscriptionPendingJob {
  uuid: string
  status: ImportJobStatus
  created_at: string
  new: number
  changed: number
  removed: number
}

/** Quién lee la hoja (con su token de Google). */
export interface SheetReader {
  /** `null` si quien vinculó la hoja ya no existe (`{name: null, is_me: false, has_access: false}`). */
  name: string | null
  is_me: boolean
  /** Vivo, admin de la gira y con el permiso `sheets` (sin llamar a Google). */
  has_access: boolean
}

export interface SheetSubscription {
  uuid: string
  provider: 'gsheet'
  /** uuid de la gira. */
  tour: string
  tour_name: string
  /** Si el usuario no puso nombre, el backend devuelve `spreadsheet_title`; puede ser `""`. */
  name: string
  spreadsheet_title: string
  tabs: SheetTab[]
  /** Solo si `reader.is_me`; si no, `null`. */
  open_url: string | null
  /** El backend siempre manda el objeto; con el lector borrado, `reader.name` es `null`. */
  reader: SheetReader | null
  sync_enabled: boolean
  last_status: SheetSyncStatus
  /** `""` sin error. */
  last_error_code: SheetErrorCode | ''
  error_count: number
  /** ISO UTC. */
  last_attempt_at: string | null
  last_synced_at: string | null
  next_sync_at: string | null
  stats: SheetSubscriptionStats
  pending_job: SheetSubscriptionPendingJob | null
  created_at: string
  /**
   * F5a: orden de las fechas ambiguas de esta hoja (`auto` = el de la gira o el deducido).
   * Opcional hasta que lo despliegue el backend.
   */
  date_order?: DateOrderSetting
}

/** Pestaña de la respuesta de `inspect`. */
export interface SheetInspectTab {
  gid: number
  title: string
  index: number
  hidden: boolean
  rows: number
  columns: number
}

/** 200 de `POST inspect/`. */
export interface SheetInspectResult {
  spreadsheet_title: string
  /** uuid de la vinculación viva de esta hoja en la gira, o `null`. */
  already_subscribed: string | null
  tabs: SheetInspectTab[]
}

export interface InspectSheetPayload {
  /** uuid de la gira. */
  tour: string
  /** `id` del documento elegido en el selector de Google. */
  spreadsheet_id: string
}

/** Pestaña pedida al crear o editar (1..5, `gid` únicos). */
export interface SheetTabInput {
  gid: number
  /** Vacío = toda la pestaña. */
  range?: string
}

export interface CreateSheetSubscriptionPayload {
  tour: string
  spreadsheet_id: string
  tabs: SheetTabInput[]
  /** ≤ 120 caracteres. */
  name?: string
}

export interface UpdateSheetSubscriptionPayload {
  name?: string
  sync_enabled?: boolean
  tabs?: SheetTabInput[]
  /** F5a: 400 `invalid_value` fuera de `auto|dmy|mdy`. */
  date_order?: DateOrderSetting
}

export interface SheetSyncResponse {
  status: 'queued'
}

/** Tope de pestañas por vinculación (`SHEETS_MAX_TABS`). */
export const SHEETS_MAX_TABS = 5

// ─── Funciones (sin estado) ──────────────────────────────────────────────────

const BASE = '/integrations/sheet-subscriptions/'

/** Pestañas tal como las espera la API: rango recortado y en mayúsculas, sin `range` vacío. */
function tabsBody(tabs: SheetTabInput[]): SheetTabInput[] {
  return tabs.map((tab) => {
    const range = (tab.range ?? '').trim().toUpperCase()
    return range ? { gid: tab.gid, range } : { gid: tab.gid }
  })
}

/** Lee los metadatos de la hoja elegida (Google dentro de la petición). No escribe nada. */
export function inspectSheet(p: InspectSheetPayload): Promise<SheetInspectResult> {
  return apiClient.post<SheetInspectResult>(`${BASE}inspect/`, {
    tour: p.tour,
    spreadsheet_id: p.spreadsheet_id,
  })
}

/** Vinculaciones de una gira o, sin gira, las de todas las giras donde el usuario es admin. */
export function listSheetSubscriptions(tourUuid?: string): Promise<SheetSubscription[]> {
  const q = buildQuery({ tour: tourUuid })
  return apiClient.getAll<SheetSubscription>(q ? `${BASE}?${q}` : BASE)
}

export function getSheetSubscription(uuid: string): Promise<SheetSubscription> {
  return apiClient.get<SheetSubscription>(`${BASE}${uuid}/`)
}

/** 201 con `last_status="pending"`; la primera lectura la encola el backend. */
export function createSheetSubscription(
  p: CreateSheetSubscriptionPayload
): Promise<SheetSubscription> {
  const body: Record<string, unknown> = {
    tour: p.tour,
    spreadsheet_id: p.spreadsheet_id,
    tabs: tabsBody(p.tabs),
  }
  const name = p.name?.trim()
  if (name) body.name = name
  return apiClient.post<SheetSubscription>(BASE, body)
}

export function updateSheetSubscription(
  uuid: string,
  body: UpdateSheetSubscriptionPayload
): Promise<SheetSubscription> {
  const payload: Record<string, unknown> = { ...body }
  if (body.tabs) payload.tabs = tabsBody(body.tabs)
  return apiClient.patch<SheetSubscription>(`${BASE}${uuid}/`, payload)
}

/** 204: borrado lógico; el job abierto y las actividades importadas se quedan. */
export function deleteSheetSubscription(uuid: string): Promise<void> {
  return apiClient.delete<void>(`${BASE}${uuid}/`)
}

/** 202 `{status: "queued"}`. 429 `sync_too_soon` con `details.retry_after_seconds`. */
export function syncSheetSubscription(
  uuid: string,
  opts: { full?: boolean } = {}
): Promise<SheetSyncResponse> {
  return apiClient.post<SheetSyncResponse>(`${BASE}${uuid}/sync/`, opts.full ? { full: true } : {})
}

/**
 * "Usar mi cuenta" / "Volver a elegir la hoja": quien pulsa pasa a leer la hoja. Exige la misma
 * hoja elegida en su selector (400 `spreadsheet_mismatch` si no).
 */
export function useMyAccount(
  uuid: string,
  body: { spreadsheet_id: string }
): Promise<SheetSubscription> {
  return apiClient.post<SheetSubscription>(`${BASE}${uuid}/use-my-account/`, {
    spreadsheet_id: body.spreadsheet_id,
  })
}

/** La lectura (o el job que ha creado) sigue en marcha. */
export function isSheetSyncInProgress(
  sub: Pick<SheetSubscription, 'last_status' | 'pending_job'>
): boolean {
  if (sub.last_status === 'pending') return true
  const job = sub.pending_job
  return !!job && IMPORT_PROCESSING_STATUSES.includes(job.status)
}

// ─── Composable ───────────────────────────────────────────────────────────────

export interface SheetPollOptions {
  intervalMs?: number
  timeoutMs?: number
  /** Cada lectura correcta mientras dura el sondeo (para pintar el estado intermedio). */
  onRead?: (sub: SheetSubscription) => void
}

export interface SheetPollResult {
  /** Último estado leído (null si se canceló antes de la primera lectura). */
  sub: SheetSubscription | null
  /** Se agotó `timeoutMs` con la lectura aún en marcha. */
  timedOut: boolean
  /** Se canceló (`stop()` o desmontaje del componente). */
  cancelled: boolean
}

/**
 * `loading`/`error` para las vistas y `pollUntilSynced`, que sondea el detalle mientras la lectura
 * o su job sigan en marcha (cada 3 s, máx. 90 s). Se cancela al desmontar el componente que lo usa
 * o con `stop()`. Las funciones relanzan el `ApiError`: el llamador lo traduce con
 * `sheetApiErrorKey` (`utils/sheetSubscriptions.ts`).
 */
export function useSheetSubscriptions() {
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

  let pollToken = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let wake: (() => void) | null = null

  function stop() {
    pollToken++
    if (timer) clearTimeout(timer)
    timer = null
    wake?.()
    wake = null
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      wake = resolve
      timer = setTimeout(() => {
        timer = null
        wake = null
        resolve()
      }, ms)
    })
  }

  async function pollUntilSynced(uuid: string, opts: SheetPollOptions = {}): Promise<SheetPollResult> {
    const intervalMs = opts.intervalMs ?? 3000
    const timeoutMs = opts.timeoutMs ?? 90000
    stop()
    const token = ++pollToken
    const started = Date.now()
    let sub: SheetSubscription | null = null
    for (;;) {
      let fresh = false
      try {
        sub = await getSheetSubscription(uuid)
        fresh = true
      } catch (e) {
        // Fallos de red o del servidor: se reintenta hasta el plazo. Un 4xx no se arregla solo.
        if (token !== pollToken) return { sub, timedOut: false, cancelled: true }
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e
      }
      if (token !== pollToken) return { sub, timedOut: false, cancelled: true }
      if (fresh && sub) opts.onRead?.(sub)
      if (sub && !isSheetSyncInProgress(sub)) return { sub, timedOut: false, cancelled: false }
      if (Date.now() - started + intervalMs > timeoutMs) {
        return { sub, timedOut: true, cancelled: false }
      }
      await wait(intervalMs)
      if (token !== pollToken) return { sub, timedOut: false, cancelled: true }
    }
  }

  if (getCurrentInstance()) onBeforeUnmount(stop)

  return {
    loading,
    error,
    inspectSheet: (p: InspectSheetPayload) => track(() => inspectSheet(p)),
    listSheetSubscriptions: (tourUuid?: string) => track(() => listSheetSubscriptions(tourUuid)),
    getSheetSubscription: (uuid: string) => track(() => getSheetSubscription(uuid)),
    createSheetSubscription: (p: CreateSheetSubscriptionPayload) =>
      track(() => createSheetSubscription(p)),
    updateSheetSubscription: (uuid: string, body: UpdateSheetSubscriptionPayload) =>
      track(() => updateSheetSubscription(uuid, body)),
    deleteSheetSubscription: (uuid: string) => track(() => deleteSheetSubscription(uuid)),
    syncSheetSubscription: (uuid: string, opts?: { full?: boolean }) =>
      track(() => syncSheetSubscription(uuid, opts)),
    useMyAccount: (uuid: string, body: { spreadsheet_id: string }) =>
      track(() => useMyAccount(uuid, body)),
    pollUntilSynced,
    stop,
  }
}
