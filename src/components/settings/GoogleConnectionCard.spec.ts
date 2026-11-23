import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import GoogleConnectionCard from './GoogleConnectionCard.vue'

const cfg = vi.hoisted(() => ({ configured: false }))
vi.mock('@/composables/useGooglePicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useGooglePicker')>()
  return { ...actual, isPickerConfigured: () => cfg.configured }
})

const redirectTo = vi.hoisted(() => vi.fn())
vi.mock('@/utils/navigation', () => ({ redirectTo }))

function status(features: {
  calendar: boolean
  calendar_write: boolean
  contacts: boolean
  sheets?: boolean
}) {
  const connected = features.calendar || features.contacts
  return {
    connected,
    account_email: connected ? 'tm@giras.pro' : '',
    granted_scopes: [],
    features,
    connected_at: connected ? '2026-11-20T10:00:00Z' : null,
  }
}

const NONE = status({ calendar: false, calendar_write: false, contacts: false })
const CAL = status({ calendar: true, calendar_write: true, contacts: false })

function setupFetch(initial: unknown, onDisconnect?: () => Response) {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.endsWith('/integrations/google/status/')) return jsonResponse(initial)
    if (url.endsWith('/integrations/google/disconnect/') && init?.method === 'DELETE') {
      return onDisconnect ? onDisconnect() : jsonResponse({ status: NONE, revoked_in_google: true, calendars_deactivated: 1, contacts_deactivated: 0 })
    }
    if (url.endsWith('/integrations/google/authorize/')) {
      return jsonResponse({ authorization_url: 'https://accounts.google.com/x', state: 'S', scopes: [] })
    }
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const calls = (fn: ReturnType<typeof setupFetch>) =>
  fn.mock.calls.map(([u, init]) => `${init?.method ?? 'GET'} ${String(u)}`)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  redirectTo.mockReset()
  cfg.configured = false
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountCard() {
  return mount(GoogleConnectionCard, {
    global: { plugins: [i18n], stubs: { transition: false } },
  })
}

