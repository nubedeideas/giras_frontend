import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { useInbox } from './useInbox'

const BASE = 'http://api.test/api/notifications/inbox/'
const page = { count: 0, next: null, previous: null, results: [] }
const UUID = '11111111-2222-3333-4444-555555555555'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

describe('useInbox', () => {
  it('lists with unread, tour and kind params', async () => {
    const fn = mockFetch(jsonResponse(page), jsonResponse(page))
    await useInbox().listInbox({
      unread: true,
      tour: 'T1',
      kind: ['flight_delay', 'plan_limit'],
      page: 2,
    })
    const url = new URL(callAt(fn, 0).url)
    expect(`${url.origin}${url.pathname}`).toBe(BASE)
    expect(url.searchParams.get('unread')).toBe('true')
    expect(url.searchParams.get('tour')).toBe('T1')
    expect(url.searchParams.get('kind')).toBe('flight_delay,plan_limit')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('page_size')).toBe('20')
    expect(callAt(fn, 0).headers.Authorization).toBe('Bearer access')

    await useInbox().listInbox()
    const plain = new URL(callAt(fn, 1).url)
    expect([...plain.searchParams.keys()]).toEqual(['page_size'])
  })

  it('follows next url for load more', async () => {
    const next = 'http://api.test/api/notifications/inbox/?page=2&page_size=20'
    const fn = mockFetch(jsonResponse({ ...page, next: null }))
    await useInbox().listInboxPage(next)
    expect(callAt(fn, 0).url).toBe(next)
    expect(callAt(fn, 0).init.method).toBe('GET')
  })

  it('gets unread count with optional tour', async () => {
    const body = { unread: 3, latest_occurred_at: '2026-11-21T10:00:00Z' }
    const fn = mockFetch(jsonResponse(body), jsonResponse(body))
    expect(await useInbox().getUnreadCount()).toEqual(body)
    expect(callAt(fn, 0).url).toBe(`${BASE}unread-count/`)
    await useInbox().getUnreadCount('T1')
    expect(callAt(fn, 1).url).toBe(`${BASE}unread-count/?tour=T1`)
  })

  it('marks one read via POST', async () => {
    const fn = mockFetch(jsonResponse({ item: { uuid: UUID, is_read: true }, unread: 0 }))
    const res = await useInbox().markInboxRead(UUID)
    expect(res.unread).toBe(0)
    expect(callAt(fn, 0).url).toBe(`${BASE}${UUID}/read/`)
    expect(callAt(fn, 0).init.method).toBe('POST')
  })

  it('marks all read with before', async () => {
    const fn = mockFetch(
      jsonResponse({ updated: 4, unread: 1 }),
      jsonResponse({ updated: 0, unread: 0 })
    )
    const res = await useInbox().markAllInboxRead({
      before: '2026-11-21T10:00:00Z',
      kind: ['delivery_failed'],
    })
    expect(res).toEqual({ updated: 4, unread: 1 })
    const { url, init } = callAt(fn, 0)
    expect(url).toBe(`${BASE}read-all/`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      before: '2026-11-21T10:00:00Z',
      kind: ['delivery_failed'],
    })
    await useInbox().markAllInboxRead()
    expect(JSON.parse(String(callAt(fn, 1).init.body))).toEqual({})
  })

  it('dismisses via DELETE', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }))
    await expect(useInbox().dismissInboxItem(UUID)).resolves.toBeUndefined()
    expect(callAt(fn, 0).url).toBe(`${BASE}${UUID}/`)
    expect(callAt(fn, 0).init.method).toBe('DELETE')
  })

  it('wrapped 404 error becomes ApiError with Spanish message', async () => {
    mockFetch(
      jsonResponse({ success: false, error: { message: 'No encontrado.', status_code: 404 } }, 404)
    )
    const err = await useInbox()
      .markInboxRead(UUID)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(404)
    expect((err as ApiError).message).toBe('No se ha encontrado el recurso.')
  })
})
