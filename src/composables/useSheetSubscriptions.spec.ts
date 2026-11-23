import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { API_BASE } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { sheetInspect, sheetSub } from '@/test/sheetSubscriptions'
import {
  createSheetSubscription,
  deleteSheetSubscription,
  getSheetSubscription,
  inspectSheet,
  isSheetSyncInProgress,
  listSheetSubscriptions,
  syncSheetSubscription,
  updateSheetSubscription,
  useMyAccount,
  useSheetSubscriptions,
} from './useSheetSubscriptions'

const BASE = `${API_BASE}/integrations/sheet-subscriptions/`

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

describe('funciones de la API de hojas de Google', () => {
  it('rutas, métodos y cuerpos', async () => {
    const fn = mockFetch(
      jsonResponse(sheetInspect()),
      jsonResponse({ count: 2, next: `${BASE}?page=2`, previous: null, results: [sheetSub()] }),
      jsonResponse({ count: 2, next: null, previous: null, results: [sheetSub({ uuid: 'G2' })] }),
      jsonResponse({ count: 0, next: null, previous: null, results: [] }),
      jsonResponse(sheetSub()),
      jsonResponse(sheetSub({ last_status: 'pending' }), 201),
      jsonResponse(sheetSub({ sync_enabled: false })),
      new Response(null, { status: 204 }),
      jsonResponse({ status: 'queued' }, 202),
      jsonResponse({ status: 'queued' }, 202),
      jsonResponse(sheetSub({ last_status: 'pending' }))
    )

    const info = await inspectSheet({ tour: 'T1', spreadsheet_id: 'ID-1' })
    expect(info.tabs).toHaveLength(7)
    expect(callAt(fn, 0).url).toBe(`${BASE}inspect/`)
    expect(callAt(fn, 0).init.method).toBe('POST')
    expect(body(fn, 0)).toEqual({ tour: 'T1', spreadsheet_id: 'ID-1' })

    const all = await listSheetSubscriptions()
    expect(all.map((s) => s.uuid)).toEqual(['G1', 'G2'])
    expect(callAt(fn, 1).url).toBe(BASE)
    expect(callAt(fn, 2).url).toBe(`${BASE}?page=2`)

    await listSheetSubscriptions('T1')
    expect(callAt(fn, 3).url).toBe(`${BASE}?tour=T1`)

    await getSheetSubscription('G1')
    expect(callAt(fn, 4).url).toBe(`${BASE}G1/`)

    await createSheetSubscription({
      tour: 'T1',
      spreadsheet_id: 'ID-1',
      tabs: [{ gid: 0, range: ' a3:h200 ' }, { gid: 22, range: '' }],
      name: '  ',
    })
    expect(callAt(fn, 5).init.method).toBe('POST')
    expect(callAt(fn, 5).url).toBe(BASE)
    expect(body(fn, 5)).toEqual({
      tour: 'T1',
      spreadsheet_id: 'ID-1',
      tabs: [{ gid: 0, range: 'A3:H200' }, { gid: 22 }],
    })

    await updateSheetSubscription('G1', { sync_enabled: false })
    expect(callAt(fn, 6).init.method).toBe('PATCH')
    expect(body(fn, 6)).toEqual({ sync_enabled: false })

    await deleteSheetSubscription('G1')
    expect(callAt(fn, 7).init.method).toBe('DELETE')
    expect(callAt(fn, 7).url).toBe(`${BASE}G1/`)

    expect(await syncSheetSubscription('G1')).toEqual({ status: 'queued' })
    expect(callAt(fn, 8).url).toBe(`${BASE}G1/sync/`)
    expect(body(fn, 8)).toEqual({})
    await syncSheetSubscription('G1', { full: true })
    expect(body(fn, 9)).toEqual({ full: true })

    await useMyAccount('G1', { spreadsheet_id: 'ID-1' })
    expect(callAt(fn, 10).url).toBe(`${BASE}G1/use-my-account/`)
    expect(callAt(fn, 10).init.method).toBe('POST')
    expect(body(fn, 10)).toEqual({ spreadsheet_id: 'ID-1' })
  })

  it('PATCH de pestañas normaliza el rango', async () => {
    const fn = mockFetch(jsonResponse(sheetSub()))
    await updateSheetSubscription('G1', { tabs: [{ gid: 0, range: 'b2:c9' }, { gid: 5 }] })
    expect(body(fn, 0)).toEqual({ tabs: [{ gid: 0, range: 'B2:C9' }, { gid: 5 }] })
  })

  it('isSheetSyncInProgress: pending o job procesándose', () => {
    expect(isSheetSyncInProgress(sheetSub({ last_status: 'pending' }))).toBe(true)
    const job = { uuid: 'J1', status: 'extracting' as const, created_at: '', new: 0, changed: 0, removed: 0 }
    expect(isSheetSyncInProgress(sheetSub({ pending_job: job }))).toBe(true)
    expect(isSheetSyncInProgress(sheetSub({ pending_job: { ...job, status: 'ready' } }))).toBe(false)
    expect(isSheetSyncInProgress(sheetSub({ last_status: 'error' }))).toBe(false)
  })
})

