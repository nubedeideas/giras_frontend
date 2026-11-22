import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import NotificationsPauseToggle from './NotificationsPauseToggle.vue'

function tour(over: Partial<Tour> = {}): Tour {
  return {
    id: 1,
    uuid: 'T1',
    name: 'Gira 2026',
    artist_name: 'Artista',
    start_date: '2026-11-01',
    end_date: '2026-12-30',
    status: 'active',
    currency: 'EUR',
    color: '#a8d800',
    owner_email: 'me@x.es',
    current_user_is_admin: true,
    timezone: 'Europe/Madrid',
    enable_notifications: true,
    notifications_paused_at: null,
    ...over,
  }
}

type Handler = (url: string) => Response

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

function setupFetch(routes: Record<string, Handler>) {
  fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    const key = Object.keys(routes).find((k) => url.includes(k))
    if (!key) throw new Error(`fetch no mockeado: ${url}`)
    return routes[key](url)
  })
  vi.stubGlobal('fetch', fetchMock)
}

function calls(fragment: string) {
  return fetchMock.mock.calls.filter(([u]) => String(u).includes(fragment))
}

function setup(over: Partial<Tour> = {}, { demo = false } = {}) {
  const auth = useAuthStore()
  auth.isDemoMode = demo
  const store = useToursStore()
  store.tours = [tour(over)]
  store.activeTourId = 1
  return store
}

