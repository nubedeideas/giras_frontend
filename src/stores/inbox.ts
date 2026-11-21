import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DateTime } from 'luxon'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import { useAuthStore } from '@/stores/auth'
import { inboxApi, type InboxItem } from '@/composables/useInbox'

export type InboxFilter = 'all' | 'unread'

function errorMessage(e: unknown, fallbackKey: string): string {
  return e instanceof Error && e.message ? e.message : i18n.global.t(fallbackKey)
}

function isoMillis(iso: string | null | undefined): number {
  if (!iso) return Number.NaN
  return DateTime.fromISO(iso).toMillis()
}

/**
 * Inbox personal (campana y panel). Las llamadas viven en `useInbox`; el polling del contador en
 * `useInboxPolling`. El store no conoce el router ni los timers.
 */
export const useInboxStore = defineStore('inbox', () => {
  const unreadCount = ref(0)
  const latestOccurredAt = ref<string | null>(null)
  const items = ref<InboxItem[]>([])
  const nextUrl = ref<string | null>(null)
  const filter = ref<InboxFilter>('all')
  const isOpen = ref(false)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)
  /** Error de "Cargar más": se pinta en línea bajo la lista, sin tapar lo ya cargado. */
  const loadMoreError = ref<string | null>(null)
  const actionError = ref<string | null>(null)
  const listLoadedAt = ref<string | null>(null)

  // Descarta respuestas de listados que ya no corresponden (cambio de filtro, reset).
  let listRequest = 0
  // Sube en `reset()` (logout): ninguna respuesta en vuelo del usuario anterior escribe estado.
  let epoch = 0

  const badgeLabel = computed(() => {
    if (unreadCount.value <= 0) return ''
    return unreadCount.value > 99 ? '99+' : String(unreadCount.value)
  })

  // ── Contador ──────────────────────────────────────────────────────────────

  /**
   * Actualiza contador y último `occurred_at`. Devuelve si ha llegado algo más reciente que lo
   * que ya se conocía (no basta con que cambie: descartar el primer ítem lo hace retroceder).
   * Lanza si falla.
   */
  async function fetchCount(): Promise<boolean> {
    const ep = epoch
    const res = await inboxApi.getUnreadCount()
    if (ep !== epoch) return false
    const prev = isoMillis(latestOccurredAt.value)
    const next = isoMillis(res.latest_occurred_at)
    const newer = !Number.isNaN(next) && (Number.isNaN(prev) || next > prev)
    unreadCount.value = res.unread
    latestOccurredAt.value = res.latest_occurred_at
    return newer
  }

  /** Lo llama el polling: lanza el error para que este aplique el backoff. */
  async function refreshCount(): Promise<void> {
    const newer = await fetchCount()
    if (newer && isOpen.value && !loading.value) await loadFirstPage()
  }

  /** Tras un fallo con el contador ya tocado por otro, se pide el valor real. */
  function resyncCount() {
    void fetchCount().catch(() => false)
  }

  // ── Listado ───────────────────────────────────────────────────────────────

  async function loadFirstPage(): Promise<void> {
    const req = ++listRequest
    loading.value = true
    error.value = null
    loadMoreError.value = null
    try {
      const page = await inboxApi.listInbox({
        unread: filter.value === 'unread' ? true : undefined,
      })
      if (req !== listRequest) return
      items.value = page.results ?? []
      nextUrl.value = page.next
      listLoadedAt.value = DateTime.utc().toISO()
    } catch (e) {
      if (req === listRequest) error.value = errorMessage(e, 'inbox.errors.load')
    } finally {
      if (req === listRequest) loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextUrl.value || loadingMore.value || loading.value) return
    const req = listRequest
    loadingMore.value = true
    loadMoreError.value = null
    try {
      const page = await inboxApi.listInboxPage(nextUrl.value)
      if (req !== listRequest) return
      // Un ítem nuevo desplaza la paginación: se evita duplicar los que ya están.
      const seen = new Set(items.value.map((i) => i.uuid))
      items.value = [...items.value, ...(page.results ?? []).filter((i) => !seen.has(i.uuid))]
      nextUrl.value = page.next
    } catch (e) {
      if (req === listRequest) loadMoreError.value = errorMessage(e, 'inbox.errors.load')
    } finally {
      if (req === listRequest) loadingMore.value = false
    }
  }

  async function setFilter(f: InboxFilter): Promise<void> {
    filter.value = f
    items.value = []
    nextUrl.value = null
    await loadFirstPage()
  }

  // ── Panel ─────────────────────────────────────────────────────────────────

  async function open(): Promise<void> {
    if (isOpen.value) return
    // Nada en modo demo: no hay sesión contra la API.
    if (useAuthStore().isDemoMode) return
    isOpen.value = true
    // `actionError` no se limpia aquí: un fallo de "marcar leído" al navegar desde una fila (con
    // el panel ya cerrado) tiene que verse al volver a abrirlo.
    await Promise.all([loadFirstPage(), fetchCount().catch(() => false)])
  }

  function close() {
    isOpen.value = false
    actionError.value = null
  }

  async function toggle(): Promise<void> {
    if (isOpen.value) close()
    else await open()
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  function findItem(uuid: string): InboxItem | undefined {
    return items.value.find((i) => i.uuid === uuid)
  }

  function replaceItem(updated: InboxItem) {
    const idx = items.value.findIndex((i) => i.uuid === updated.uuid)
    if (idx >= 0) items.value[idx] = updated
  }

  /**
   * Deshace la resta optimista del contador: vuelve al valor previo solo si nadie lo ha tocado
   * entretanto (un poll); si no, pide el real.
   */
  function revertCount(prev: number, optimistic: number) {
    if (unreadCount.value === optimistic) unreadCount.value = prev
    else resyncCount()
  }

  /** Optimista. Un ítem ya leído no se vuelve a pedir ni resta del contador. */
  async function markRead(item: InboxItem): Promise<void> {
    const ep = epoch
    actionError.value = null
    const target = findItem(item.uuid) ?? item
    if (target.is_read) return
    const prevReadAt = target.read_at
    const prevCount = unreadCount.value
    target.is_read = true
    target.read_at = DateTime.utc().toISO()
    unreadCount.value = Math.max(0, prevCount - 1)
    const optimistic = unreadCount.value
    try {
      const res = await inboxApi.markInboxRead(item.uuid)
      if (ep !== epoch) return
      if (res?.item) replaceItem(res.item)
      if (typeof res?.unread === 'number') unreadCount.value = res.unread
    } catch (e) {
      if (ep !== epoch) return
      const current = findItem(item.uuid) ?? target
      current.is_read = false
      current.read_at = prevReadAt
      revertCount(prevCount, optimistic)
      actionError.value = errorMessage(e, 'inbox.errors.action')
    }
  }

  /** Solo marca lo que había hasta el ítem más reciente del panel (no lo que llegó después). */
  async function markAllRead(): Promise<void> {
    const ep = epoch
    actionError.value = null
    const before = items.value[0]?.occurred_at ?? latestOccurredAt.value ?? undefined
    try {
      const res = await inboxApi.markAllInboxRead(before ? { before } : {})
      if (ep !== epoch) return
      const limit = isoMillis(before)
      const readAt = DateTime.utc().toISO()
      for (const i of items.value) {
        if (i.is_read) continue
        if (Number.isNaN(limit) || isoMillis(i.occurred_at) <= limit) {
          i.is_read = true
          i.read_at = readAt
        }
      }
      if (typeof res?.unread === 'number') unreadCount.value = res.unread
    } catch (e) {
      if (ep !== epoch) return
      actionError.value = errorMessage(e, 'inbox.errors.action')
    }
  }

  /** Optimista: lo quita de la lista y lo restaura si falla. */
  async function dismiss(item: InboxItem): Promise<void> {
    const ep = epoch
    actionError.value = null
    const idx = items.value.findIndex((i) => i.uuid === item.uuid)
    const removed = idx >= 0 ? items.value[idx] : item
    const wasUnread = !removed.is_read
    const prevCount = unreadCount.value
    if (idx >= 0) items.value.splice(idx, 1)
    if (wasUnread) unreadCount.value = Math.max(0, prevCount - 1)
    const optimistic = unreadCount.value

    const settle = () => {
      // Si era el más reciente, el último conocido retrocede con él; así el siguiente poll no lo
      // toma por un aviso nuevo ni recarga la primera página (se perdería "Cargar más").
      if (filter.value === 'all' && removed.occurred_at === latestOccurredAt.value) {
        latestOccurredAt.value = items.value[0]?.occurred_at ?? null
      }
    }

    try {
      await inboxApi.dismissInboxItem(item.uuid)
      if (ep !== epoch) return
      settle()
    } catch (e) {
      if (ep !== epoch) return
      // 404: ya estaba descartado (otra pestaña); el resultado es el mismo.
      if (e instanceof ApiError && e.status === 404) {
        settle()
        return
      }
      if (idx >= 0) items.value.splice(Math.min(idx, items.value.length), 0, removed)
      if (wasUnread) revertCount(prevCount, optimistic)
      actionError.value = errorMessage(e, 'inbox.errors.action')
    }
  }

  function reset() {
    listRequest++
    epoch++
    unreadCount.value = 0
    latestOccurredAt.value = null
    items.value = []
    nextUrl.value = null
    filter.value = 'all'
    isOpen.value = false
    loading.value = false
    loadingMore.value = false
    error.value = null
    loadMoreError.value = null
    actionError.value = null
    listLoadedAt.value = null
  }

  return {
    unreadCount,
    latestOccurredAt,
    items,
    nextUrl,
    filter,
    isOpen,
    loading,
    loadingMore,
    error,
    loadMoreError,
    actionError,
    listLoadedAt,
    badgeLabel,
    refreshCount,
    loadFirstPage,
    loadMore,
    setFilter,
    open,
    close,
    toggle,
    markRead,
    markAllRead,
    dismiss,
    reset,
  }
})
