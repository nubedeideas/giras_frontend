import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import ImportSourcePeek from './ImportSourcePeek.vue'
import { calendarActivityRow } from '@/test/importActivities'

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

describe('ImportSourcePeek · calendario (F3)', () => {
  it('"{archivo} · evento {row}", calendario, texto, UID truncado, repetición y versión', () => {
    const uid = `${'x'.repeat(60)}@google.com`
    const w = mountPeek({
      sourceRef: {
        ...calendarActivityRow().source_ref,
        uid,
        recurrence_id: '20261203T200000Z',
        sequence: 2,
      },
      timezone: 'Europe/Madrid',
    })
    expect(w.get('[data-test="import-source-where"]').text()).toBe('gira.ics · evento e12')
    expect(w.get('[data-test="import-source-context"]').text()).toBe('Calendario: Gira 2026')
    expect(w.get('[data-test="import-source-snippet"]').text()).toContain('SUMMARY:Show Madrid')
    const uidLine = w.get('[data-test="import-source-uid"]')
    expect(uidLine.attributes('title')).toBe(uid)
    expect(uidLine.classes()).toContain('break-all')
    expect(uidLine.text()).toBe(`UID ${'x'.repeat(48)}…`)
    const rec = w.get('[data-test="import-source-recurrence"]')
    expect(rec.text()).toBe('Repetición del jue 3 dic 21:00')
    expect(rec.get('.font-time').classes()).toContain('tnum')
    expect(w.get('[data-test="import-source-version"]').text()).toBe('Versión 2')
  })

  it('evento suelto: sin repetición ni versión 0', () => {
    const w = mountPeek({ sourceRef: calendarActivityRow().source_ref })
    expect(w.get('[data-test="import-source-uid"]').text()).toBe('UID abc-123@icloud.com')
    expect(w.find('[data-test="import-source-recurrence"]').exists()).toBe(false)
    expect(w.find('[data-test="import-source-version"]').exists()).toBe(false)
  })
})
