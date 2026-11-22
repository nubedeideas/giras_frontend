import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { jsonResponse } from '@/test/http'
import { importJob } from '@/test/importJobs'
import type { ImportJobStatus } from './useImportJobs'
import { IMPORT_POLL_MS, IMPORT_SLOW_MS, useImportJobPolling } from './useImportJobPolling'

type Reply = ImportJobStatus | 'network' | 404 | Promise<Response>

/** `fetch` que responde por uuid con la siguiente respuesta de su cola (la última se repite). */
function stubFetch(queues: Record<string, Reply[]>) {
  const fn = vi.fn<typeof fetch>(async (input) => {
    const uuid = String(input).match(/import-jobs\/([^/]+)\//)?.[1] ?? ''
    const q = queues[uuid]
    const next = q.length > 1 ? q.shift()! : q[0]
    if (next instanceof Promise) return next
    if (next === 'network') throw new TypeError('Failed to fetch')
    if (next === 404) return jsonResponse({ detail: 'No encontrado.' }, 404)
    return jsonResponse(importJob({ uuid, status: next }))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function mountPolling(initial: string | null) {
  const uuid = ref<string | null>(initial)
  let api!: ReturnType<typeof useImportJobPolling>
  const w = mount(
    defineComponent({
      setup() {
        api = useImportJobPolling(uuid)
        return () => h('div')
      },
    })
  )
  return { w, uuid, api: () => api }
}

async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useImportJobPolling', () => {
  it('sondea cada 2 s mientras procesa y para en ready', async () => {
    const fn = stubFetch({ J1: ['uploaded', 'detecting', 'extracting', 'ready'] })
    const { api } = mountPolling('J1')
    await flushPromises()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(api().job.value?.status).toBe('uploaded')

    await advance(IMPORT_POLL_MS)
    expect(fn).toHaveBeenCalledTimes(2)
    await advance(IMPORT_POLL_MS * 2)
    expect(fn).toHaveBeenCalledTimes(4)
    expect(api().job.value?.status).toBe('ready')
    expect(api().polling.value).toBe(false)

    await advance(IMPORT_POLL_MS * 5)
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it.each(['failed', 'done', 'discarded'] as const)('para en %s', async (status) => {
    const fn = stubFetch({ J1: ['normalizing', status] })
    mountPolling('J1')
    await flushPromises()
    await advance(IMPORT_POLL_MS * 4)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('para al desmontar', async () => {
    const fn = stubFetch({ J1: ['extracting'] })
    const { w } = mountPolling('J1')
    await flushPromises()
    w.unmount()
    await advance(IMPORT_POLL_MS * 5)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('ignora la respuesta atrasada del uuid anterior', async () => {
    let resolveOld: (r: Response) => void = () => {}
    const old = new Promise<Response>((r) => (resolveOld = r))
    stubFetch({ J1: [old], J2: ['extracting'] })
    const { uuid, api } = mountPolling('J1')
    await flushPromises()
    uuid.value = 'J2'
    await nextTick()
    await flushPromises()
    expect(api().job.value?.uuid).toBe('J2')
    resolveOld(jsonResponse(importJob({ uuid: 'J1', status: 'ready' })))
    await flushPromises()
    expect(api().job.value?.uuid).toBe('J2')
    expect(api().job.value?.status).toBe('extracting')
  })

  it('marca slow a los 3 minutos sin cortar', async () => {
    const fn = stubFetch({ J1: ['extracting'] })
    const { api } = mountPolling('J1')
    await flushPromises()
    await advance(IMPORT_SLOW_MS - IMPORT_POLL_MS)
    expect(api().slow.value).toBe(false)
    await advance(IMPORT_POLL_MS)
    expect(api().slow.value).toBe(true)
    const calls = fn.mock.calls.length
    await advance(IMPORT_POLL_MS)
    expect(fn.mock.calls.length).toBe(calls + 1)
  })

  it('para tras 3 errores de red seguidos', async () => {
    const fn = stubFetch({ J1: ['network', 'network', 'network', 'extracting'] })
    const { api } = mountPolling('J1')
    await flushPromises()
    await advance(IMPORT_POLL_MS)
    expect(api().error.value).toBeNull()
    await advance(IMPORT_POLL_MS)
    expect(api().error.value).not.toBeNull()
    await advance(IMPORT_POLL_MS * 3)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('un error de red suelto no para', async () => {
    const fn = stubFetch({ J1: ['network', 'extracting', 'ready'] })
    const { api } = mountPolling('J1')
    await flushPromises()
    await advance(IMPORT_POLL_MS * 2)
    expect(fn).toHaveBeenCalledTimes(3)
    expect(api().job.value?.status).toBe('ready')
    expect(api().error.value).toBeNull()
  })

  it('un 404 para en el acto', async () => {
    const fn = stubFetch({ J1: [404] })
    const { api } = mountPolling('J1')
    await flushPromises()
    await advance(IMPORT_POLL_MS * 3)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(api().error.value).toMatchObject({ status: 404 })
  })
})