describe('GoogleConnectionCard', () => {
  it('no conectado: dos botones de conectar con su consentimiento y sin desconectar', async () => {
    setupFetch(NONE)
    const w = mountCard()
    await flushPromises()
    expect(w.get('[data-testid="google-card-status"]').text()).toBe(
      'No has conectado ninguna cuenta de Google.'
    )
    expect(w.get('[data-testid="google-connect-calendar"]').text()).toBe('Conectar Google Calendar')
    expect(w.get('[data-testid="google-connect-contacts"]').text()).toBe('Conectar Google Contactos')
    expect(w.findAll('[data-testid="google-consent-text"]')).toHaveLength(2)
    expect(w.find('[data-testid="google-disconnect"]').exists()).toBe(false)
  })

  it('con calendar y sin contactos: conectado como, permisos, solo Contactos y Desconectar', async () => {
    setupFetch(CAL)
    const w = mountCard()
    await flushPromises()
    expect(w.get('[data-testid="google-card-status"]').text()).toContain(
      'Conectado como tm@giras.pro desde'
    )
    expect(w.get('[data-testid="google-scope-calendarRead"]').attributes('data-granted')).toBe('true')
    expect(w.get('[data-testid="google-scope-contactsRead"]').attributes('data-granted')).toBe('false')
    expect(w.find('[data-testid="google-connect-calendar"]').exists()).toBe(false)
    expect(w.find('[data-testid="google-connect-contacts"]').exists()).toBe(true)
    expect(w.find('[data-testid="google-disconnect"]').exists()).toBe(true)
  })

  it('desconectar pide confirmación y llama a la API solo al confirmar', async () => {
    const fn = setupFetch(CAL)
    const w = mountCard()
    await flushPromises()
    await w.get('[data-testid="google-disconnect"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="google-disconnect-confirm-body"]').text()).toContain(
      'Revocaremos el acceso de Giras en Google'
    )
    expect(calls(fn).some((c) => c.includes('/disconnect/'))).toBe(false)

    await w.get('[data-testid="google-disconnect-confirm"]').trigger('click')
    await flushPromises()
    expect(calls(fn)).toContain('DELETE http://api.test/api/integrations/google/disconnect/')
    expect(w.get('[data-testid="google-disconnect-feedback"]').text()).toBe(
      'Cuenta de Google desconectada.'
    )
    expect(w.get('[data-testid="google-card-status"]').text()).toBe(
      'No has conectado ninguna cuenta de Google.'
    )
    expect(w.emitted('disconnected')).toHaveLength(1)
  })

  it('error al desconectar: mensaje y sin evento', async () => {
    setupFetch(CAL, () => jsonResponse({ detail: 'x' }, 500))
    const w = mountCard()
    await flushPromises()
    await w.get('[data-testid="google-disconnect"]').trigger('click')
    await w.get('[data-testid="google-disconnect-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="google-disconnect-feedback"]').text()).toContain(
      'No hemos podido desconectar'
    )
    expect(w.emitted('disconnected')).toBeUndefined()
  })

  it('Conectar Google Contactos pide authorize con contacts y redirige', async () => {
    const fn = setupFetch(CAL)
    const w = mountCard()
    await flushPromises()
    await w.get('[data-testid="google-connect-contacts"]').trigger('click')
    await flushPromises()
    const call = fn.mock.calls.find(([u]) => String(u).endsWith('/authorize/'))
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      purpose: 'contacts',
      return_to: '/settings?tab=calendars',
    })
    expect(redirectTo).toHaveBeenCalledWith('https://accounts.google.com/x')
  })

  it('F4: con el selector configurado, fila "Leer las hojas que eliges" y "Conectar Google Sheets"', async () => {
    cfg.configured = true
    const fn = setupFetch(CAL)
    const w = mountCard()
    await flushPromises()
    expect(w.get('[data-testid="google-scope-sheetsRead"]').text()).toContain(
      'Leer las hojas que eliges'
    )
    expect(w.get('[data-testid="google-scope-sheetsRead"]').attributes('data-granted')).toBe('false')
    await w.get('[data-testid="google-connect-sheets"]').trigger('click')
    await flushPromises()
    const call = fn.mock.calls.find(([u]) => String(u).endsWith('/authorize/'))
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      purpose: 'sheets',
      return_to: '/settings?tab=calendars',
    })
  })

  it('F4: con el permiso concedido, la fila marcada y sin CTA; sin selector, ni fila ni CTA', async () => {
    cfg.configured = true
    setupFetch(status({ calendar: true, calendar_write: true, contacts: true, sheets: true }))
    const w = mountCard()
    await flushPromises()
    expect(w.get('[data-testid="google-scope-sheetsRead"]').attributes('data-granted')).toBe('true')
    expect(w.find('[data-testid="google-connect-sheets"]').exists()).toBe(false)
    w.unmount()

    cfg.configured = false
    setActivePinia(createPinia())
    setupFetch(CAL)
    const w2 = mountCard()
    await flushPromises()
    expect(w2.find('[data-testid="google-scope-sheetsRead"]').exists()).toBe(false)
    expect(w2.find('[data-testid="google-connect-sheets"]').exists()).toBe(false)
  })

  it('el texto de desconectar menciona calendarios y hojas', async () => {
    setupFetch(CAL)
    const w = mountCard()
    await flushPromises()
    await w.get('[data-testid="google-disconnect"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="google-disconnect-confirm-body"]').text()).toContain(
      'Tus calendarios y hojas dejarán de sincronizarse.'
    )
  })

  it('si el estado no carga: error y Reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => jsonResponse({}, 500)))
    const w = mountCard()
    await flushPromises()
    expect(w.find('[data-testid="google-card-error"]').exists()).toBe(true)
    expect(w.get('[data-testid="google-card-error"]').text()).toContain('Reintentar')
  })
})
