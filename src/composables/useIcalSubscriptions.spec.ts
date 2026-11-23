import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { API_BASE } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { icalSub } from '@/test/icalSubscriptions'
import {
  createIcalSubscription,
  deleteIcalSubscription,
  getIcalSubscription,
  isIcalSyncInProgress,
  listIcalSubscriptions,
  syncIcalSubscription,
  updateIcalSubscription,
  useIcalSubscriptions,
} from './useIcalSubscriptions'

const BASE = `${API_BASE}/integrations/ical-subscriptions/`

function body(fn: ReturnType<typeof mockFetch>, n: number) {
  return JSON.parse(String(callAt(fn, n).init.body))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('funciones de la API de suscripciones iCal', () => {
  it('rutas, métodos y cuerpos', async () => {
    const fn = mockFetch(
      jsonResponse({ count: 2, next: `${BASE}?page=2`, previous: null, results: [icalSub()] }),
      jsonResponse({ count: 2, next: null, previous: null, results: [icalSub({ uuid: 'S2' })] }),
      jsonResponse({ count: 0, next: null, previous: null, results: [] }),
      jsonResponse(icalSub()),
      jsonResponse(icalSub({ last_status: 'pending' }), 201),
      jsonResponse(icalSub({ sync_enabled: false })),
      new Response(null, { status: 204 }),
      jsonResponse({ status: 'queued' }, 202),
      jsonResponse({ status: 'queued' }, 202)
    )

    const all = await listIcalSubscriptions()
    expect(all.map((s) => s.uuid)).toEqual(['S1', 'S2'])
    expect(callAt(fn, 0).url).toBe(BASE)
    expect(callAt(fn, 1).url).toBe(`${BASE}?page=2`)

    await listIcalSubscriptions('T1')
    expect(callAt(fn, 2).url).toBe(`${BASE}?tour=T1`)

    await getIcalSubscription('S1')
    expect(callAt(fn, 3).url).toBe(`${BASE}S1/`)

    const created = await createIcalSubscription({ tour: 'T1', url: ' webcal://x.com/a ', name: '  ' })
    expect(created.last_status).toBe('pending')
    expect(callAt(fn, 4).init.method).toBe('POST')
    expect(body(fn, 4)).toEqual({ tour: 'T1', url: 'webcal://x.com/a' })

    await updateIcalSubscription('S1', { sync_enabled: false })
    expect(callAt(fn, 5).init.method).toBe('PATCH')
    expect(callAt(fn, 5).url).toBe(`${BASE}S1/`)
    expect(body(fn, 5)).toEqual({ sync_enabled: false })

    await deleteIcalSubscription('S1')
    expect(callAt(fn, 6).init.method).toBe('DELETE')
    expect(callAt(fn, 6).url).toBe(`${BASE}S1/`)

    expect(await syncIcalSubscription('S1')).toEqual({ status: 'queued' })
    expect(callAt(fn, 7).url).toBe(`${BASE}S1/sync/`)
    expect(body(fn, 7)).toEqual({})
    await syncIcalSubscription('S1', { full: true })
    expect(body(fn, 8)).toEqual({ full: true })
  })

  it('isIcalSyncInProgress: pending o job procesándose', () => {
    expect(isIcalSyncInProgress(icalSub({ last_status: 'pending' }))).toBe(true)
    const job = { uuid: 'J1', status: 'extracting' as const, created_at: '', new: 0, changed: 0, cancelled: 0 }
    expect(isIcalSyncInProgress(icalSub({ pending_job: job }))).toBe(true)
    expect(isIcalSyncInProgress(icalSub({ pending_job: { ...job, status: 'ready' } }))).toBe(false)
    expect(isIcalSyncInProgress(icalSub({ last_status: 'error' }))).toBe(false)
  })
})

describe('pollUntilSynced', () => {
  it('para cuando el estado deja de ser pending (ok o error)', async () => {
    vi.useFakeTimers()
    mockFetch(
      jsonResponse(icalSub({ last_status: 'pending' })),
      jsonResponse(icalSub({ last_status: 'error', last_error_code: 'http_404' }))
    )
    const { pollUntilSynced } = useIcalSubscriptions()
    const p = pollUntilSynced('S1')
    await vi.advanceTimersByTimeAsync(3000)
    const r = await p
    expect(r).toMatchObject({ timedOut: false, cancelled: false })
    expect(r.sub?.last_status).toBe('error')
  })

  it('sigue mientras el job se procesa y para con el job en ready', async () => {
    vi.useFakeTimers()
    const job = { uuid: 'J1', status: 'extracting' as const, created_at: '', new: 2, changed: 0, cancelled: 0 }
    const fn = mockFetch(
      jsonResponse(icalSub({ last_status: 'pending' })),
      jsonResponse(icalSub({ pending_job: job })),
      jsonResponse(icalSub({ pending_job: { ...job, status: 'ready' } }))
    )
    const { pollUntilSynced } = useIcalSubscriptions()
    const p = pollUntilSynced('S1')
    await vi.advanceTimersByTimeAsync(6000)
    const r = await p
    expect(fn).toHaveBeenCalledTimes(3)
    expect(r.sub?.pending_job?.status).toBe('ready')
    expect(r.timedOut).toBe(false)
  })

  it('a los 60 s se rinde con timedOut', async () => {
    vi.useFakeTimers()
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(icalSub({ last_status: 'pending' })))
    vi.stubGlobal('fetch', fn)
    const { pollUntilSynced } = useIcalSubscriptions()
    const p = pollUntilSynced('S1')
    await vi.advanceTimersByTimeAsync(61000)
    const r = await p
    expect(r.timedOut).toBe(true)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(21)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(19)
  })

  it('se cancela al desmontar el componente', async () => {
    vi.useFakeTimers()
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(icalSub({ last_status: 'pending' })))
    vi.stubGlobal('fetch', fn)
    let poll!: ReturnType<typeof useIcalSubscriptions>['pollUntilSynced']
    const C = defineComponent({
      setup() {
        poll = useIcalSubscriptions().pollUntilSynced
        return () => h('div')
      },
    })
    const w = mount(C)
    const p = poll('S1')
    await vi.advanceTimersByTimeAsync(3000)
    const calls = fn.mock.calls.length
    w.unmount()
    const r = await p
    expect(r.cancelled).toBe(true)
    await vi.advanceTimersByTimeAsync(30000)
    expect(fn.mock.calls.length).toBe(calls)
  })

  it('un 4xx al leer se relanza', async () => {
    mockFetch(jsonResponse({ detail: 'No encontrado.' }, 404))
    const { pollUntilSynced } = useIcalSubscriptions()
    await expect(pollUntilSynced('S1')).rejects.toMatchObject({ status: 404 })
  })
})
