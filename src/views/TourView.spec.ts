import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { useImportsStore } from '@/stores/imports'
import { jsonResponse } from '@/test/http'
import TourView from './TourView.vue'

const stubs = {
  TourInsightsPanel: { template: '<div data-testid="insights" />' },
  TourDocumentsPanel: { props: ['isAdmin'], template: '<div data-testid="docs" :data-admin="String(isAdmin)" />' },
  ScheduleConflictsPanel: { template: '<div data-testid="conflicts" />' },
  TourSelectPrompt: true,
  CrewPortalPanel: { template: '<div data-testid="crew-panel" />' },
  TourRemindersPanel: { template: '<div data-testid="reminders-panel" />' },
}

function setup(detail: Record<string, unknown>, ownerEmail = 'owner@x.es') {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => jsonResponse({ uuid: 'T1', ...detail }))
  )
  const auth = useAuthStore()
  auth.user = { email: 'me@x.es', is_superuser: false } as typeof auth.user
  const tours = useToursStore()
  tours.tours = [
    {
      id: 1,
      uuid: 'T1',
      name: 'Gira',
      artist_name: 'A',
      start_date: '2026-11-01',
      end_date: '2026-11-30',
      status: 'active',
      currency: 'EUR',
      color: '#a8d800',
      owner_email: ownerEmail,
      timezone: 'Europe/Madrid',
      enable_notifications: true,
      notifications_paused_at: null,
    },
  ]
  tours.setActiveTour(1)
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

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/tour', name: 'tour', component: { template: '<div />' } }],
  })
}

async function mountView(query: Record<string, string> = {}) {
  const router = makeRouter()
  await router.push({ path: '/tour', query })
  await router.isReady()
  const w = mount(TourView, { global: { plugins: [i18n, router], stubs } })
  return Object.assign(w, { router })
}

function tabLabels(w: Awaited<ReturnType<typeof mountView>>) {
  return w.findAll('button').map((b) => b.text())
}

describe('TourView: rol de admin', () => {
  it('current_user_is_admin=true (miembro tour_manager, no owner) muestra Crew', async () => {
    setup({ current_user_is_admin: true })
    const w = await mountView()
    await flushPromises()
    expect(tabLabels(w)).toContain('Crew')
    await w.findAll('button').find((b) => b.text() === 'Documentos')!.trigger('click')
    expect(w.get('[data-testid="docs"]').attributes('data-admin')).toBe('true')
  })

  it('current_user_is_admin=false manda aunque el email coincida con el owner', async () => {
    setup({ current_user_is_admin: false }, 'me@x.es')
    const w = await mountView()
    await flushPromises()
    expect(tabLabels(w)).not.toContain('Crew')
  })

  it('sin el campo en el detalle se usa el fallback por owner', async () => {
    setup({}, 'me@x.es')
    const w = await mountView()
    await flushPromises()
    expect(tabLabels(w)).toContain('Crew')
  })
})

describe('TourView: pestaña desde la query', () => {
  it('opens conflicts tab from query', async () => {
    setup({ current_user_is_admin: true })
    const w = await mountView({ tab: 'conflicts' })
    await flushPromises()
    expect(w.find('[data-testid="conflicts"]').exists()).toBe(true)
    expect(w.find('[data-testid="insights"]').exists()).toBe(false)
    expect(w.router.currentRoute.value.query.tab).toBeUndefined()
  })

  it('ignores crew tab from query without permission', async () => {
    setup({ current_user_is_admin: false, can_manage_crew: false })
    const w = await mountView({ tab: 'crew' })
    await flushPromises()
    expect(w.find('[data-testid="crew-panel"]').exists()).toBe(false)
    expect(w.find('[data-testid="insights"]').exists()).toBe(true)
    expect(w.router.currentRoute.value.query.tab).toBeUndefined()
  })

  it('opens crew tab from query with permission and ignores unknown tabs', async () => {
    // Caso real: tour_manager que no es owner. El fallback (owner/superuser) diría que no; la
    // pestaña tiene que esperar al detalle, que trae can_manage_crew=true.
    let resolveDetail: (r: Response) => void = () => {}
    setup({})
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => new Promise<Response>((r) => (resolveDetail = r)))
    )
    const w = await mountView({ tab: 'crew' })
    await flushPromises()
    // Sin detalle todavía: ni se abre ni se pierde la query.
    expect(w.find('[data-testid="crew-panel"]').exists()).toBe(false)
    expect(w.router.currentRoute.value.query.tab).toBe('crew')

    resolveDetail(
      jsonResponse({ uuid: 'T1', current_user_is_admin: true, can_manage_crew: true })
    )
    await flushPromises()
    expect(w.find('[data-testid="crew-panel"]').exists()).toBe(true)
    expect(w.router.currentRoute.value.query.tab).toBeUndefined()

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => jsonResponse({ uuid: 'T1' }))
    )
    const w2 = await mountView({ tab: 'nope' })
    await flushPromises()
    expect(w2.find('[data-testid="insights"]').exists()).toBe(true)
    expect(w2.router.currentRoute.value.query.tab).toBeUndefined()
  })

  it('drops crew tab from query once the detail denies it', async () => {
    setup({ current_user_is_admin: false, can_manage_crew: false }, 'me@x.es')
    const w = await mountView({ tab: 'crew' })
    await flushPromises()
    expect(w.find('[data-testid="crew-panel"]').exists()).toBe(false)
    expect(w.find('[data-testid="insights"]').exists()).toBe(true)
    expect(w.router.currentRoute.value.query.tab).toBeUndefined()
  })

})

