import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { wrappedError } from '@/test/reminders'
import { notice, noticeDetail, preview } from '@/test/notices'
import { ApiError } from '@/utils/apiClient'
import { NoticeApiError, useNotices } from './useNotices'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

describe('useNotices', () => {
  it('list sin límite recorre la paginación con tour y status', async () => {
    const fn = mockFetch(
      jsonResponse({ count: 2, next: 'http://x/api/notifications/notices/?page=2', previous: null, results: [notice()] }),
      jsonResponse({ count: 2, next: null, previous: null, results: [notice({ uuid: 'N2' })] })
    )
    const res = await useNotices().list('T1', { status: 'pending' })
    expect(res.map((n) => n.uuid)).toEqual(['N1', 'N2'])
    const url = new URL(callAt(fn, 0).url)
    expect(url.pathname).toBe('/api/notifications/notices/')
    expect(url.searchParams.get('tour')).toBe('T1')
    expect(url.searchParams.get('status')).toBe('pending')
  })

  it('list con límite pide solo la primera página', async () => {
    const fn = mockFetch(
      jsonResponse({ count: 99, next: 'http://x/next', previous: null, results: [notice()] })
    )
    const res = await useNotices().list('T1', { limit: 30 })
    expect(res).toHaveLength(1)
    expect(fn).toHaveBeenCalledTimes(1)
    const url = new URL(callAt(fn, 0).url)
    expect(url.searchParams.get('page_size')).toBe('30')
    expect(url.searchParams.has('status')).toBe(false)
  })

  it('get, update, send, discard usan las rutas y métodos del contrato', async () => {
    const fn = mockFetch(
      jsonResponse(noticeDetail()),
      jsonResponse(noticeDetail()),
      jsonResponse(noticeDetail({ status: 'sent' })),
      jsonResponse(noticeDetail({ status: 'discarded' }))
    )
    const api = useNotices()
    await api.get('N1')
    await api.update('N1', { channel: 'email' })
    await api.send('N1')
    await api.discard('N1')
    expect(callAt(fn, 0).url).toMatch(/\/notifications\/notices\/N1\/$/)
    expect(callAt(fn, 1).init.method).toBe('PATCH')
    expect(JSON.parse(String(callAt(fn, 1).init.body))).toEqual({ channel: 'email' })
    expect(callAt(fn, 2).url).toMatch(/\/notices\/N1\/send\/$/)
    expect(JSON.parse(String(callAt(fn, 2).init.body))).toEqual({})
    expect(callAt(fn, 3).url).toMatch(/\/notices\/N1\/discard\/$/)
    expect(callAt(fn, 3).init.method).toBe('POST')
  })

  it('urgentPreview manda dry_run true y sendUrgent dry_run false', async () => {
    const fn = mockFetch(jsonResponse(preview()), jsonResponse(noticeDetail({ origin: 'urgent' }), 201))
    const api = useNotices()
    await api.urgentPreview({ activity: 'A1' })
    await api.sendUrgent({ activity: 'A1', channel: 'email' })
    expect(callAt(fn, 0).url).toMatch(/\/notices\/urgent\/$/)
    expect(JSON.parse(String(callAt(fn, 0).init.body))).toEqual({ activity: 'A1', dry_run: true })
    expect(JSON.parse(String(callAt(fn, 1).init.body))).toEqual({
      activity: 'A1',
      channel: 'email',
      dry_run: false,
    })
  })

  it('400/409 con details.code lanzan NoticeApiError con code y sin el código como mensaje', async () => {
    mockFetch(wrappedError(409, 'notice_not_pending', 'status', 'Este aviso ya no está pendiente.'))
    const err = await useNotices().send('N1').catch((e) => e)
    expect(err).toBeInstanceOf(NoticeApiError)
    expect(err.code).toBe('notice_not_pending')
    expect(err.status).toBe(409)
    expect(err.message).toBe('Este aviso ya no está pendiente.')
  })

  it('un error con solo code no enseña el código crudo', async () => {
    mockFetch(
      jsonResponse(
        { success: false, error: { message: 'Error', status_code: 400, details: { code: ['no_recipients'] } } },
        400
      )
    )
    const err = await useNotices().send('N1').catch((e) => e)
    expect(err.code).toBe('no_recipients')
    expect(err.message).not.toBe('no_recipients')
  })

  it('403 y 429 siguen siendo ApiError normales', async () => {
    mockFetch(jsonResponse({ detail: 'x' }, 403))
    const err = await useNotices().discard('N1').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).not.toBeInstanceOf(NoticeApiError)
    expect(err.status).toBe(403)
  })
})