function mountToggle() {
  const store = useToursStore()
  return mount(
    {
      components: { NotificationsPauseToggle },
      setup: () => ({ store }),
      template: '<NotificationsPauseToggle v-if="store.activeTour" :tour="store.activeTour" />',
    },
    { global: { plugins: [i18n] } }
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('NotificationsPauseToggle', () => {
  it('admin: interruptor con role="switch" y aria-checked', () => {
    setupFetch({})
    setup()
    const w = mountToggle()
    const sw = w.find('[data-testid="notif-pause-switch"]')
    expect(sw.attributes('role')).toBe('switch')
    expect(sw.attributes('aria-checked')).toBe('true')
    expect(sw.text()).toContain('Avisos activos')
    expect(w.find('[data-testid="notif-pause-badge"]').exists()).toBe(false)
  })

  it('pausar abre la confirmación y, al confirmar, llama a pause-notifications', async () => {
    setupFetch({
      '/tours/T1/pause-notifications/': () =>
        jsonResponse({
          enable_notifications: false,
          notifications_paused_at: '2026-11-22T10:00:00Z',
          changed: true,
          held: 2,
        }),
    })
    const store = setup()
    const w = mountToggle()
    await w.find('[data-testid="notif-pause-switch"]').trigger('click')
    expect(calls('pause-notifications')).toHaveLength(0)
    const confirm = w.find('[data-testid="notif-pause-confirm"]')
    expect(confirm.text()).toContain('¿Pausar los avisos de Gira 2026?')

    await w.find('[data-testid="notif-pause-confirm-btn"]').trigger('click')
    await flushPromises()
    expect(calls('/tours/T1/pause-notifications/')).toHaveLength(1)
    expect(calls('/tours/T1/pause-notifications/')[0][1]?.method).toBe('POST')
    expect(store.activeTour?.enable_notifications).toBe(false)
    expect(store.activeTour?.notifications_paused_at).toBe('2026-11-22T10:00:00Z')
    const sw = w.find('[data-testid="notif-pause-switch"]')
    expect(sw.attributes('aria-checked')).toBe('false')
    expect(w.find('[data-testid="notif-pause-badge"]').text()).toBe('Avisos en pausa')
    expect(w.find('[data-testid="notif-pause-since"]').text()).toContain('En pausa desde el')
    expect(w.find('[data-testid="notif-pause-since"] .font-time').exists()).toBe(true)
    expect(w.find('[data-testid="notif-pause-info"]').text()).toBe(
      '2 avisos programados quedan retenidos'
    )
  })

  it('cancelar la confirmación no llama a la API', async () => {
    setupFetch({})
    setup()
    const w = mountToggle()
    await w.find('[data-testid="notif-pause-switch"]').trigger('click')
    await w.find('[data-testid="notif-pause-cancel"]').trigger('click')
    expect(w.find('[data-testid="notif-pause-confirm"]').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reanudar llama sin confirmación y pinta cancelledCount si cancelled > 0', async () => {
    setupFetch({
      '/tours/T1/resume-notifications/': () =>
        jsonResponse({
          enable_notifications: true,
          notifications_paused_at: null,
          changed: true,
          cancelled: 3,
          released: 5,
        }),
      '/notifications/reminder-settings/': () => jsonResponse({}, 404),
    })
    const store = setup({ enable_notifications: false, notifications_paused_at: '2026-11-22T10:00:00Z' })
    const w = mountToggle()
    expect(w.find('[data-testid="notif-pause-switch"]').attributes('aria-checked')).toBe('false')
    await w.find('[data-testid="notif-pause-switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="notif-pause-confirm"]').exists()).toBe(false)
    expect(calls('/tours/T1/resume-notifications/')).toHaveLength(1)
    expect(store.activeTour?.enable_notifications).toBe(true)
    expect(store.activeTour?.notifications_paused_at).toBeNull()
    const info = w.findAll('[data-testid="notif-pause-info"]').map((p) => p.text())
    expect(info).toEqual([
      'Avisos reanudados.',
      '3 avisos que tocaban durante la pausa se han cancelado.',
    ])
  })

  it('reanudar sin vencidas solo dice "Avisos reanudados."', async () => {
    setupFetch({
      '/tours/T1/resume-notifications/': () =>
        jsonResponse({
          enable_notifications: true,
          notifications_paused_at: null,
          changed: true,
          cancelled: 0,
          released: 1,
        }),
    })
    setup({ enable_notifications: false, notifications_paused_at: '2026-11-22T10:00:00Z' })
    const w = mountToggle()
    await w.find('[data-testid="notif-pause-switch"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="notif-pause-info"]').map((p) => p.text())).toEqual([
      'Avisos reanudados.',
    ])
  })

  it('403 → mensaje de solo administradores, sin código crudo', async () => {
    setupFetch({
      '/tours/T1/resume-notifications/': () =>
        jsonResponse({ detail: 'You do not have permission' }, 403),
    })
    const store = setup({ enable_notifications: false, notifications_paused_at: '2026-11-22T10:00:00Z' })
    const w = mountToggle()
    await w.find('[data-testid="notif-pause-switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="notif-pause-error"]').text()).toBe(
      'Solo un administrador de la gira puede pausar o reanudar los avisos.'
    )
    expect(store.activeTour?.enable_notifications).toBe(false)
  })

  it('otro error → mensaje genérico', async () => {
    setupFetch({ '/tours/T1/pause-notifications/': () => jsonResponse({}, 500) })
    setup()
    const w = mountToggle()
    await w.find('[data-testid="notif-pause-switch"]').trigger('click')
    await w.find('[data-testid="notif-pause-confirm-btn"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="notif-pause-error"]').text()).toBe(
      'No se han podido cambiar los avisos. Inténtalo de nuevo.'
    )
  })

  it('no admin en pausa: solo el badge, sin interruptor', () => {
    setupFetch({})
    setup({ current_user_is_admin: false, enable_notifications: false })
    const w = mountToggle()
    expect(w.find('[data-testid="notif-pause-switch"]').exists()).toBe(false)
    expect(w.find('[data-testid="notif-pause-badge"]').exists()).toBe(true)
  })

  it('no admin con avisos activos: no pinta nada', () => {
    setupFetch({})
    setup({ current_user_is_admin: false })
    const w = mountToggle()
    expect(w.find('[data-testid="notif-pause"]').exists()).toBe(false)
  })

  it('demo: no renderiza el interruptor', () => {
    setupFetch({})
    setup({}, { demo: true })
    const w = mountToggle()
    expect(w.find('[data-testid="notif-pause-switch"]').exists()).toBe(false)
  })
})
