import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useActivitiesStore } from '@/stores/activities'
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
