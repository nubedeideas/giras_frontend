import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import type { ImportDetectedSource } from '@/composables/useImportJobs'
import ImportDeferredNotice from './ImportDeferredNotice.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

const src = (o: Partial<ImportDetectedSource>): ImportDetectedSource => ({
  ref: 'd1',
  document_uuid: 'D1',
  filename: 'Dossier_MAD.pdf',
  kind: 'pdf_text',
  sheet: null,
  doc_kind: 'mixed',
  processed: true,
  deferred: false,
  deferred_reason: null,
  rows_scanned: 10,
  truncated: false,
  people_found: 14,
  ...o,
})

describe('ImportDeferredNotice', () => {
  it('fuentes enteras y tramos de páginas de un PDF', () => {
    const w = mount(ImportDeferredNotice, {
      props: {
        job: {
          detected: {
            sources: [
              src({ deferred_pages: [{ pages: [3, 4, 5, 6, 7, 8], reason: 'itinerary_coming_soon' }] }),
              src({
                ref: 'd2',
                document_uuid: 'D2',
                filename: 'gira.ics',
                kind: 'ics',
                processed: false,
                deferred: true,
                deferred_reason: 'calendar_coming_soon',
              }),
            ],
          },
        },
      },
      global: { plugins: [i18n] },
    })
    const lines = w.findAll('[data-test="import-deferred-line"]').map((l) => l.text())
    expect(lines).toEqual([
      'Dossier_MAD.pdf, páginas 3-8: itinerario; la importación de actividades llegará pronto.',
      'gira.ics: la importación de calendarios llegará pronto. Lo tienes en Documentos.',
    ])
  })

  it('sin diferidas no pinta nada', () => {
    const w = mount(ImportDeferredNotice, {
      props: { job: { detected: { sources: [src({})] } } },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-test="import-deferred"]').exists()).toBe(false)
  })
})

describe('ImportDeferredNotice · calendario (F3)', () => {
  it('.ics demasiado grande', () => {
    const w = mount(ImportDeferredNotice, {
      props: {
        job: {
          detected: {
            sources: [
              src({
                filename: 'gira.ics',
                kind: 'ics',
                doc_kind: 'calendar',
                processed: false,
                deferred: true,
                deferred_reason: 'ics_too_large',
              }),
            ],
          },
        },
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-deferred-line"]').text()).toBe(
      'gira.ics: el calendario es demasiado grande para importarlo.'
    )
  })
})
