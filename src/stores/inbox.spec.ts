import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import { inboxApi } from '@/composables/useInbox'
import { inboxItem } from '@/test/inbox'
import { useInboxStore } from './inbox'

function page(results = [inboxItem()], next: string | null = null) {
  return { count: results.length, next, previous: null, results }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

describe('useInboxStore', () => {
  it('refreshCount updates count and latest', async () => {
    vi.spyOn(inboxApi, 'getUnreadCount').mockResolvedValue({
      unread: 4,
      latest_occurred_at: '2026-11-21T10:00:00Z',
    })
    const list = vi.spyOn(inboxApi, 'listInbox')
    const inbox = useInboxStore()
    await inbox.refreshCount()
    expect(inbox.unreadCount).toBe(4)
    expect(inbox.latestOccurredAt).toBe('2026-11-21T10:00:00Z')
    // Panel cerrado: no se carga la lista.
    expect(list).not.toHaveBeenCalled()
  })

  it('refreshCount reloads first page when open and latest changed', async () => {
    const count = vi
      .spyOn(inboxApi, 'getUnreadCount')
      .mockResolvedValueOnce({ unread: 1, latest_occurred_at: '2026-11-21T10:00:00Z' })
      .mockResolvedValueOnce({ unread: 1, latest_occurred_at: '2026-11-21T10:00:00Z' })
      .mockResolvedValueOnce({ unread: 2, latest_occurred_at: '2026-11-21T11:00:00Z' })
    const list = vi
      .spyOn(inboxApi, 'listInbox')
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(page([inboxItem({ uuid: 'i2' }), inboxItem()]))
    const inbox = useInboxStore()
    await inbox.open()
    expect(list).toHaveBeenCalledTimes(1)

    await inbox.refreshCount() // sin cambios
    expect(list).toHaveBeenCalledTimes(1)

    await inbox.refreshCount() // llega uno nuevo
    expect(list).toHaveBeenCalledTimes(2)
    expect(inbox.items.map((i) => i.uuid)).toEqual(['i2', 'i1'])
    expect(count).toHaveBeenCalledTimes(3)
  })

  it('markRead is optimistic and rolls back on error', async () => {
    let reject: (e: unknown) => void = () => {}
    vi.spyOn(inboxApi, 'markInboxRead').mockReturnValue(
      new Promise((_, r) => {
        reject = r
      })
    )
    const inbox = useInboxStore()
    inbox.items = [inboxItem()]
    inbox.unreadCount = 3
    const pending = inbox.markRead(inbox.items[0])
    expect(inbox.items[0].is_read).toBe(true)
    expect(inbox.unreadCount).toBe(2)

    reject(new ApiError(500, null, { fallback: 'No se ha podido completar la acción.' }))
    await pending
    expect(inbox.items[0].is_read).toBe(false)
    expect(inbox.items[0].read_at).toBeNull()
    expect(inbox.unreadCount).toBe(3)
    expect(inbox.actionError).toBe('No se ha podido completar la acción.')
  })

  it('markRead rollback resyncs the count if a poll changed it meanwhile', async () => {
    let reject: (e: unknown) => void = () => {}
    vi.spyOn(inboxApi, 'markInboxRead').mockReturnValue(
      new Promise((_, r) => {
        reject = r
      })
    )
    const count = vi
      .spyOn(inboxApi, 'getUnreadCount')
      .mockResolvedValue({ unread: 5, latest_occurred_at: '2026-11-21T10:00:00Z' })
    const inbox = useInboxStore()
    inbox.items = [inboxItem()]
    inbox.unreadCount = 0 // el optimismo no puede bajar de 0
    const pending = inbox.markRead(inbox.items[0])
    expect(inbox.unreadCount).toBe(0)
    inbox.unreadCount = 4 // llega un poll entre medias
    reject(new ApiError(500, null))
    await pending
    await flushPromises()
    expect(count).toHaveBeenCalledTimes(1)
    expect(inbox.unreadCount).toBe(5)
    expect(inbox.items[0].is_read).toBe(false)
  })

  it('markRead rollback does not invent an unread when the count was already 0', async () => {
    vi.spyOn(inboxApi, 'markInboxRead').mockRejectedValue(new ApiError(500, null))
    const inbox = useInboxStore()
    inbox.items = [inboxItem()]
    inbox.unreadCount = 0
    await inbox.markRead(inbox.items[0])
    expect(inbox.unreadCount).toBe(0)
  })

  it('markRead uses unread from the response', async () => {
    vi.spyOn(inboxApi, 'markInboxRead').mockResolvedValue({
      item: inboxItem({ is_read: true, read_at: '2026-11-21T10:05:00Z' }),
      unread: 7,
    })
    const inbox = useInboxStore()
    inbox.items = [inboxItem()]
    inbox.unreadCount = 3
    await inbox.markRead(inbox.items[0])
    expect(inbox.unreadCount).toBe(7)
    expect(inbox.items[0].read_at).toBe('2026-11-21T10:05:00Z')
  })

  it('markRead does not decrement an already read item', async () => {
    const api = vi.spyOn(inboxApi, 'markInboxRead')
    const inbox = useInboxStore()
    inbox.items = [inboxItem({ is_read: true, read_at: '2026-11-21T10:01:00Z' })]
    inbox.unreadCount = 2
    await inbox.markRead(inbox.items[0])
    expect(inbox.unreadCount).toBe(2)
    expect(api).not.toHaveBeenCalled()
  })

  it('markAllRead sends before of first item and applies unread', async () => {
    const api = vi.spyOn(inboxApi, 'markAllInboxRead').mockResolvedValue({ updated: 2, unread: 1 })
    const inbox = useInboxStore()
    inbox.items = [
      inboxItem({ uuid: 'a', occurred_at: '2026-11-21T12:00:00Z' }),
      inboxItem({ uuid: 'b', occurred_at: '2026-11-21T09:00:00Z' }),
    ]
    inbox.latestOccurredAt = '2026-11-21T13:00:00Z'
    inbox.unreadCount = 3
    await inbox.markAllRead()
    expect(api).toHaveBeenCalledWith({ before: '2026-11-21T12:00:00Z' })
    expect(inbox.unreadCount).toBe(1)
    expect(inbox.items.every((i) => i.is_read)).toBe(true)

    // Sin ítems cargados se usa el último del contador.
    inbox.items = []
    await inbox.markAllRead()
    expect(api).toHaveBeenLastCalledWith({ before: '2026-11-21T13:00:00Z' })
  })

  it('dismiss removes item and restores on error', async () => {
    const api = vi
      .spyOn(inboxApi, 'dismissInboxItem')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError(500, null))
      .mockRejectedValueOnce(new ApiError(404, null))
    const inbox = useInboxStore()
    inbox.items = [
      inboxItem({ uuid: 'a' }),
      inboxItem({ uuid: 'b', is_read: true }),
      inboxItem({ uuid: 'c' }),
    ]
    inbox.unreadCount = 2

    await inbox.dismiss(inbox.items[0])
    expect(inbox.items.map((i) => i.uuid)).toEqual(['b', 'c'])
    expect(inbox.unreadCount).toBe(1)

    await inbox.dismiss(inbox.items[1])
    expect(inbox.items.map((i) => i.uuid)).toEqual(['b', 'c'])
    expect(inbox.unreadCount).toBe(1)
    expect(inbox.actionError).toBeTruthy()

    // 404: ya estaba descartado en otra pestaña; no vuelve.
    await inbox.dismiss(inbox.items[0])
    expect(inbox.items.map((i) => i.uuid)).toEqual(['c'])
    expect(inbox.unreadCount).toBe(1)
    expect(inbox.actionError).toBeNull()
    expect(api).toHaveBeenCalledTimes(3)
  })

  it('dismissing the newest item does not reload the first page on the next poll', async () => {
    const next = 'http://api.test/api/notifications/inbox/?page=2&page_size=20'
    const a = inboxItem({ uuid: 'a', occurred_at: '2026-11-21T12:00:00Z' })
    const b = inboxItem({ uuid: 'b', occurred_at: '2026-11-21T11:00:00Z' })
    const c = inboxItem({ uuid: 'c', occurred_at: '2026-11-21T09:00:00Z' })
    const list = vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([a, b], next))
    vi.spyOn(inboxApi, 'listInboxPage').mockResolvedValue(page([c], null))
    vi.spyOn(inboxApi, 'dismissInboxItem').mockResolvedValue(undefined)
    const count = vi
      .spyOn(inboxApi, 'getUnreadCount')
      .mockResolvedValueOnce({ unread: 3, latest_occurred_at: a.occurred_at })
      .mockResolvedValue({ unread: 2, latest_occurred_at: b.occurred_at })
    const inbox = useInboxStore()
    await inbox.open()
    await inbox.loadMore()
    expect(inbox.items.map((i) => i.uuid)).toEqual(['a', 'b', 'c'])

    await inbox.dismiss(inbox.items[0])
    expect(inbox.latestOccurredAt).toBe(b.occurred_at)
    await inbox.refreshCount()
    expect(count).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenCalledTimes(1)
    expect(inbox.items.map((i) => i.uuid)).toEqual(['b', 'c'])
  })

  it('responses that arrive after reset do not write state', async () => {
    let resolveCount: (v: { unread: number; latest_occurred_at: string | null }) => void = () => {}
    vi.spyOn(inboxApi, 'getUnreadCount').mockReturnValue(
      new Promise((r) => {
        resolveCount = r
      })
    )
    let resolveAll: (v: { updated: number; unread: number }) => void = () => {}
    vi.spyOn(inboxApi, 'markAllInboxRead').mockReturnValue(
      new Promise((r) => {
        resolveAll = r
      })
    )
    const inbox = useInboxStore()
    inbox.items = [inboxItem()]
    inbox.unreadCount = 2
    const polling = inbox.refreshCount()
    const all = inbox.markAllRead()
    inbox.reset()
    resolveCount({ unread: 9, latest_occurred_at: '2026-11-21T10:00:00Z' })
    resolveAll({ updated: 1, unread: 7 })
    await polling
    await all
    expect(inbox.unreadCount).toBe(0)
    expect(inbox.latestOccurredAt).toBeNull()
  })

  it('open keeps the action error and close clears it', async () => {
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([]))
    vi.spyOn(inboxApi, 'getUnreadCount').mockResolvedValue({ unread: 0, latest_occurred_at: null })
    const inbox = useInboxStore()
    inbox.actionError = 'No se ha podido completar la acción.'
    await inbox.open()
    expect(inbox.actionError).toBe('No se ha podido completar la acción.')
    inbox.close()
    expect(inbox.actionError).toBeNull()
  })

  it('loadMore appends and clears nextUrl', async () => {
    const next = 'http://api.test/api/notifications/inbox/?page=2&page_size=20'
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([inboxItem({ uuid: 'a' })], next))
    const more = vi
      .spyOn(inboxApi, 'listInboxPage')
      .mockResolvedValue(page([inboxItem({ uuid: 'a' }), inboxItem({ uuid: 'b' })], null))
    const inbox = useInboxStore()
    await inbox.loadFirstPage()
    expect(inbox.nextUrl).toBe(next)
    await inbox.loadMore()
    expect(more).toHaveBeenCalledWith(next)
    expect(inbox.items.map((i) => i.uuid)).toEqual(['a', 'b'])
    expect(inbox.nextUrl).toBeNull()
  })

  it('setFilter reloads with unread', async () => {
    const list = vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([]))
    const inbox = useInboxStore()
    await inbox.setFilter('unread')
    expect(list).toHaveBeenCalledWith({ unread: true })
    expect(inbox.filter).toBe('unread')
  })

  it('badgeLabel caps at 99+', () => {
    const inbox = useInboxStore()
    expect(inbox.badgeLabel).toBe('')
    inbox.unreadCount = 5
    expect(inbox.badgeLabel).toBe('5')
    inbox.unreadCount = 99
    expect(inbox.badgeLabel).toBe('99')
    inbox.unreadCount = 100
    expect(inbox.badgeLabel).toBe('99+')
  })

  it('reset clears state', async () => {
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([inboxItem()], 'http://x/next'))
    vi.spyOn(inboxApi, 'getUnreadCount').mockResolvedValue({
      unread: 1,
      latest_occurred_at: '2026-11-21T10:00:00Z',
    })
    const inbox = useInboxStore()
    await inbox.open()
    inbox.filter = 'unread'
    inbox.actionError = 'x'
    inbox.reset()
    expect(inbox.isOpen).toBe(false)
    expect(inbox.items).toEqual([])
    expect(inbox.nextUrl).toBeNull()
    expect(inbox.unreadCount).toBe(0)
    expect(inbox.latestOccurredAt).toBeNull()
    expect(inbox.filter).toBe('all')
    expect(inbox.actionError).toBeNull()
    expect(inbox.listLoadedAt).toBeNull()
  })
})
