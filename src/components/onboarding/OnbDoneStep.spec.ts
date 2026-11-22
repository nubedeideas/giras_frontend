import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import OnbDoneStep from './OnbDoneStep.vue'

const TOUR = {
  id: 1,
  uuid: 'T1',
  name: 'Gira 2026',
  artist_name: 'Artista',
  start_date: '2026-12-01',
  end_date: '2026-12-20',
  events_count: 0,
} as Tour

const page = (n: number) => ({
  count: n,
  next: null,
  previous: null,
  results: Array.from({ length: n }, (_, i) => ({ uuid: `C${i}`, full_name: `P${i}` })),
})

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

function setupFetch(response: () => Response) {
  fetchMock = vi.fn<typeof fetch>(async () => response())
  vi.stubGlobal('fetch', fetchMock)
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  useToursStore().tours = [TOUR]
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('OnbDoneStep: Equipo de la gira (F0 A4)', () => {
  it('pinta el recuento de GET /contacts/?tour=', async () => {
    setupFetch(() => jsonResponse(page(3)))
    const w = mount(OnbDoneStep, { props: { tourId: 1 }, global: { plugins: [i18n] } })
    await flushPromises()
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toMatch(/\/contacts\/$/)
    expect(url.searchParams.get('tour')).toBe('T1')
    expect(w.get('[data-testid="onb-done-team"]').text()).toBe(
      '3 personas en el Equipo de la gira'
    )
  })

  it('singular con una persona', async () => {
    setupFetch(() => jsonResponse(page(1)))
    const w = mount(OnbDoneStep, { props: { tourId: 1 }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.get('[data-testid="onb-done-team"]').text()).toBe('1 persona en el Equipo de la gira')
  })

  it('si la carga falla se oculta la cifra y se puede terminar', async () => {
    setupFetch(() => jsonResponse({}, 500))
    const w = mount(OnbDoneStep, { props: { tourId: 1 }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('[data-testid="onb-done-team"]').exists()).toBe(false)
    await w.get('button').trigger('click')
    expect(w.emitted('finish')).toHaveLength(1)
  })
})