describe('TourView: pestaña Recordatorios', () => {
  it('solo la ven los admins de la gira', async () => {
    setup({ current_user_is_admin: true, can_manage_crew: true })
    const w = await mountView()
    await flushPromises()
    expect(tabLabels(w)).toContain('Recordatorios')

    setup({ current_user_is_admin: false, can_manage_crew: false })
    const w2 = await mountView()
    await flushPromises()
    expect(tabLabels(w2)).not.toContain('Recordatorios')
  })

  it('?tab=reminders abre el panel cuando el detalle confirma el permiso', async () => {
    setup({ current_user_is_admin: true })
    const w = await mountView({ tab: 'reminders' })
    await flushPromises()
    expect(w.find('[data-testid="reminders-panel"]').exists()).toBe(true)
    expect(w.router.currentRoute.value.query.tab).toBeUndefined()

    setup({ current_user_is_admin: false })
    const w2 = await mountView({ tab: 'reminders' })
    await flushPromises()
    expect(w2.find('[data-testid="reminders-panel"]').exists()).toBe(false)
    expect(w2.find('[data-testid="insights"]').exists()).toBe(true)
  })
})

describe('TourView: importar (F1)', () => {
  function stubByUrl(opts: {
    admin: boolean
    jobs?: (tour: string) => unknown[] | Promise<Response>
  }) {
    const fn = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/integrations/import-jobs/')) {
        const tour = url.searchParams.get('tour') ?? ''
        const jobs = opts.jobs?.(tour) ?? []
        if (jobs instanceof Promise) return jobs
        return jsonResponse({ count: jobs.length, next: null, previous: null, results: jobs })
      }
      const m = url.pathname.match(/\/tours\/([^/]+)\/$/)
      if (m) return jsonResponse({ uuid: m[1], current_user_is_admin: opts.admin })
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fn)
    return fn
  }

  async function mountWithImportRoute() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/tour', name: 'tour', component: { template: '<div />' } },
        { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
      ],
    })
    await router.push('/tour')
    await router.isReady()
    return mount(TourView, { global: { plugins: [i18n, router], stubs } })
  }

  it('el botón Importar solo lo ven los admins y nunca en la demo', async () => {
    setup({})
    stubByUrl({ admin: true })
    const w = await mountWithImportRoute()
    await flushPromises()
    expect(w.find('[data-test="import-open"]').exists()).toBe(true)

    setup({})
    stubByUrl({ admin: false })
    const w2 = await mountWithImportRoute()
    await flushPromises()
    expect(w2.find('[data-test="import-open"]').exists()).toBe(false)

    setup({})
    stubByUrl({ admin: true })
    useAuthStore().isDemoMode = true
    const w3 = await mountWithImportRoute()
    await flushPromises()
    expect(w3.find('[data-test="import-open"]').exists()).toBe(false)
  })

  it('aviso de importación pendiente con enlace a tour-import y "+n"', async () => {
    setup({})
    const fn = stubByUrl({
      admin: true,
      jobs: () => [
        { uuid: 'J-old', tour: 'T1', status: 'ready', filenames: ['Viejo.xlsx'], created_at: '2026-11-20T10:00:00Z' },
        { uuid: 'J-new', tour: 'T1', status: 'ready', filenames: ['Crew_2027.xlsx'], created_at: '2026-11-22T09:30:00Z' },
      ],
    })
    const w = await mountWithImportRoute()
    await flushPromises()
    const listCall = fn.mock.calls.find(([u]) => String(u).includes('/integrations/import-jobs/'))
    expect(new URL(String(listCall![0])).searchParams.get('status')).toBe('ready')
    const banner = w.get('[data-test="import-pending-banner"]')
    expect(banner.text()).toContain('Tienes una importación sin revisar: Crew_2027.xlsx')
    expect(banner.text()).toContain('+1')
    expect(banner.find('[data-status="pending"]').exists()).toBe(true)
    expect(w.get('[data-test="import-pending-link"]').attributes('href')).toBe('/tour/import/J-new')
  })

  it('F2: el aviso cuenta actividades si el job las trae', async () => {
    setup({})
    stubByUrl({
      admin: true,
      jobs: () => [
        {
          uuid: 'J1',
          tour: 'T1',
          status: 'ready',
          filenames: ['Itinerario_MAD.pdf'],
          created_at: '2026-11-22T09:30:00Z',
          activities_found: 46,
        },
      ],
    })
    const w = await mountWithImportRoute()
    await flushPromises()
    const banner = w.get('[data-test="import-pending-banner"]')
    expect(banner.text()).toContain('Tienes una importación sin revisar: Itinerario_MAD.pdf · 46 actividades')
    expect(banner.find('[data-test="import-pending-activities"] .font-time').text()).toBe('46')
  })

  it('F3: un borrador de calendario iCal se anuncia como cambios del calendario', async () => {
    setup({})
    stubByUrl({
      admin: true,
      jobs: () => [
        {
          uuid: 'J-cal',
          tour: 'T1',
          status: 'ready',
          source_kind: 'ical_sync',
          entry_point: 'subscription',
          filenames: ['calendario.ics'],
          created_at: '2026-11-23T10:00:00Z',
          activities_found: 4,
          calendar: { subscription_uuid: 'S1', name: 'Gira 2027 (iCloud)', new: 3, changed: 1, cancelled: 1 },
        },
      ],
    })
    const w = await mountWithImportRoute()
    await flushPromises()
    const banner = w.get('[data-test="import-pending-banner"]')
    expect(banner.text()).toContain('Cambios del calendario Gira 2027 (iCloud) por revisar · 5')
    expect(banner.text()).not.toContain('calendario.ics')
    expect(banner.find('[data-test="import-pending-calendar"] .font-time').text()).toBe('5')
    expect(w.get('[data-test="import-pending-link"]').attributes('href')).toBe('/tour/import/J-cal')
  })

  it('F4: un borrador de hoja de Google se anuncia como cambios de la hoja', async () => {
    setup({})
    stubByUrl({
      admin: true,
      jobs: () => [
        {
          uuid: 'J-sheet',
          tour: 'T1',
          status: 'ready',
          source_kind: 'sheet_sync',
          entry_point: 'subscription',
          filenames: ['gira-2027-20261123-1000.xlsx'],
          created_at: '2026-11-23T10:00:00Z',
          activities_found: 4,
          calendar: null,
          sheet: {
            subscription_uuid: 'G1',
            name: 'Gira 2027',
            new: 3,
            changed: 1,
            removed: 2,
            open_url: null,
          },
        },
      ],
    })
    const w = await mountWithImportRoute()
    await flushPromises()
    const banner = w.get('[data-test="import-pending-banner"]')
    expect(banner.text()).toContain('Cambios de la hoja Gira 2027 por revisar · 6')
    expect(banner.text()).not.toContain('.xlsx')
    expect(banner.find('[data-test="import-pending-sheet"] .font-time').text()).toBe('6')
    expect(banner.find('[data-test="import-pending-calendar"]').exists()).toBe(false)
  })

  it('ignora la lista atrasada de la gira anterior al cambiar de gira', async () => {
    setup({})
    let resolveT1: (r: Response) => void = () => {}
    const slowT1 = new Promise<Response>((r) => (resolveT1 = r))
    stubByUrl({ admin: true, jobs: (tour) => (tour === 'T1' ? slowT1 : []) })
    const tours = useToursStore()
    tours.tours = [
      ...tours.tours,
      { ...tours.tours[0], id: 2, uuid: 'T2', name: 'Otra' },
    ]
    const w = await mountWithImportRoute()
    await flushPromises()
    tours.setActiveTour(2)
    await flushPromises()
    resolveT1(
      jsonResponse({
        count: 1,
        next: null,
        previous: null,
        results: [{ uuid: 'J1', tour: 'T1', status: 'ready', filenames: ['T1.xlsx'], created_at: '2026-11-22T09:30:00Z' }],
      })
    )
    await flushPromises()
    expect(w.find('[data-test="import-pending-banner"]').exists()).toBe(false)
  })

  it('F3: recarga el aviso cuando una suscripción iCal deja un borrador fuera de esta vista', async () => {
    setup({})
    let jobs: unknown[] = []
    const fn = stubByUrl({ admin: true, jobs: () => jobs })
    const w = await mountWithImportRoute()
    await flushPromises()
    expect(w.find('[data-test="import-pending-banner"]').exists()).toBe(false)
    const listCalls = () =>
      fn.mock.calls.filter(([u]) => String(u).includes('/integrations/import-jobs/')).length
    expect(listCalls()).toBe(1)

    // Otra gira: no se recarga.
    useImportsStore().invalidate('T9')
    await flushPromises()
    expect(listCalls()).toBe(1)

    jobs = [
      {
        uuid: 'J-cal',
        tour: 'T1',
        status: 'ready',
        source_kind: 'ical_sync',
        filenames: [],
        created_at: '2026-11-23T10:00:00Z',
        calendar: { subscription_uuid: 'S1', name: 'iCloud', new: 2, changed: 0, cancelled: 0 },
      },
    ]
    useImportsStore().invalidate('T1')
    await flushPromises()
    expect(listCalls()).toBe(2)
    expect(w.get('[data-test="import-pending-banner"]').text()).toContain('iCloud')
  })

  describe('entradas del lote 3', () => {
    const entryStubs = {
      ...stubs,
      TourRemindersPanel: {
        props: ['canImport'],
        emits: ['importTeam'],
        template:
          '<div data-testid="reminders-panel" :data-can-import="String(canImport)"><button data-testid="reminders-import" @click="$emit(\'importTeam\')" /></div>',
      },
      CrewPortalPanel: {
        props: ['canImport'],
        emits: ['importTeam'],
        template:
          '<div data-testid="crew-panel" :data-can-import="String(canImport)"><button data-testid="crew-import" @click="$emit(\'importTeam\')" /></div>',
      },
      ImportDropModal: {
        props: ['show', 'entryPoint', 'tourUuid', 'expected', 'startWithSheets'],
        template:
          '<div data-testid="import-modal" :data-show="String(show)" :data-entry="entryPoint" :data-expected="expected" :data-sheets="String(startWithSheets)" />',
      },
    }

    async function mountEntry(query: Record<string, string> = {}) {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/tour', name: 'tour', component: { template: '<div />' } },
          { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
        ],
      })
      await router.push({ path: '/tour', query })
      await router.isReady()
      const replace = vi.spyOn(router, 'replace')
      const w = mount(TourView, { global: { plugins: [i18n, router], stubs: entryStubs } })
      return Object.assign(w, { router, replace })
    }

    function modal(w: Awaited<ReturnType<typeof mountEntry>>) {
      return w.find('[data-testid="import-modal"]')
    }

    it('importTeam desde Recordatorios y desde Crew abre el modal con entry-point="tour"', async () => {
      setup({})
      stubByUrl({ admin: true })
      const w = await mountEntry({ tab: 'reminders' })
      await flushPromises()
      expect(w.get('[data-testid="reminders-panel"]').attributes('data-can-import')).toBe('true')
      expect(modal(w).attributes('data-show')).toBe('false')
      await w.get('[data-testid="reminders-import"]').trigger('click')
      expect(modal(w).attributes('data-show')).toBe('true')
      expect(modal(w).attributes('data-entry')).toBe('tour')
      expect(modal(w).attributes('data-expected')).toBe('team')

      setup({})
      stubByUrl({ admin: true })
      const w2 = await mountEntry({ tab: 'crew' })
      await flushPromises()
      expect(w2.get('[data-testid="crew-panel"]').attributes('data-can-import')).toBe('true')
      await w2.get('[data-testid="crew-import"]').trigger('click')
      expect(modal(w2).attributes('data-show')).toBe('true')
      expect(modal(w2).attributes('data-entry')).toBe('tour')
      expect(modal(w2).attributes('data-expected')).toBe('team')
    })

    it('F2 C1: el botón Importar abre el modal genérico (expected any)', async () => {
      setup({})
      stubByUrl({ admin: true })
      const w = await mountEntry({ tab: 'reminders' })
      await flushPromises()
      await w.get('[data-testid="reminders-import"]').trigger('click')
      expect(modal(w).attributes('data-expected')).toBe('team')
      await w.get('[data-test="import-open"]').trigger('click')
      expect(modal(w).attributes('data-show')).toBe('true')
      expect(modal(w).attributes('data-expected')).toBe('any')
    })

    it('en la demo los paneles reciben canImport=false', async () => {
      setup({})
      stubByUrl({ admin: true })
      useAuthStore().isDemoMode = true
      const w = await mountEntry({ tab: 'reminders' })
      await flushPromises()
      expect(w.get('[data-testid="reminders-panel"]').attributes('data-can-import')).toBe('false')
      expect(modal(w).exists()).toBe(false)
    })

    it('?tab=reminders&import=team con admin abre la pestaña y el modal tras el detalle, con un solo replace', async () => {
      setup({})
      let resolveDetail: (r: Response) => void = () => {}
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (input) => {
          const url = new URL(String(input))
          if (url.pathname.endsWith('/integrations/import-jobs/')) {
            return jsonResponse({ count: 0, next: null, previous: null, results: [] })
          }
          return new Promise<Response>((r) => (resolveDetail = r))
        })
      )
      const w = await mountEntry({ tab: 'reminders', import: 'team' })
      await flushPromises()
      // Sin detalle: ni pestaña ni modal, y la query sigue ahí.
      expect(w.find('[data-testid="reminders-panel"]').exists()).toBe(false)
      expect(w.router.currentRoute.value.query.import).toBe('team')
      expect(w.replace).not.toHaveBeenCalled()

      resolveDetail(jsonResponse({ uuid: 'T1', current_user_is_admin: true }))
      await flushPromises()
      expect(w.find('[data-testid="reminders-panel"]').exists()).toBe(true)
      expect(modal(w).attributes('data-show')).toBe('true')
      expect(modal(w).attributes('data-entry')).toBe('tour')
      expect(modal(w).attributes('data-expected')).toBe('team')
      expect(w.replace).toHaveBeenCalledTimes(1)
      const q = w.router.currentRoute.value.query
      expect(q.tab).toBeUndefined()
      expect(q.import).toBeUndefined()
    })

    it('miembro no admin: no abre el modal y limpia la query', async () => {
      setup({})
      stubByUrl({ admin: false })
      const w = await mountEntry({ tab: 'reminders', import: 'team' })
      await flushPromises()
      expect(modal(w).exists()).toBe(false)
      expect(w.find('[data-testid="insights"]').exists()).toBe(true)
      expect(w.replace).toHaveBeenCalledTimes(1)
      expect(w.router.currentRoute.value.query).toEqual({})
    })

    it('demo: no abre el modal y limpia la query', async () => {
      setup({})
      stubByUrl({ admin: true })
      useAuthStore().isDemoMode = true
      const w = await mountEntry({ tab: 'reminders', import: 'team' })
      await flushPromises()
      expect(modal(w).exists()).toBe(false)
      expect(w.replace).toHaveBeenCalledTimes(1)
      expect(w.router.currentRoute.value.query).toEqual({})
    })

    it('F4: ?import=sheets&tour=T1 (vuelta del OAuth) reabre el modal en la hoja y limpia la query', async () => {
      setup({})
      stubByUrl({ admin: true })
      const w = await mountEntry({ import: 'sheets', tour: 'T1', google_connect: 'ok' })
      await flushPromises()
      expect(modal(w).attributes('data-show')).toBe('true')
      expect(modal(w).attributes('data-sheets')).toBe('true')
      expect(modal(w).attributes('data-expected')).toBe('any')
      const q = w.router.currentRoute.value.query
      expect(q.import).toBeUndefined()
      expect(q.tour).toBeUndefined()
      expect(q.google_connect).toBe('ok')
    })

    it('F4: ?import=sheets sin permiso de importar no abre nada', async () => {
      setup({})
      stubByUrl({ admin: false })
      const w = await mountEntry({ import: 'sheets', tour: 'T1' })
      await flushPromises()
      expect(modal(w).exists()).toBe(false)
      expect(w.router.currentRoute.value.query.import).toBeUndefined()
    })

    it('otro valor de import se ignora y se limpia', async () => {
      setup({})
      stubByUrl({ admin: true })
      const w = await mountEntry({ tab: 'reminders', import: 'activities' })
      await flushPromises()
      expect(w.find('[data-testid="reminders-panel"]').exists()).toBe(true)
      expect(modal(w).attributes('data-show')).toBe('false')
      expect(w.router.currentRoute.value.query).toEqual({})
    })
  })
})
