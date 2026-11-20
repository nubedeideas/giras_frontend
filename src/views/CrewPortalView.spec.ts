import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import i18n from '@/i18n'
import es from '@/i18n/es'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import CrewPortalView from './CrewPortalView.vue'

const TOKEN = `${'a'.repeat(32)}-1.${'b'.repeat(43)}`

const routeParams = vi.hoisted(() => ({ current: {} as Record<string, string | undefined> }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: routeParams.current }) }))

const authSpy = vi.hoisted(() => vi.fn())
vi.mock('@/stores/auth', async (orig) => {
  const mod = await orig<typeof import('@/stores/auth')>()
  return {
    ...mod,
    useAuthStore: (...args: unknown[]) => {
      authSpy()
      return (mod.useAuthStore as (...a: unknown[]) => unknown)(...args)
    },
  }
})

beforeAll(() => {
  vi.stubEnv('TZ', 'Pacific/Auckland')
})
afterAll(() => {
  vi.unstubAllEnvs()
})

function act(over: Record<string, unknown> = {}) {
  return {
    uuid: 'a1',
    title: 'Concierto',
    description: '',
    status: 'scheduled',
    all_day: false,
    activity_type: { code: 'show', name: 'Show', category: 'event', icon: 'mic', color: '#e85d00' },
    start_local: '2026-11-24T23:30:00+01:00',
    end_local: null,
    timezone: 'Europe/Madrid',
    end_timezone: null,
    location_name: 'Sala Apolo',
    location_address: '',
    destination_name: '',
    destination_address: '',
    maps_url: 'https://maps.google.com/?q=1,2',
    details: {},
    ...over,
  }
}

function portal(over: Record<string, unknown> = {}) {
  return {
    tour: {
      name: 'Gira Otoño',
      artist_name: 'Artista',
      status: 'active',
      start_date: '2026-11-20',
      end_date: '2026-11-30',
      start_city: 'Madrid',
      end_city: 'Barcelona',
      poster_url: null,
      contacts_text: 'TM: Marta 600 000 000',
    },
    contact: { first_name: 'Ana', display_name: 'Ana López' },
    timezone: 'Europe/Madrid',
    today: '2026-11-24',
    mode: 'live',
    range: { from: '2026-11-24', to: '2026-11-25' },
    days: [
      {
        date: '2026-11-24',
        is_today: true,
        activities: [
          act(),
          act({
            uuid: 'a2',
            title: 'Vuelo',
            status: 'delayed',
            start_local: '2026-11-24T20:00:00-06:00',
            timezone: 'America/Mexico_City',
            maps_url: null,
            details: { flight_number: 'AM1', driver_phone: '+34 600' },
          }),
        ],
      },
      { date: '2026-11-25', is_today: false, activities: [] },
    ],
    next_activity_date: null,
    documents: [
      {
        uuid: 'd1',
        description: 'Rider técnico',
        document_type: 'rider',
        document_type_display: 'Rider',
        file_name: 'rider.pdf',
        file_size: 2048,
        created_at: '2026-11-20T10:00:00Z',
        download_url: `http://api.test/api/crew/${TOKEN}/documents/d1/`,
      },
    ],
    expires_on: '2026-12-07',
    generated_at: '2026-11-24T10:00:00Z',
    ...over,
  }
}

function mountView() {
  return mount(CrewPortalView, { global: { plugins: [i18n, createHead()] } })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  authSpy.mockClear()
  routeParams.current = { token: TOKEN }
})

