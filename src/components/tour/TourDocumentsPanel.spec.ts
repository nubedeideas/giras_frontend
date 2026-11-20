import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import TourDocumentsPanel from './TourDocumentsPanel.vue'

function doc(uuid: string, visible = false) {
  return {
    uuid,
    file: `https://x/${uuid}.pdf`,
    description: `Doc ${uuid}`,
    document_type: 'rider',
    document_type_display: 'Rider',
    uploaded_by_name: 'Ana',
    file_size: 100,
    created_at: '2026-11-20T10:00:00Z',
    visible_to_crew: visible,
  }
}

const docs = [doc('d1'), doc('d2', true)]

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountPanel(isAdmin = true) {
  return mount(TourDocumentsPanel, {
    props: { tourUuid: 'T1', isAdmin },
    global: { plugins: [i18n] },
  })
}

describe('TourDocumentsPanel (crew)', () => {
  it('un error del interruptor sale junto al documento y no oculta la lista', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (_input, init) =>
        init?.method === 'PATCH'
          ? jsonResponse({ detail: 'No se puede cambiar.' }, 400)
          : jsonResponse({ count: 2, next: null, previous: null, results: docs })
      )
    )
    const w = mountPanel()
    await flushPromises()
    const switches = w.findAll('[data-testid="doc-crew-switch"]')
    expect(switches).toHaveLength(2)
    await switches[0].trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="doc-crew-switch"]')).toHaveLength(2)
    const errors = w.findAll('[data-testid="doc-crew-error"]')
    expect(errors).toHaveLength(1)
    expect(errors[0].text()).toBe('No se puede cambiar.')
    // Se deshace el cambio optimista.
    expect(w.findAll('[data-testid="doc-crew-switch"]')[0].attributes('aria-checked')).toBe('false')
  })

  it('un PATCH en curso solo bloquea su propio interruptor', async () => {
    const patches: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input, init) => {
        if (init?.method === 'PATCH') {
          patches.push(String(input))
          return new Promise<Response>(() => {})
        }
        return jsonResponse({ count: 2, next: null, previous: null, results: docs })
      })
    )
    const w = mountPanel()
    await flushPromises()
    await w.findAll('[data-testid="doc-crew-switch"]')[0].trigger('click')
    await flushPromises()
    const switches = w.findAll('[data-testid="doc-crew-switch"]')
    expect(switches[0].attributes('disabled')).toBeDefined()
    expect(switches[1].attributes('disabled')).toBeUndefined()
    await switches[1].trigger('click')
    await flushPromises()
    expect(patches).toEqual([
      'http://api.test/api/tours/T1/documents/d1/',
      'http://api.test/api/tours/T1/documents/d2/',
    ])
  })

  it('quien no es admin ve la píldora Crew y ningún interruptor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ count: 2, next: null, previous: null, results: docs })
      )
    )
    const w = mountPanel(false)
    await flushPromises()
    expect(w.find('[data-testid="doc-crew-switch"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="doc-crew-badge"]')).toHaveLength(1)
  })
})
