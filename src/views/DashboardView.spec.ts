import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { DateTime } from 'luxon'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { useActivitiesStore } from '@/stores/activities'
import { jsonResponse } from '@/test/http'
import { notice } from '@/test/notices'
import DashboardView from './DashboardView.vue'

const TOUR = 'T1'

const page = <T>(results: T[]) => ({ count: results.length, next: null, previous: null, results })

const SOON = DateTime.now().plus({ hours: 2 }).toUTC().toISO()!

const ACTIVITY = {
  uuid: 'A1',
  title: 'Concierto en Madrid',
  scheduled_at: SOON,
  end_at: null,
  timezone: 'Europe/Madrid',
  local_start_time: null,
  status: 'scheduled',
  priority: 'normal',
  all_day: false,
  location_name: 'WiZink',
  destination_name: '',
  activity_type_name: 'Concierto',
  activity_type_code: 'concert',
  activity_type_icon: '',
  activity_type_color: '#000',
  category: 'show',
  ai_review: null,
}

const USAGE = {
  plan_code: 'basic',
  plan_name: 'Básico',
  notifications_used: 312,
  notification_limit: 500,
  remaining: 188,
  usage_percentage: 62.4,
  is_unlimited: false,
  shows_used: 3,
  shows_limit: 10,
  is_active: true,
}

const metrics = { recipients: 3, pending: 0, sent: 3, delivered: 2, read: 1, confirmed: 0, failed: 1 }
const SUMMARY = {
  filters: { tour: TOUR, from: '2026-11-16', to: '2026-11-22', tz: 'UTC', channel: null },
  totals: { ...metrics, confirmable_sent: 0 },
  rates: { delivery_rate: null, read_rate: null, confirmation_rate: null },
  notifications: {
    total: 2,
    by_status: { draft: 0, scheduled: 0, sending: 0, sent: 2, failed: 0, cancelled: 0 },
  },
  by_channel: [],
  by_type: [],
  by_tour: [],
  series: [
    { date: '2026-11-21', sent: 1, delivered: 1, read: 0, confirmed: 0, failed: 0 },
    { date: '2026-11-22', sent: 2, delivered: 1, read: 1, confirmed: 0, failed: 1 },
  ],
  top_failed_contacts: [],
  failure_reasons: [],
  recent_notifications: [],
}

const CATALOG = {
  tour: { uuid: TOUR, name: 'Gira' },
  default_group: null,
  groups: [],
  types: [
    {
      activity_type_code: 'concert',
      name: 'Concierto',
      category: 'show',
      icon: '',
      color: '#000',
      template_steps: [],
      tour_steps: null,
      effective_steps: [{ minutes: 60, channel: 'whatsapp' }],
      steps_source: 'user',
      groups: [],
      base_source: 'admins',
      replaced_by_legacy_rule: false,
      warnings: ['no_base_groups'],
    },
  ],
  limits: {},
  plan: null,
}

const INBOX_ITEM = {
  uuid: 'I1',
  kind: 'message',
  severity: 'info',
  title: 'Mensaje de prueba',
  body: '',
  params: {},
  is_read: false,
  read_at: null,
  occurred_at: '2026-11-22T08:00:00Z',
  created_at: '2026-11-22T08:00:00Z',
  tour: { uuid: TOUR, name: 'Gira' },
  target: { type: 'none', tour_uuid: TOUR, activity_uuid: null, conflict_uuid: null },
}

type Handler = () => Response
type Routes = Record<string, Handler>

const ROUTES: Routes = {
  'ai_review=pending': () => jsonResponse(page([])),
  '/events/activities/': () => jsonResponse(page([ACTIVITY])),
  '/subscription/usage/': () => jsonResponse(USAGE),
  '/notifications/reports/summary/': () => jsonResponse(SUMMARY),
  '/notifications/inbox/': () => jsonResponse(page([INBOX_ITEM])),
  '/notifications/reminder-settings/': () => jsonResponse(CATALOG),
  '/notifications/notices/': () => jsonResponse(page([notice({ uuid: 'N1', tour: TOUR })])),
  '/notifications/recipient-overrides/': () => jsonResponse(page([])),
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

function setupFetch(overrides: Routes = {}) {
  const routes = { ...ROUTES, ...overrides }
  // Orden: las claves más específicas primero (ai_review antes que el listado de actividades).
  const keys = Object.keys(routes)
  fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    const key = keys.find((k) => url.includes(k))
    if (!key) throw new Error(`fetch no mockeado: ${url}`)
    return routes[key]()
  })
  vi.stubGlobal('fetch', fetchMock)
}

