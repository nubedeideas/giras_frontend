import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import CalendarsManager from './CalendarsManager.vue'

const redirectTo = vi.hoisted(() => vi.fn())
vi.mock('@/utils/navigation', () => ({ redirectTo }))

const SCOPE_MISSING = {
  code: 'google_scope_missing',
  detail: 'Necesitas conectar Google Calendar para usar esta función.',
  purpose: 'calendar',
  required_scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  connected: true,
}

function status(calendar: boolean) {
  return {
    connected: true,
    account_email: 'tm@giras.pro',
    granted_scopes: [],
    features: { calendar, contacts: false },
    connected_at: '2026-11-20T10:00:00Z',
  }
}

const SUB = {
  id: 1,
  calendar_id: 'primary',
  calendar_name: 'Gira',
  is_active: false,
  sync_enabled: false,
  last_synced_at: null,
  webhook_status: 'not_registered',
  has_valid_webhook: false,
  error_count: 0,
  last_error: '',
}

function setupFetch(opts: { calendar: boolean; googleCalendars?: () => Response; subs?: unknown[] }) {
  const fn = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    if (url.endsWith('/integrations/google/status/')) return jsonResponse(status(opts.calendar))
    if (url.endsWith('/integrations/calendars/google_calendars/')) {
      return opts.googleCalendars
        ? opts.googleCalendars()
        : jsonResponse([{ id: 'primary', summary: 'Mi calendario', description: '', primary: true, access_role: 'owner' }])
    }
    if (url.endsWith('/integrations/calendars/')) return jsonResponse(opts.subs ?? [])
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const urls = (fn: ReturnType<typeof setupFetch>) => fn.mock.calls.map(([u]) => String(u))

async function mountAt(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push({ path: '/settings', query: { tab: 'calendars', ...query } })
  await router.isReady()
  const w = mount(CalendarsManager, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CalendarsManager', () => {
  it('sin features.calendar: CTA "Conectar Google Calendar" y no pide google_calendars', async () => {
    const fn = setupFetch({ calendar: false })
    const w = await mountAt()
    expect(w.get('[data-testid="google-connect-calendar"]').text()).toBe('Conectar Google Calendar')
    // La tarjeta "Cuenta de Google" de encima ya muestra el consentimiento: aquí, versión compacta.
    expect(w.find('[data-testid="google-consent-text"]').exists()).toBe(false)
    expect(w.text()).toContain('Para usar esta función, conecta Google Calendar.')
    expect(w.find('[data-testid="calendar-open-form"]').exists()).toBe(false)
    expect(urls(fn).some((u) => u.includes('google_calendars'))).toBe(false)
  })

  it('403 google_scope_missing al listar calendarios → CTA', async () => {
    const fn = setupFetch({
      calendar: true,
      googleCalendars: () => jsonResponse(SCOPE_MISSING, 403),
    })
    const w = await mountAt()
    await w.get('[data-testid="calendar-open-form"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="calendar-connect-form"]').exists()).toBe(false)
    expect(w.find('[data-testid="google-connect-calendar"]').exists()).toBe(true)
    // El estado sigue diciendo que hay Calendar: la tarjeta no enseña su CTA, aquí va completo.
    const consent = w.get('[data-testid="google-consent-text"]').text()
    expect(consent).toContain('Solo los leemos')
    expect(consent).not.toContain('marca')
    // Refresca el estado tras el 403.
    expect(urls(fn).filter((u) => u.endsWith('/google/status/')).length).toBe(2)
  })

  it('con google_connect=ok&purpose=calendar abre el formulario con los calendarios', async () => {
    setupFetch({ calendar: true })
    const w = await mountAt({ google_connect: 'ok', purpose: 'calendar' })
    expect(w.find('[data-testid="calendar-connect-form"]').exists()).toBe(true)
    expect(w.text()).toContain('Mi calendario')
  })

  it('suscripción desactivada: pill Desactivado y sin sincronizar', async () => {
    setupFetch({ calendar: false, subs: [SUB] })
    const w = await mountAt()
    expect(w.get('[data-testid="calendar-disabled"]').text()).toBe('Desactivado')
    expect(w.text()).not.toContain('Sincronizar ahora')
  })

  it('"(recomendado)" tras "calendario exclusivo por gira" en ES y EN', async () => {
    setupFetch({ calendar: false })
    const w = await mountAt()
    expect(w.get('[data-test="calendars-recommended"]').text()).toBe('(recomendado)')
    expect(w.get('[data-test="calendars-how"]').text()).toContain(
      'calendario exclusivo por gira (recomendado) — útil si'
    )

    i18n.global.locale.value = 'en'
    const en = await mountAt()
    expect(en.get('[data-test="calendars-recommended"]').text()).toBe('(recommended)')
    expect(en.get('[data-test="calendars-how"]').text()).toContain(
      'tour-specific calendar (recommended)'
    )
  })
})
