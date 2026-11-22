import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { importJob } from '@/test/importJobs'
import type { ImportJob } from '@/composables/useImportJobs'
import { IMPORT_POLL_MS } from '@/composables/useImportJobPolling'
import ImportProgress from './ImportProgress.vue'

function stubJobs(...jobs: Partial<ImportJob>[]) {
  const queue = [...jobs]
  const fn = vi.fn<typeof fetch>(async () => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]
    return jsonResponse(importJob(next))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function mountProgress() {
  return mount(ImportProgress, {
    props: { jobUuid: 'J1' },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ImportProgress', () => {
  it('pinta las fases con la en curso y el "2/3" de la extracción', async () => {
    stubJobs({ status: 'extracting', progress: { calls_done: 2, calls_total: 3 } })
    const w = mountProgress()
    await flushPromises()
    const state = (p: string) => w.get(`[data-phase="${p}"]`).attributes('data-state')
    expect(state('uploaded')).toBe('done')
    expect(state('detecting')).toBe('done')
    expect(state('extracting')).toBe('current')
    expect(state('normalizing')).toBe('todo')
    expect(w.get('[data-phase="extracting"]').text()).toBe('Extrayendo el equipo (2/3)')
    expect(w.get('[data-phase="extracting"] .font-time').text()).toBe('2')
    expect(w.get('ol').attributes('aria-live')).toBe('polite')
  })

  it('emite ready una sola vez al llegar a ready', async () => {
    stubJobs({ status: 'normalizing' }, { status: 'ready' })
    const w = mountProgress()
    await flushPromises()
    expect(w.emitted('ready')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(IMPORT_POLL_MS)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(IMPORT_POLL_MS * 2)
    expect(w.emitted('ready')).toHaveLength(1)
    expect(w.emitted('failed')).toBeUndefined()
  })

  it('emite failed con el job fallido', async () => {
    stubJobs({ status: 'failed', error_code: 'ai_unavailable' })
    const w = mountProgress()
    await flushPromises()
    expect(w.emitted('failed')?.[0][0]).toMatchObject({ error_code: 'ai_unavailable' })
  })
})
