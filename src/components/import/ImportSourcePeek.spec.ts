import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import ImportSourcePeek from './ImportSourcePeek.vue'

const doc = { tourUuid: 'T1', uuid: 'D2', filename: 'Itinerario_MAD.pdf' }
const { createObjectURL, revokeObjectURL } = URL

beforeEach(() => {
  i18n.global.locale.value = 'es'
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

afterEach(() => {
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mountPeek(props: Record<string, unknown>) {
  return mount(ImportSourcePeek, {
    props: { sourceRef: activityRow().source_ref, ...props },
    global: { plugins: [i18n] },
  })
}

const scanRef = { ...activityRow().source_ref, kind: 'pdf_scan' as const, snippet: '', context: null, page: 2 }

describe('ImportSourcePeek', () => {
  it('texto: archivo y página, cabecera de contexto y fragmento; sin botón', () => {
    const w = mountPeek({ sourceDocument: doc })
    expect(w.get('[data-test="import-source-where"]').text()).toBe('Itinerario_MAD.pdf, página 3')
    expect(w.get('[data-test="import-source-context"]').text()).toBe('Cabecera: DAY 3 — MADRID — Wed 3 Dec')
    expect(w.get('[data-test="import-source-snippet"]').text()).toBe(
      'Wed 3 Dec · 10:30 · IB3456 MAD-BCN · Loc. ABC12'
    )
    expect(w.find('[data-test="import-source-open"]').exists()).toBe(false)
  })

  it('hoja: archivo, hoja y fila', () => {
    const w = mountPeek({
      sourceRef: { ...activityRow().source_ref, kind: 'spreadsheet', sheet: 'Flights', row: 'Flights!4', page: null },
    })
    expect(w.get('[data-test="import-source-where"]').text()).toBe('Itinerario_MAD.pdf, Flights · Flights!4')
  })

  it('foto: botón (no enlace) que descarga el documento con el token vía apiClient', async () => {
    const createUrl = vi.fn(() => 'blob:doc')
    const revokeUrl = vi.fn()
    URL.createObjectURL = createUrl
    URL.revokeObjectURL = revokeUrl
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const fetchMock = mockFetch(
      new Response(new Blob(['%PDF']), { status: 200, headers: { 'Content-Type': 'application/pdf' } })
    )
    const w = mountPeek({ sourceRef: scanRef, sourceDocument: doc })
    expect(w.find('[data-test="import-source-snippet"]').exists()).toBe(false)
    const btn = w.get('[data-test="import-source-open"]')
    expect(btn.element.tagName).toBe('BUTTON')
    expect(btn.attributes('href')).toBeUndefined()
    expect(btn.text()).toContain('Abrir documento')
    expect(btn.text()).toContain('página 2')
    await btn.trigger('click')
    await flushPromises()
    expect(callAt(fetchMock, 0).url).toMatch(/\/tours\/T1\/documents\/D2\/$/)
    expect(callAt(fetchMock, 0).headers.Authorization).toBe('Bearer access')
    expect(createUrl).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(w.find('[data-test="import-source-open-error"]').exists()).toBe(false)
  })

  it('foto: si la descarga falla, error visible', async () => {
    mockFetch(jsonResponse({ detail: 'No encontrado.' }, 404))
    const w = mountPeek({ sourceRef: scanRef, sourceDocument: doc })
    await w.get('[data-test="import-source-open"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="import-source-open-error"]').text()).toBe(
      'No hemos podido descargar el documento. Inténtalo de nuevo.'
    )
  })
})
