import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useActivitiesStore } from '@/stores/activities'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import EventsView from './EventsView.vue'

const UUID = '0b7c2f8e-1d2a-4c3b-9e8f-112233445566'

const stubs = {
  ActivityListPanel: true,
  ActivityDetail: true,
  MobileDetailOverlay: true,
  TourSelectPrompt: true,
  SelectTourModal: true,
  AddActivityModal: true,
  CreateActivityModal: true,
  ImportCalActivitiesModal: true,
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  )
})

async function mountAt(query: Record<string, string>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/events', name: 'events', component: EventsView }],
  })
  await router.push({ path: '/events', query })
  await router.isReady()
  const store = useActivitiesStore()
  vi.spyOn(store, 'loadActivities').mockResolvedValue()
  const select = vi.spyOn(store, 'selectActivity').mockResolvedValue()
  const w = mount({ template: '<RouterView />' }, { global: { plugins: [router, i18n], stubs } })
  await flushPromises()
  return { w, router, select }
}

describe('EventsView: deep link', () => {
  it('selects activity from query and clears it', async () => {
    const { router, select } = await mountAt({ activity: UUID, other: 'x' })
    expect(select).toHaveBeenCalledWith(UUID)
    expect(router.currentRoute.value.query).toEqual({ other: 'x' })
  })

  it('ignores a malformed activity and still clears the query', async () => {
    const { router, select } = await mountAt({ activity: 'not-a-uuid' })
    expect(select).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.activity).toBeUndefined()
  })

  it('selects again when the query changes while mounted', async () => {
    const { router, select } = await mountAt({})
    expect(select).not.toHaveBeenCalled()
    await router.push({ path: '/events', query: { activity: UUID } })
    await flushPromises()
    expect(select).toHaveBeenCalledWith(UUID)
    expect(router.currentRoute.value.query.activity).toBeUndefined()
  })
})

describe('EventsView: importar agenda (F2 A1, A6, A7)', () => {
  const importStubs = {
    ...stubs,
    ActivityListPanel: {
      name: 'ActivityListPanel',
      props: ['canImport'],
      emits: ['openAdd', 'openImport'],
      template: '<div data-testid="list" :data-can-import="String(canImport)" />',
    },
    AddActivityModal: {
      name: 'AddActivityModal',
      props: ['show', 'canImport'],
      emits: ['openImport', 'openCreate', 'openImportCal', 'close'],
      template: '<div data-testid="add-modal" :data-can-import="String(canImport)" />',
    },
    CreateActivityModal: {
      name: 'CreateActivityModal',
      props: ['show', 'canImport'],
      emits: ['openImport', 'close'],
      template: '<div data-testid="create-modal" :data-show="String(show)" />',
    },
    ImportDropModal: {
      props: ['show', 'tourUuid', 'entryPoint', 'expected'],
      template:
        '<div data-testid="import-modal" :data-show="String(show)" :data-entry="entryPoint" :data-expected="expected" />',
    },
  }

  async function mountView({ admin = true, demo = false } = {}) {
    const tours = useToursStore()
    tours.tours = [{ id: 1, uuid: 'T1', name: 'Gira', current_user_is_admin: admin } as Tour]
    tours.activeTourId = 1
    useAuthStore().isDemoMode = demo
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/events', name: 'events', component: EventsView }],
    })
    await router.push('/events')
    await router.isReady()
    const store = useActivitiesStore()
    vi.spyOn(store, 'loadActivities').mockResolvedValue()
    const w = mount(
      { template: '<RouterView />' },
      { global: { plugins: [router, i18n], stubs: importStubs } }
    )
    await flushPromises()
    return w
  }

  it('admin: open-import del modal de añadir y de la lista abren ImportDropModal (activities · itinerary)', async () => {
    const w = await mountView()
    const modal = () => w.get('[data-testid="import-modal"]')
    expect(modal().attributes('data-entry')).toBe('activities')
    expect(modal().attributes('data-expected')).toBe('itinerary')
    expect(modal().attributes('data-show')).toBe('false')
    expect(w.get('[data-testid="add-modal"]').attributes('data-can-import')).toBe('true')
    w.findComponent({ name: 'AddActivityModal' }).vm.$emit('openImport')
    await flushPromises()
    expect(modal().attributes('data-show')).toBe('true')
  })

  it('la pista del formulario cierra el formulario y abre el importador', async () => {
    const w = await mountView()
    w.findComponent({ name: 'ActivityListPanel' }).vm.$emit('openImport')
    await flushPromises()
    expect(w.get('[data-testid="import-modal"]').attributes('data-show')).toBe('true')
    w.findComponent({ name: 'CreateActivityModal' }).vm.$emit('openImport')
    await flushPromises()
    expect(w.get('[data-testid="create-modal"]').attributes('data-show')).toBe('false')
  })

  it('sin admin o en demo: sin importador', async () => {
    let w = await mountView({ admin: false })
    expect(w.find('[data-testid="import-modal"]').exists()).toBe(false)
    expect(w.get('[data-testid="add-modal"]').attributes('data-can-import')).toBe('false')
    expect(w.get('[data-testid="list"]').attributes('data-can-import')).toBe('false')
    setActivePinia(createPinia())
    w = await mountView({ demo: true })
    expect(w.find('[data-testid="import-modal"]').exists()).toBe(false)
  })
})

