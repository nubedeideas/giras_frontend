import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'
import { apiClient, ApiError, buildQuery } from '@/utils/apiClient'
import { IMPORT_PROCESSING_STATUSES, type ImportJobStatus } from '@/composables/useImportJobs'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/integrations/ical-subscriptions/ (spec 2026-11-23-importacion-f3-ics-ical.md,
// §3.9 y §5; `IcalSubscriptionSerializer` de `apps/integrations/serializers_ical.py`). La API nunca
// devuelve la URL del calendario: solo `url_display` (`host/…/últimos 4`). Errores de negocio con
// el envoltorio de `ImportJobError` (`details.code`, más `details.reason`, `details.subscription_uuid`
// o `details.retry_after_seconds` según el error).

/** `last_status` de la suscripción. */
export type IcalSyncStatus =
  | 'pending'
  | 'ok'
  | 'not_modified'
  | 'error'
  | 'paused'
  | 'tour_closed'
  | 'tour_ended'

/**
 * `last_error_code` (§3.8.1). Cualquier 5xx llega con el literal `http_5xx`
 * (`ical_fetch._http_error_code`); el resto de 4xx, como `http_<código>`.
 */
export type IcalErrorCode =
  | 'invalid_url'
  | 'https_required'
  | 'credentials_in_url'
  | 'port_not_allowed'
  | 'host_not_allowed'
  | 'dns_failed'
  | 'connection_failed'
  | 'tls_error'
  | 'timeout'
  | 'too_many_redirects'
  | 'http_401'
  | 'http_403'
  | 'http_404'
  | 'http_410'
  | 'http_5xx'
  | 'sync_failed'
  | 'url_unreadable'
  | `http_${number}`
  | 'too_large'
  | 'ics_too_large'
  | 'not_ics'
  | 'ics_unreadable'
  // F5a (§3.5): quien añadió el calendario ya no es admin de la gira (o no existe): pausada.
  | 'owner_not_admin'

/** `details.reason` del 400 `invalid_url` al crear (validación sin red de `normalize_ical_url`). */
export type IcalUrlReason =
  | 'invalid_url'
  | 'https_required'
  | 'credentials_in_url'
  | 'port_not_allowed'
  | 'host_not_allowed'

export interface IcalSubscriptionStats {
  events_in_window?: number
  last_new?: number
  last_changed?: number
  last_cancelled?: number
  /** El feed perdió de golpe más de la mitad de sus eventos: no se proponen cancelaciones. */
  removal_guard?: boolean
  pending_review?: boolean
}

/** `pending_job`: el último job de la sincronización mientras esté entre `uploaded` y `ready`. */
export interface IcalSubscriptionPendingJob {
  uuid: string
  status: ImportJobStatus
  created_at: string
  new: number
  changed: number
  cancelled: number
}

export interface IcalSubscription {
  uuid: string
  provider: 'ical'
  /** uuid de la gira. */
  tour: string
  tour_name: string
  /** `X-WR-CALNAME` tras la primera sincronización si el usuario no puso nombre; puede ser `""`. */
  name: string
  url_display: string
  sync_enabled: boolean
  last_status: IcalSyncStatus
  /** `""` sin error. */
  last_error_code: IcalErrorCode | ''
  error_count: number
  /** ISO UTC. */
  last_attempt_at: string | null
  /** ISO UTC de la última descarga correcta. */
  last_synced_at: string | null
  next_sync_at: string | null
  stats: IcalSubscriptionStats
  pending_job: IcalSubscriptionPendingJob | null
  created_by_name: string | null
  created_at: string
  /** F5a: quien añadió el calendario. Opcional hasta que lo despliegue el backend. */
  owner?: IcalSubscriptionOwner
}

/** F5a: `owner` del serializer (quien sincroniza el calendario). */
export interface IcalSubscriptionOwner {
  /** `null` si la cuenta ya no existe. */
  name: string | null
  is_me: boolean
  is_admin: boolean
}

export interface CreateIcalSubscriptionPayload {
  /** uuid de la gira. */
  tour: string
  url: string
  /** ≤ 120 caracteres. */
  name?: string
}

export interface UpdateIcalSubscriptionPayload {
  name?: string
  sync_enabled?: boolean
}

export interface IcalSyncResponse {
  status: 'queued'
}

// ─── Funciones (sin estado) ──────────────────────────────────────────────────

const BASE = '/integrations/ical-subscriptions/'

/** Suscripciones de una gira o, sin gira, las de todas las giras donde el usuario es admin. */
export function listIcalSubscriptions(tourUuid?: string): Promise<IcalSubscription[]> {
  const q = buildQuery({ tour: tourUuid })
  return apiClient.getAll<IcalSubscription>(q ? `${BASE}?${q}` : BASE)
}

export function getIcalSubscription(uuid: string): Promise<IcalSubscription> {
  return apiClient.get<IcalSubscription>(`${BASE}${uuid}/`)
}

/** 201 con `last_status="pending"`; la primera sincronización la encola el backend. */
export function createIcalSubscription(p: CreateIcalSubscriptionPayload): Promise<IcalSubscription> {
  const body: Record<string, string> = { tour: p.tour, url: p.url.trim() }
  const name = p.name?.trim()
  if (name) body.name = name
  return apiClient.post<IcalSubscription>(BASE, body)
}

export function updateIcalSubscription(
  uuid: string,
  body: UpdateIcalSubscriptionPayload
): Promise<IcalSubscription> {
  return apiClient.patch<IcalSubscription>(`${BASE}${uuid}/`, body)
}

/** 204: borrado lógico; el job abierto y las actividades importadas se quedan. */
export function deleteIcalSubscription(uuid: string): Promise<void> {
  return apiClient.delete<void>(`${BASE}${uuid}/`)
}

/** 202 `{status: "queued"}`. 429 `sync_too_soon` con `details.retry_after_seconds`. */
export function syncIcalSubscription(
  uuid: string,
  opts: { full?: boolean } = {}
): Promise<IcalSyncResponse> {
  return apiClient.post<IcalSyncResponse>(`${BASE}${uuid}/sync/`, opts.full ? { full: true } : {})
}

/**
 * F5a "Hacerme responsable": quien pulsa (admin de la gira) pasa a ser el dueño, se reanuda y se
 * encola una sincronización. 200 con la suscripción (`owner.is_me=true`); 403/404 como el resto.
 */
export function takeOverIcalSubscription(uuid: string): Promise<IcalSubscription> {
  return apiClient.post<IcalSubscription>(`${BASE}${uuid}/take-over/`, {})
}

/** La sincronización (o el job que ha creado) sigue en marcha. */
export function isIcalSyncInProgress(sub: Pick<IcalSubscription, 'last_status' | 'pending_job'>): boolean {
  if (sub.last_status === 'pending') return true
  const job = sub.pending_job
  return !!job && IMPORT_PROCESSING_STATUSES.includes(job.status)
}

// ─── Composable ───────────────────────────────────────────────────────────────

export interface PollOptions {
  intervalMs?: number
  timeoutMs?: number
  /** Cada lectura correcta mientras dura el sondeo (para pintar el estado intermedio). */
  onRead?: (sub: IcalSubscription) => void
}

export interface PollResult {
  /** Último estado leído (null si se canceló antes de la primera lectura). */
  sub: IcalSubscription | null
  /** Se agotó `timeoutMs` con la sincronización aún en marcha. */
  timedOut: boolean
  /** Se canceló (`stop()` o desmontaje del componente). */
  cancelled: boolean
}

/**
 * `loading`/`error` para las vistas y `pollUntilSynced`, que sondea el detalle mientras la
 * sincronización o su job sigan en marcha (cada 3 s, máx. 60 s). Se cancela al desmontar el
 * componente que lo usa o con `stop()`. Las funciones relanzan el `ApiError`: el llamador lo
 * traduce con `icalApiErrorKey` (`utils/icalSubscriptions.ts`).
 */
export function useIcalSubscriptions() {
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

  async function pollUntilSynced(uuid: string, opts: PollOptions = {}): Promise<PollResult> {
    const intervalMs = opts.intervalMs ?? 3000
    const timeoutMs = opts.timeoutMs ?? 60000
    stop()
    const token = ++pollToken
    const started = Date.now()
    let sub: IcalSubscription | null = null
    for (;;) {
      let fresh = false
      try {
        sub = await getIcalSubscription(uuid)
        fresh = true
      } catch (e) {
        // Fallos de red o del servidor: se reintenta hasta el plazo. Un 4xx no se arregla solo.
        if (token !== pollToken) return { sub, timedOut: false, cancelled: true }
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e
      }
      if (token !== pollToken) return { sub, timedOut: false, cancelled: true }
      if (fresh && sub) opts.onRead?.(sub)
      if (sub && !isIcalSyncInProgress(sub)) return { sub, timedOut: false, cancelled: false }
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
    listIcalSubscriptions: (tourUuid?: string) => track(() => listIcalSubscriptions(tourUuid)),
    getIcalSubscription: (uuid: string) => track(() => getIcalSubscription(uuid)),
    createIcalSubscription: (p: CreateIcalSubscriptionPayload) =>
      track(() => createIcalSubscription(p)),
    updateIcalSubscription: (uuid: string, body: UpdateIcalSubscriptionPayload) =>
      track(() => updateIcalSubscription(uuid, body)),
    deleteIcalSubscription: (uuid: string) => track(() => deleteIcalSubscription(uuid)),
    syncIcalSubscription: (uuid: string, opts?: { full?: boolean }) =>
      track(() => syncIcalSubscription(uuid, opts)),
    takeOverIcalSubscription: (uuid: string) => track(() => takeOverIcalSubscription(uuid)),
    pollUntilSynced,
    stop,
  }
}
