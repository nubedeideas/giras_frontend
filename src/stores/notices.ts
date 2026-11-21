import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  useNotices,
  type Notice,
  type NoticeDetail,
  type NoticeStatus,
} from '@/composables/useNotices'

/** Tamaño del listado único: pendientes primero (orden del backend) y luego el historial. */
export const NOTICES_PAGE_SIZE = 50
/** Historial pedido aparte solo si los pendientes llenan la página. */
const EXTRA_HISTORY_LIMIT = 30
const CLOSED_STATUSES: NoticeStatus[] = ['sent', 'discarded', 'expired', 'superseded']

/**
 * Versión de un aviso del listado: `updated_at` si el backend lo manda; si no, los campos del
 * listado que cambian al editarlo o cerrarlo. Un detalle guardado con otra versión se invalida.
 */
export function noticeVersion(n: Notice): string {
  if (n.updated_at) return n.updated_at
  return [
    n.status,
    n.channel,
    n.template_slug ?? '',
    n.expires_at ?? '',
    n.title,
    n.message,
    JSON.stringify(n.text_overrides ?? {}),
    n.recipients_count,
  ].join('|')
}

/**
 * Avisos bajo demanda de la gira activa (R2): un único listado compartido por la pestaña
 * "Avisos" (lista y polling) y por el contador de `TourView`, y la caché de detalles por uuid,
 * que sobrevive a que el panel se desmonte. Las llamadas a la API las hace `useNotices`.
 */
export const useNoticesStore = defineStore('notices', () => {
  const api = useNotices()

  const tourUuid = ref<string | null>(null)
  const items = ref<Notice[]>([])
  const extraHistory = ref<Notice[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  /** Último error de carga (el componente lo traduce); `null` tras un éxito. */
  const error = ref<unknown>(null)
  const details = ref(new Map<string, NoticeDetail>())
  const detailVersions = new Map<string, string>()
  const inflight = new Map<string, Promise<NoticeDetail>>()

  let request = 0

  const pending = computed(() => items.value.filter((n) => n.status === 'pending'))
  const history = computed(() => {
    const own = items.value.filter((n) => n.status !== 'pending')
    const seen = new Set(own.map((n) => n.uuid))
    return [...own, ...extraHistory.value.filter((n) => !seen.has(n.uuid))]
  })
  /** `null` mientras no hay dato fiable (sin cargar o con error). */
  const pendingCount = computed(() =>
    loaded.value && !error.value ? pending.value.length : null
  )

  function reset(uuid: string | null) {
    request++
    tourUuid.value = uuid
    items.value = []
    extraHistory.value = []
    loaded.value = false
    loading.value = false
    error.value = null
    details.value = new Map()
    detailVersions.clear()
    inflight.clear()
  }

  function isLoadingOrLoaded(uuid: string): boolean {
    return tourUuid.value === uuid && (loaded.value || loading.value)
  }

  /** Detalles cuya versión del listado ha cambiado: se vuelven a pedir al necesitarlos. */
  function invalidateStale(list: Notice[]) {
    for (const n of list) {
      const v = detailVersions.get(n.uuid)
      if (v !== undefined && v !== noticeVersion(n)) {
        details.value.delete(n.uuid)
        detailVersions.delete(n.uuid)
      }
    }
  }

  /** Una petición por llamada (dos o más solo si hay 50 pendientes o más). */
  async function load(uuid: string, { quiet = false }: { quiet?: boolean } = {}): Promise<void> {
    if (tourUuid.value !== uuid) reset(uuid)
    const req = ++request
    loading.value = true
    try {
      const list = await api.list(uuid, { limit: NOTICES_PAGE_SIZE })
      if (req !== request) return
      let extra: Notice[] = []
      if (list.length >= NOTICES_PAGE_SIZE && list.every((n) => n.status === 'pending')) {
        // Una sola llamada: el filtro `status` admite varios valores separados por comas.
        const closed = await api
          .list(uuid, { status: CLOSED_STATUSES, limit: EXTRA_HISTORY_LIMIT })
          .catch(() => [] as Notice[])
        if (req !== request) return
        extra = closed
      }
      invalidateStale(list)
      items.value = list
      extraHistory.value = extra
      loaded.value = true
      error.value = null
    } catch (e) {
      if (req !== request) return
      // En recargas silenciosas, un fallo no borra lo que ya se ve (el componente decide).
      error.value = e
      if (!quiet) {
        items.value = []
        extraHistory.value = []
      }
      throw e
    } finally {
      if (req === request) loading.value = false
    }
  }

  function setDetail(d: NoticeDetail) {
    details.value.set(d.uuid, d)
    detailVersions.set(d.uuid, noticeVersion(d))
    const i = items.value.findIndex((n) => n.uuid === d.uuid)
    if (i >= 0) {
      const notice: Notice & Partial<Pick<NoticeDetail, 'selection' | 'preview'>> = { ...d }
      delete notice.selection
      delete notice.preview
      items.value[i] = notice
    }
  }

  /**
   * Detalle del aviso: el de la caché o, si no hay (o con `force`), una petición; las simultáneas
   * comparten la misma. Lanza el error para que la hoja lo enseñe.
   */
  function fetchDetail(uuid: string, { force = false }: { force?: boolean } = {}) {
    const cached = details.value.get(uuid)
    if (cached && !force) return Promise.resolve(cached)
    const running = inflight.get(uuid)
    if (running) return running
    const tour = tourUuid.value
    const p = api
      .get(uuid)
      .then((d) => {
        if (tourUuid.value === tour || tourUuid.value === null) setDetail(d)
        return d
      })
      .finally(() => inflight.delete(uuid))
    inflight.set(uuid, p)
    return p
  }

  /** Como `fetchDetail`, sin lanzar: `null` si falla (tarjetas). */
  function ensureDetail(uuid: string): Promise<NoticeDetail | null> {
    return fetchDetail(uuid).catch(() => null)
  }

  return {
    tourUuid,
    items,
    pending,
    history,
    pendingCount,
    loaded,
    loading,
    error,
    details,
    reset,
    isLoadingOrLoaded,
    load,
    setDetail,
    fetchDetail,
    ensureDetail,
  }
})