function calls(fragment: string): string[] {
  return fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes(fragment))
}

function setupStores({ admin = true, tour = true, demo = false, paused = false } = {}) {
  const auth = useAuthStore()
  auth.user = { email: 'me@x.es', first_name: 'Oscar', full_name: 'Oscar Cortés' } as never
  auth.isDemoMode = demo
  const tours = useToursStore()
  tours.tours = [
    {
      id: 1,
      uuid: TOUR,
      name: 'Gira 2026',
      artist_name: 'Artista',
      start_date: '2026-11-01',
      end_date: '2026-12-30',
      status: 'active',
      currency: 'EUR',
      color: '#a8d800',
      current_user_is_admin: admin,
      timezone: 'Europe/Madrid',
      enable_notifications: !paused,
      notifications_paused_at: paused ? '2026-11-22T08:00:00Z' : null,
    } as never,
  ]
  if (tour) tours.activeTourId = 1
}

const stubs = {
  TourSelectPrompt: { template: '<div data-testid="tour-select-prompt" />' },
  AddActivityModal: true,
  CreateActivityModal: {
    props: ['show'],
    template: '<div data-testid="create-modal" :data-show="String(show)" />',
  },
  ImportCalActivitiesModal: {
    props: ['show'],
    template: '<div data-testid="import-modal" :data-show="String(show)" />',
  },
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/home', name: 'home', component: DashboardView },
      { path: '/:p(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/home')
  await router.isReady()
  const w = mount({ template: '<RouterView />' }, { global: { plugins: [router, i18n], stubs } })
  await flushPromises()
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DashboardView', () => {
  it('cabecera: el admin ve el interruptor de avisos y pausar llama a la API', async () => {
    setupFetch({
      '/tours/T1/pause-notifications/': () =>
        jsonResponse({
          enable_notifications: false,
          notifications_paused_at: '2026-11-22T09:00:00Z',
          changed: true,
          held: 0,
        }),
    })
    setupStores()
    const w = await mountView()
    const header = w.find('header')
    const sw = header.find('[data-testid="notif-pause-switch"]')
    expect(sw.exists()).toBe(true)
    expect(sw.attributes('aria-checked')).toBe('true')
    await sw.trigger('click')
    await w.find('[data-testid="notif-pause-confirm-btn"]').trigger('click')
    await flushPromises()
    expect(calls('/tours/T1/pause-notifications/')).toHaveLength(1)
    expect(header.find('[data-testid="notif-pause-switch"]').attributes('aria-checked')).toBe(
      'false'
    )
    // "Por resolver" avisa de la pausa con "Reanudar".
    const item = w.find('[data-testid="pending-item-notifications-paused"]')
    expect(item.text()).toContain('Los avisos de esta gira están en pausa')
    expect(item.find('[data-testid="pending-action"]').text()).toBe('Reanudar')
  })

  it('gira en pausa: "Reanudar" en Por resolver llama a resume-notifications', async () => {
    setupFetch({
      '/tours/T1/resume-notifications/': () =>
        jsonResponse({
          enable_notifications: true,
          notifications_paused_at: null,
          changed: true,
          cancelled: 1,
          released: 2,
        }),
    })
    setupStores({ paused: true })
    const w = await mountView()
    const pending = w.find('[data-testid="dashboard-pending"]')
    const items = pending.findAll('li')
    expect(items[0].attributes('data-testid')).toBe('pending-item-notifications-paused')
    await items[0].find('[data-testid="pending-action"]').trigger('click')
    await flushPromises()
    expect(calls('/tours/T1/resume-notifications/')).toHaveLength(1)
    expect(w.find('[data-testid="pending-item-notifications-paused"]').exists()).toBe(false)
    expect(w.find('header [data-testid="notif-pause-badge"]').exists()).toBe(false)
  })

  it('member con la gira en pausa: badge sin interruptor y fila sin botón', async () => {
    setupFetch()
    setupStores({ admin: false, paused: true })
    const w = await mountView()
    expect(w.find('header [data-testid="notif-pause-switch"]').exists()).toBe(false)
    expect(w.find('header [data-testid="notif-pause-badge"]').exists()).toBe(true)
    const item = w.find('[data-testid="pending-item-notifications-paused"]')
    expect(item.exists()).toBe(true)
    expect(item.find('[data-testid="pending-action"]').exists()).toBe(false)
    expect(item.find('[data-testid="pending-cta"]').exists()).toBe(false)
  })

  it('sin gira enseña el selector y no llama a la API', async () => {
    setupFetch()
    setupStores({ tour: false })
    const w = await mountView()
    expect(w.find('[data-testid="tour-select-prompt"]').exists()).toBe(true)
    expect(w.find('[data-testid="dashboard-pending"]').exists()).toBe(false)
    expect(calls('/subscription/usage/')).toHaveLength(0)
    expect(calls('/notifications/')).toHaveLength(0)
  })

  it('gira sin actividades: CTA que abre crear actividad e importar de Calendar', async () => {
    setupFetch({ '/events/activities/': () => jsonResponse(page([])) })
    setupStores()
    const w = await mountView()
    expect(w.find('[data-testid="dashboard-empty-tour"]').exists()).toBe(true)
    expect(w.find('[data-testid="dashboard-pending"]').exists()).toBe(false)
    await w.find('[data-testid="empty-add"]').trigger('click')
    expect(w.find('[data-testid="create-modal"]').attributes('data-show')).toBe('true')
    await w.find('[data-testid="empty-calendar"]').trigger('click')
    expect(w.find('[data-testid="import-modal"]').attributes('data-show')).toBe('true')
  })

  it('admin con datos: pinta los 5 bloques con una petición por fuente', async () => {
    setupFetch()
    setupStores()
    const w = await mountView()
    for (const id of ['pending', 'upcoming', 'sends', 'inbox', 'plan']) {
      expect(w.find(`[data-testid="dashboard-${id}"]`).exists()).toBe(true)
    }
    expect(w.find('[data-testid="dashboard-greeting"]').text()).toBe('Hola, Oscar')
    // Por resolver: borrador de aviso y "sin Equipo de la gira" del catálogo.
    expect(w.find('[data-testid="pending-item-notices"]').text()).toContain('Revisar y enviar')
    expect(w.find('[data-testid="pending-item-audience:no_base_groups"]').text()).toContain(
      'Añadir equipo'
    )
    expect(w.find('[data-testid="dashboard-pending"] [data-testid="block-count"]').text()).toBe('2')
    // Próximas 24 h, envíos, bandeja y cupo.
    expect(w.findAll('[data-testid="upcoming-row"]')).toHaveLength(1)
    expect(w.find('[data-testid="upcoming-row"]').text()).toContain('Concierto en Madrid')
    expect(w.find('[data-testid="sends-sent"]').text()).toBe('3')
    expect(w.findAll('[data-testid="sends-bars"] li')).toHaveLength(2)
    expect(w.findAll('[data-testid="inbox-item"]')).toHaveLength(1)
    expect(w.find('[data-testid="plan-messages"]').text()).toMatch(/312\s+de\s+500\s+WhatsApp/)

    expect(calls('/subscription/usage/')).toHaveLength(1)
    expect(calls('/notifications/reports/summary/')).toHaveLength(1)
    expect(calls('/notifications/inbox/')).toHaveLength(1)
    expect(calls('/notifications/reminder-settings/')).toHaveLength(1)
    expect(calls('/notifications/notices/')).toHaveLength(1)
    expect(calls('ai_review=pending')).toHaveLength(1)
    expect(calls('/notifications/recipient-overrides/')).toHaveLength(1)
    expect(calls('/events/activities/').filter((u) => !u.includes('ai_review'))).toHaveLength(1)
    expect(w.text()).not.toContain('no_base_groups')
  })

  it('catálogo real de dev: Equipo vacío y admins sin teléfono aunque no haya actividades futuras', async () => {
    const warnings = ['default_group_empty', 'admins_without_phone', 'in_app_users_only']
    const realCatalog = {
      ...CATALOG,
      default_group: {
        uuid: 'G1',
        name: 'Equipo de la gira',
        contact_count: 0,
        system_key: 'tour_team',
        is_default: true,
      },
      types: Array.from({ length: 22 }, (_, i) => ({
        ...CATALOG.types[0],
        activity_type_code: `type_${i}`,
        name: `Tipo ${i}`,
        warnings,
      })),
    }
    const past = { ...ACTIVITY, scheduled_at: '2026-01-10T10:00:00Z', activity_type_code: 'type_0' }
    setupFetch({
      '/notifications/reminder-settings/': () => jsonResponse(realCatalog),
      '/notifications/notices/': () => jsonResponse(page([])),
      '/events/activities/': () => jsonResponse(page([past])),
    })
    setupStores()
    const w = await mountView()
    const pending = w.find('[data-testid="dashboard-pending"]')
    expect(pending.text()).not.toContain('Todo en orden')
    const team = w.find('[data-testid="pending-item-audience:default_group_empty"]')
    expect(team.text()).toContain('El Equipo de la gira está vacío.')
    expect(team.text()).toContain('Añadir equipo')
    expect(team.text()).not.toContain('Tipo 0')
    const phone = w.find('[data-testid="pending-item-audience:admins_without_phone"]')
    expect(phone.text()).toContain('administradores sin teléfono')
    expect(phone.text()).toContain('Completar')
    expect(w.find('[data-testid="pending-item-audience:in_app_users_only"]').exists()).toBe(false)
    expect(pending.findAll('li')).toHaveLength(2)
    expect(pending.find('[data-testid="block-count"]').text()).toBe('2')
  })

  it('un member no pide los endpoints de admin', async () => {
    setupFetch()
    setupStores({ admin: false })
    const w = await mountView()
    expect(calls('/notifications/reminder-settings/')).toHaveLength(0)
    expect(calls('/notifications/notices/')).toHaveLength(0)
    expect(calls('ai_review=pending')).toHaveLength(0)
    expect(calls('/notifications/recipient-overrides/')).toHaveLength(0)
    expect(calls('/subscription/usage/')).toHaveLength(1)
    expect(w.find('[data-testid="dashboard-pending"] [data-testid="block-empty"]').exists()).toBe(
      true
    )
  })

  it('403/404 de los endpoints de admin no enseñan error', async () => {
    const forbidden = () => jsonResponse({ detail: 'No' }, 403)
    setupFetch({
      '/notifications/reminder-settings/': forbidden,
      '/notifications/notices/': forbidden,
      '/notifications/recipient-overrides/': () => jsonResponse({ detail: 'No' }, 404),
      'ai_review=pending': forbidden,
    })
    setupStores()
    const w = await mountView()
    expect(w.find('[data-testid="pending-partial-error"]').exists()).toBe(false)
    expect(w.find('[data-testid="dashboard-pending"] [data-testid="block-error"]').exists()).toBe(
      false
    )
    expect(w.find('[data-testid="dashboard-pending"] [data-testid="block-empty"]').exists()).toBe(
      true
    )
  })

  it('un 500 de una fuente de admin deja el aviso de carga parcial con reintentar', async () => {
    setupFetch({ '/notifications/reminder-settings/': () => jsonResponse({}, 500) })
    setupStores()
    const w = await mountView()
    expect(w.find('[data-testid="pending-partial-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="pending-item-notices"]').exists()).toBe(true)
  })

  it('404 en el resumen: error del bloque con reintentar y el resto sigue', async () => {
    setupFetch({ '/notifications/reports/summary/': () => jsonResponse({ detail: 'x' }, 404) })
    setupStores()
    const w = await mountView()
    const sends = w.find('[data-testid="dashboard-sends"]')
    expect(sends.find('[data-testid="block-error"]').text()).toContain(
      'No se ha podido cargar este bloque.'
    )
    expect(sends.text()).not.toContain('404')
    expect(w.find('[data-testid="upcoming-row"]').exists()).toBe(true)
    expect(w.find('[data-testid="plan-messages"]').exists()).toBe(true)

    await sends.find('[data-testid="block-retry"]').trigger('click')
    await flushPromises()
    expect(calls('/notifications/reports/summary/')).toHaveLength(2)
  })

  it('al cambiar de gira descarta la respuesta de la anterior', async () => {
    let resolveOld: (r: Response) => void = () => {}
    setupFetch({
      '/notifications/reports/summary/': () => jsonResponse(SUMMARY),
    })
    const base = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/reports/summary/') && url.includes(`tour=${TOUR}`)) {
        return new Promise<Response>((r) => (resolveOld = r))
      }
      if (url.includes('/reports/summary/')) {
        return jsonResponse({ ...SUMMARY, totals: { ...SUMMARY.totals, sent: 9 } })
      }
      return base(input, init)
    })
    setupStores()
    const tours = useToursStore()
    tours.tours.push({ ...tours.tours[0], id: 2, uuid: 'T2' } as never)
    const w = await mountView()
    tours.activeTourId = 2
    await flushPromises()
    resolveOld(jsonResponse(SUMMARY))
    await flushPromises()
    expect(w.find('[data-testid="sends-sent"]').text()).toBe('9')
  })

  it('en demo no monta la bandeja ni llama a la API, y pinta las actividades del store', async () => {
    setupFetch()
    setupStores({ demo: true })
    useActivitiesStore().activities = [ACTIVITY as never]
    const w = await mountView()
    expect(w.find('[data-testid="dashboard-inbox"]').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.findAll('[data-testid="upcoming-row"]')).toHaveLength(1)
    expect(w.find('[data-testid="dashboard-upcoming"] [data-testid="block-loading"]').exists()).toBe(
      false
    )
  })

  it('404 del cupo no enseña error', async () => {
    setupFetch({ '/subscription/usage/': () => jsonResponse({ error: 'x' }, 404) })
    setupStores()
    const w = await mountView()
    expect(w.find('[data-testid="dashboard-plan"] [data-testid="block-error"]').exists()).toBe(false)
    expect(w.find('[data-testid="dashboard-plan"] [data-testid="block-empty"]').exists()).toBe(true)
  })

  it('mientras llegan las actividades, Próximas 24 h está cargando (nunca vacío ni CTA)', async () => {
    let release: (r: Response) => void = () => {}
    setupFetch({
      '/events/activities/': () =>
        new Promise<Response>((r) => (release = r)) as unknown as Response,
    })
    setupStores()
    const w = await mountView()
    expect(w.find('[data-testid="dashboard-empty-tour"]').exists()).toBe(false)
    const upcoming = w.find('[data-testid="dashboard-upcoming"]')
    expect(upcoming.find('[data-testid="block-loading"]').exists()).toBe(true)
    expect(upcoming.find('[data-testid="block-empty"]').exists()).toBe(false)
    // Envíos espera a conocer la zona de la gira: no pide nada aún.
    expect(calls('/notifications/reports/summary/')).toHaveLength(0)
    release(jsonResponse(page([ACTIVITY])))
    await flushPromises()
    await flushPromises()
    expect(w.findAll('[data-testid="upcoming-row"]')).toHaveLength(1)
    const summary = calls('/notifications/reports/summary/')
    expect(summary).toHaveLength(1)
    expect(summary[0]).toContain('tz=Europe%2FMadrid')
  })

  it('al descartar un aviso de la bandeja usa el store y recarga los 5', async () => {
    setupFetch({ '/notifications/inbox/I1/': () => jsonResponse(undefined, 204) })
    setupStores()
    const w = await mountView()
    expect(calls('/notifications/inbox/?')).toHaveLength(1)
    await w.find('[data-testid="inbox-dismiss"]').trigger('click')
    await flushPromises()
    const del = fetchMock.mock.calls.filter(
      ([u, init]) => String(u).includes('/notifications/inbox/I1/') && init?.method === 'DELETE'
    )
    expect(del).toHaveLength(1)
    expect(calls('/notifications/inbox/?')).toHaveLength(2)
  })
})
