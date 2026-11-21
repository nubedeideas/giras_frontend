import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useAdminTwilioCosts } from './useAdminTwilioCosts'
import { ApiError } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { adminSummary, discrepancy } from '@/test/twilioCosts'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

const page = (results: unknown[], next: string | null = null) => ({
  count: results.length,
  next,
  previous: null,
  results,
})

describe('useAdminTwilioCosts', () => {
  it('summary with and without month', async () => {
    const fetchMock = mockFetch(jsonResponse(adminSummary()), jsonResponse(adminSummary()))
    const api = useAdminTwilioCosts()

    await api.getSummary()
    await api.getSummary('2026-10')

    expect(callAt(fetchMock, 0).url).toBe('http://api.test/api/admin/twilio-costs/summary/')
    expect(callAt(fetchMock, 1).url).toBe(
      'http://api.test/api/admin/twilio-costs/summary/?month=2026-10'
    )
    expect(callAt(fetchMock, 0).headers.Authorization).toBe('Bearer access')
  })

  it('lists discrepancies with repeated kind and follows next', async () => {
    const nextUrl = 'http://api.test/api/admin/twilio-costs/discrepancies/?page=2&status=all'
    const fetchMock = mockFetch(
      jsonResponse(page([discrepancy()], nextUrl)),
      jsonResponse(page([discrepancy({ uuid: 'D2' })]))
    )
    const api = useAdminTwilioCosts()

    const first = await api.listDiscrepancies({
      status: 'all',
      kind: ['missing_in_twilio', 'status_mismatch'],
      tour: 'T1',
    })
    const second = await api.listDiscrepancies(first.next!)

    const parsed = new URL(callAt(fetchMock, 0).url)
    expect(parsed.pathname).toBe('/api/admin/twilio-costs/discrepancies/')
    expect(parsed.searchParams.get('status')).toBe('all')
    expect(parsed.searchParams.getAll('kind')).toEqual(['missing_in_twilio', 'status_mismatch'])
    expect(parsed.searchParams.get('tour')).toBe('T1')
    expect(parsed.searchParams.get('page_size')).toBe('20')
    expect(callAt(fetchMock, 1).url).toBe(nextUrl)
    expect(second.results[0].uuid).toBe('D2')
  })

  it('acknowledge posts', async () => {
    const fetchMock = mockFetch(jsonResponse(discrepancy({ status: 'acknowledged' })))
    const res = await useAdminTwilioCosts().acknowledge('D1')
    const { url, init } = callAt(fetchMock, 0)
    expect(url).toBe('http://api.test/api/admin/twilio-costs/discrepancies/D1/acknowledge/')
    expect(init.method).toBe('POST')
    expect(res.status).toBe('acknowledged')
  })

  it('triggerSync sends lookback and maps 409 and 503', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ queued: true, lookback_hours: 72 }, 202),
      jsonResponse({ queued: true, lookback_hours: 48 }, 202),
      jsonResponse({ error: 'Ya hay una sincronización en curso', code: 'sync_running' }, 409),
      jsonResponse({ error: 'Twilio no está configurado', code: 'twilio_not_configured' }, 503)
    )
    const api = useAdminTwilioCosts()

    expect(await api.triggerSync(72)).toEqual({ queued: true, lookback_hours: 72 })
    const first = callAt(fetchMock, 0)
    expect(first.url).toBe('http://api.test/api/admin/twilio-costs/sync/')
    expect(first.init.method).toBe('POST')
    expect(JSON.parse(String(first.init.body))).toEqual({ lookback_hours: 72 })

    await api.triggerSync()
    expect(JSON.parse(String(callAt(fetchMock, 1).init.body))).toEqual({})

    const running = await api.triggerSync().catch((e) => e)
    expect(running).toBeInstanceOf(ApiError)
    expect(running.status).toBe(409)
    expect(running.message).toBe('Ya hay una sincronización en curso')

    const unconfigured = await api.triggerSync().catch((e) => e)
    expect(unconfigured.status).toBe(503)
    expect(unconfigured.message).toBe('Twilio no está configurado')
  })
})