describe('pollUntilSynced', () => {
  it('para con ok o error', async () => {
    vi.useFakeTimers()
    mockFetch(
      jsonResponse(sheetSub({ last_status: 'pending' })),
      jsonResponse(sheetSub({ last_status: 'error', last_error_code: 'no_access' }))
    )
    const { pollUntilSynced } = useSheetSubscriptions()
    const p = pollUntilSynced('G1')
    await vi.advanceTimersByTimeAsync(3000)
    const r = await p
    expect(r).toMatchObject({ timedOut: false, cancelled: false })
    expect(r.sub?.last_error_code).toBe('no_access')
  })

  it('sigue mientras el job se procesa y para con el job en ready', async () => {
    vi.useFakeTimers()
    const job = { uuid: 'J1', status: 'extracting' as const, created_at: '', new: 2, changed: 0, removed: 0 }
    const fn = mockFetch(
      jsonResponse(sheetSub({ last_status: 'pending' })),
      jsonResponse(sheetSub({ pending_job: job })),
      jsonResponse(sheetSub({ pending_job: { ...job, status: 'ready' } }))
    )
    const seen: string[] = []
    const { pollUntilSynced } = useSheetSubscriptions()
    const p = pollUntilSynced('G1', { onRead: (s) => seen.push(s.last_status) })
    await vi.advanceTimersByTimeAsync(6000)
    const r = await p
    expect(fn).toHaveBeenCalledTimes(3)
    expect(seen).toHaveLength(3)
    expect(r.sub?.pending_job?.status).toBe('ready')
  })

  it('a los 90 s se rinde con timedOut', async () => {
    vi.useFakeTimers()
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(sheetSub({ last_status: 'pending' })))
    vi.stubGlobal('fetch', fn)
    const { pollUntilSynced } = useSheetSubscriptions()
    const p = pollUntilSynced('G1')
    await vi.advanceTimersByTimeAsync(60000)
    let settled = false
    void p.then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(31000)
    const r = await p
    expect(r.timedOut).toBe(true)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(31)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(29)
  })

  it('se cancela con stop() y al desmontar', async () => {
    vi.useFakeTimers()
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(sheetSub({ last_status: 'pending' })))
    vi.stubGlobal('fetch', fn)
    let api!: ReturnType<typeof useSheetSubscriptions>
    const C = defineComponent({
      setup() {
        api = useSheetSubscriptions()
        return () => h('div')
      },
    })
    const w = mount(C)
    const p1 = api.pollUntilSynced('G1')
    await vi.advanceTimersByTimeAsync(3000)
    api.stop()
    expect((await p1).cancelled).toBe(true)

    const p2 = api.pollUntilSynced('G1')
    await vi.advanceTimersByTimeAsync(3000)
    const calls = fn.mock.calls.length
    w.unmount()
    expect((await p2).cancelled).toBe(true)
    await vi.advanceTimersByTimeAsync(30000)
    expect(fn.mock.calls.length).toBe(calls)
  })

  it('un 4xx al leer se relanza', async () => {
    mockFetch(jsonResponse({ detail: 'No encontrado.' }, 404))
    const { pollUntilSynced } = useSheetSubscriptions()
    await expect(pollUntilSynced('G1')).rejects.toMatchObject({ status: 404 })
  })
})