describe('CrewPortalView', () => {
  it('muestra el esqueleto mientras carga', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-testid="crew-loading"]').exists()).toBe(true)
  })

  it('pinta días, Hoy, día vacío, horas del offset, mapa y documentos', async () => {
    const fn = mockFetch(jsonResponse(portal()))
    const w = mountView()
    await flushPromises()

    expect(callAt(fn, 0).url).toBe(`http://api.test/api/crew/${TOKEN}/`)
    expect(w.text()).toContain('Hola, Ana')
    expect(w.text()).toContain('Gira Otoño')

    const days = w.findAll('[data-testid="crew-day"]')
    expect(days).toHaveLength(2)
    expect(days[0].text()).toContain('Hoy')
    expect(days[1].find('[data-testid="crew-day-empty"]').text()).toBe('Sin actividades')

    // Hora local del ISO, aunque el "navegador" esté en Auckland.
    const times = w.findAll('[data-testid="crew-time"]').map((t) => t.text())
    expect(times[0]).toBe('23:30')
    expect(times[1]).toMatch(/^20:00\s*(CST|GMT-6)$/)

    const status = w.findAll('[data-testid="crew-status"]')
    expect(status).toHaveLength(1)
    expect(status[0].text()).toBe('Retrasada')

    const map = w.findAll('[data-testid="crew-map"]')
    expect(map).toHaveLength(1)
    expect(map[0].attributes('href')).toBe('https://maps.google.com/?q=1,2')
    expect(map[0].attributes('rel')).toBe('noreferrer noopener')
    expect(map[0].attributes('target')).toBe('_blank')

    expect(w.find('a[href="tel:+34600"]').exists()).toBe(true)

    const dl = w.get('[data-testid="crew-download"]')
    expect(dl.attributes('href')).toBe(`http://api.test/api/crew/${TOKEN}/documents/d1/`)
    expect(dl.attributes('download')).toBeDefined()
    expect(dl.attributes('rel')).toBe('noreferrer noopener')
    expect(dl.attributes('target')).toBe('_blank')

    expect(w.get('[data-testid="crew-contacts"]').text()).toContain('TM: Marta')
    // noindex y no-referrer por meta (unhead pinta en el <head> del documento).
    await new Promise((r) => setTimeout(r, 20))
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe(
      'no-referrer'
    )
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow'
    )
    expect(document.title).toBe('Mi agenda · Gira Otoño')
    // Sin sesión: la vista no toca el store de auth.
    expect(authSpy).not.toHaveBeenCalled()
  })

  it('sin actividades en el rango muestra la próxima y oculta documentos vacíos', async () => {
    mockFetch(
      jsonResponse(
        portal({
          mode: 'upcoming',
          days: [{ date: '2026-11-24', is_today: true, activities: [] }],
          next_activity_date: '2026-12-02',
          documents: [],
        })
      )
    )
    const w = mountView()
    await flushPromises()
    expect(w.get('[data-testid="crew-next-activity"]').text()).toBe('Próxima actividad: 2 dic 2026')
    expect(w.get('[data-testid="crew-mode"]').text()).toBe('La gira empieza el 20 nov 2026')
    expect(w.find('[data-testid="crew-documents"]').exists()).toBe(false)
  })

  it('modo finished avisa de la caducidad', async () => {
    mockFetch(jsonResponse(portal({ mode: 'finished' })))
    const w = mountView()
    await flushPromises()
    expect(w.get('[data-testid="crew-mode"]').text()).toBe(
      'La gira terminó el 30 nov 2026. Este enlace caduca el 7 dic 2026.'
    )
  })

  const cases: [string, Response][] = [
    ['invalid', jsonResponse({ code: 'invalid', detail: 'x' }, 404)],
    ['revoked', jsonResponse({ code: 'revoked', detail: 'x' }, 410)],
    ['expired', jsonResponse({ code: 'expired', detail: 'x' }, 410)],
    ['disabled', jsonResponse({ code: 'disabled', detail: 'x' }, 410)],
    ['tour_cancelled', jsonResponse({ code: 'tour_cancelled', detail: 'x' }, 410)],
    ['unavailable', jsonResponse({ code: 'unavailable', detail: 'x' }, 410)],
    ['rate_limited', jsonResponse({ success: false, error: { message: 'x' } }, 429)],
    ['network', new Response('x', { status: 500 })],
  ]

  it.each(cases)('estado de error %s con su texto', async (code, res) => {
    mockFetch(res)
    const w = mountView()
    await flushPromises()
    const box = w.get('[data-testid="crew-error"]')
    expect(box.attributes('data-code')).toBe(code)
    const texts = es.crewPortal.errors as Record<string, string>
    expect(box.text()).toContain(texts[code])
    const retryable = code === 'network' || code === 'rate_limited'
    expect(w.find('[data-testid="crew-retry"]').exists()).toBe(retryable)
  })

  it('/crew/ sin token muestra invalid sin llamar a la API', async () => {
    routeParams.current = { pathMatch: undefined }
    const fn = mockFetch()
    const w = mountView()
    await flushPromises()
    expect(fn).not.toHaveBeenCalled()
    expect(w.get('[data-testid="crew-error"]').attributes('data-code')).toBe('invalid')
  })

  it('fin el día anterior en otra zona muestra −1 y la hora en su propia línea', async () => {
    mockFetch(
      jsonResponse(
        portal({
          days: [
            {
              date: '2026-11-24',
              is_today: true,
              activities: [
                act({
                  start_local: '2026-11-24T00:30:00+01:00',
                  end_local: '2026-11-23T20:30:00-05:00',
                  end_timezone: 'America/New_York',
                }),
              ],
            },
          ],
        })
      )
    )
    const w = mountView()
    await flushPromises()
    expect(w.get('[data-testid="crew-day-offset"]').text()).toBe('\u22121')
    expect(w.get('[data-testid="crew-time"]').classes()).toContain('text-left')
  })

  it('Reintentar vuelve a pedir el portal', async () => {
    const fn = mockFetch(new Response('x', { status: 503 }), jsonResponse(portal()))
    const w = mountView()
    await flushPromises()
    await w.get('[data-testid="crew-retry"]').trigger('click')
    await flushPromises()
    expect(fn).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('Hola, Ana')
  })

  it('Actualizar recarga y, si falla la red, conserva la agenda con un aviso', async () => {
    mockFetch(jsonResponse(portal()), new Response('x', { status: 503 }))
    const w = mountView()
    await flushPromises()
    await w.get('[data-testid="crew-refresh"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="crew-day"]')).toHaveLength(2)
    expect(w.get('[data-testid="crew-refresh-error"]').text()).toBe(es.crewPortal.errors.network)
  })
})
