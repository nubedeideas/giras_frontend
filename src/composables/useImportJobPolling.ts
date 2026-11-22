import { getCurrentInstance, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { ApiError } from '@/utils/apiClient'
import { getImportJob, IMPORT_PROCESSING_STATUSES, type ImportJob } from '@/composables/useImportJobs'

export const IMPORT_POLL_MS = 2_000
/** A partir de aquí se avisa de que tarda (`importer.progress.slow`), sin cortar. */
export const IMPORT_SLOW_MS = 3 * 60_000
/** Errores transitorios seguidos (red o 5xx) antes de rendirse. */
export const IMPORT_MAX_ERRORS = 3

export function isImportProcessing(job: Pick<ImportJob, 'status'> | null | undefined): boolean {
  return !!job && IMPORT_PROCESSING_STATUSES.includes(job.status)
}

function isTransient(e: unknown): boolean {
  return !(e instanceof ApiError) || e.status === 0 || e.status >= 500
}

/**
 * Sondea `GET /integrations/import-jobs/{uuid}/` cada 2 s mientras el job procesa y para en
 * `ready/done/failed/discarded`.
 *
 * - Arranca solo al cambiar `jobUuid` (y al montar si ya trae valor); `start()` relanza.
 * - Protección frente a respuestas atrasadas (`let request = 0`): al cambiar de uuid o parar,
 *   una respuesta en vuelo del uuid anterior se ignora.
 * - `slow` a los 3 min; 3 errores transitorios seguidos (o un 4xx) → `error` y para.
 * - `stop()` en `onBeforeUnmount` si se usa dentro de un componente.
 */
export function useImportJobPolling(jobUuid: Ref<string | null>) {
  const job = ref<ImportJob | null>(null)
  const error = ref<unknown>(null)
  const slow = ref(false)
  const polling = ref(false)

  let request = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let slowTimer: ReturnType<typeof setTimeout> | null = null
  let failures = 0

  function clearTimers() {
    if (timer !== null) clearTimeout(timer)
    if (slowTimer !== null) clearTimeout(slowTimer)
    timer = null
    slowTimer = null
  }

  function stop() {
    request++
    clearTimers()
    polling.value = false
  }

  async function tick(req: number) {
    timer = null
    const uuid = jobUuid.value
    if (!uuid || req !== request) return
    try {
      const data = await getImportJob(uuid)
      if (req !== request) return
      failures = 0
      job.value = data
      if (!isImportProcessing(data)) {
        stop()
        return
      }
    } catch (e) {
      if (req !== request) return
      failures++
      if (!isTransient(e) || failures >= IMPORT_MAX_ERRORS) {
        error.value = e
        stop()
        return
      }
    }
    timer = setTimeout(() => void tick(req), IMPORT_POLL_MS)
  }

  /** (Re)arranca el sondeo del uuid actual, con una petición inmediata. */
  function start() {
    stop()
    error.value = null
    slow.value = false
    failures = 0
    if (!jobUuid.value) return
    polling.value = true
    const req = request
    slowTimer = setTimeout(() => {
      if (req === request) slow.value = true
    }, IMPORT_SLOW_MS)
    void tick(req)
  }

  watch(
    jobUuid,
    (uuid, prev) => {
      if (uuid !== prev) job.value = null
      if (uuid) start()
      else stop()
    },
    { immediate: true }
  )

  if (getCurrentInstance()) onBeforeUnmount(stop)

  return { job, error, slow, polling, start, stop }
}
