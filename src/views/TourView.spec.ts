import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { jsonResponse } from '@/test/http'
import TourView from './TourView.vue'

const stubs = {
  TourInsightsPanel: { template: '<div data-testid="insights" />' },
  TourDocumentsPanel: { props: ['isAdmin'], template: '<div data-testid="docs" :data-admin="String(isAdmin)" />' },
  ScheduleConflictsPanel: { template: '<div data-testid="conflicts" />' },
  TourSelectPrompt: true,
  CrewPortalPanel: { template: '<div data-testid="crew-panel" />' },
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
