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

function mountProgress(expected?: 'team' | 'itinerary' | 'any') {
  return mount(ImportProgress, {
    props: { jobUuid: 'J1', ...(expected ? { expected } : {}) },
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

  it('F2: con itinerario habla de la agenda; con any, según lo detectado', async () => {
    stubJobs({ status: 'extracting', progress: { calls_done: 1, calls_total: 4 } })
    const w = mountProgress('itinerary')
    await flushPromises()
    expect(w.get('[data-phase="extracting"]').text()).toBe('Leyendo la agenda (1/4)')
    expect(w.get('[data-phase="normalizing"]').text()).toBe('Ajustando fechas, zonas y duplicados')
    w.unmount()

    const source = {
      ref: 'd1',
      document_uuid: 'D1',
      filename: 'Itinerario.pdf',
      kind: 'pdf_text' as const,
      sheet: null,
      doc_kind: 'itinerary' as const,
      processed: true,
      deferred: false,
      deferred_reason: null,
      rows_scanned: 0,
      truncated: false,
      people_found: 0,
    }
    stubJobs({ status: 'normalizing', detected: { sources: [source] } })
    const any = mountProgress('any')
    await flushPromises()
    expect(any.get('[data-phase="extracting"]').text()).toBe('Leyendo la agenda')
    any.unmount()

    stubJobs({ status: 'normalizing', detected: { sources: [{ ...source, doc_kind: 'team' }] } })
    const team = mountProgress('any')
    await flushPromises()
    expect(team.get('[data-phase="extracting"]').text()).toBe('Extrayendo el equipo')
  })
})
