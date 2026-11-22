import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import ImportSourcePeek from './ImportSourcePeek.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('ImportSourcePeek', () => {
  it('texto: archivo y página, cabecera de contexto y fragmento; sin enlace', () => {
    const w = mount(ImportSourcePeek, {
      props: { sourceRef: activityRow().source_ref, documentUrl: 'https://app.giras.pro/d/D2' },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-source-where"]').text()).toBe('Itinerario_MAD.pdf, página 3')
    expect(w.get('[data-test="import-source-context"]').text()).toBe('Cabecera: DAY 3 — MADRID — Wed 3 Dec')
    expect(w.get('[data-test="import-source-snippet"]').text()).toBe(
      'Wed 3 Dec · 10:30 · IB3456 MAD-BCN · Loc. ABC12'
    )
    expect(w.find('[data-test="import-source-open"]').exists()).toBe(false)
  })

  it('hoja: archivo, hoja y fila', () => {
    const w = mount(ImportSourcePeek, {
      props: {
        sourceRef: { ...activityRow().source_ref, kind: 'spreadsheet', sheet: 'Flights', row: 'Flights!4', page: null },
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-source-where"]').text()).toBe('Itinerario_MAD.pdf, Flights · Flights!4')
  })

  it('foto: sin texto, enlace al documento con la página', () => {
    const w = mount(ImportSourcePeek, {
      props: {
        sourceRef: { ...activityRow().source_ref, kind: 'pdf_scan', snippet: '', context: null, page: 2 },
        documentUrl: 'https://app.giras.pro/d/D2',
      },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-test="import-source-snippet"]').exists()).toBe(false)
    const link = w.get('[data-test="import-source-open"]')
    expect(link.attributes('href')).toBe('https://app.giras.pro/d/D2')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.text()).toContain('Abrir documento')
    expect(link.text()).toContain('página 2')
  })
})
