import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useActivitiesStore } from '@/stores/activities'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import ActivityListPanel from './ActivityListPanel.vue'

const ACTIVITY = {
  uuid: 'A1',
  title: 'Concierto en Madrid',
  scheduled_at: '2026-12-03T20:00:00Z',
  end_at: null,
  timezone: 'Europe/Madrid',
  status: 'scheduled',
  priority: 'normal',
  all_day: false,
  location_name: 'WiZink',
  destination_name: '',
  activity_type_name: 'Concierto',
  activity_type_code: 'show',
  activity_type_icon: '',
  activity_type_color: '#000',
  category: 'production',
  ai_review: null,
}

function setup(activities: unknown[] = []) {
  const tours = useToursStore()
  tours.tours = [{ id: 1, uuid: 'T1', name: 'Gira', current_user_is_admin: true } as Tour]
  tours.activeTourId = 1
  const store = useActivitiesStore()
  store.activities = activities as never
  store.loading = false
  return store
}

function mountPanel(canImport = true) {
  return mount(ActivityListPanel, {
    props: { canImport },
    global: { plugins: [i18n], stubs: { ActivityCard: true, TourSelectPrompt: true } },
  })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  )
})

describe('ActivityListPanel: gira vacía (F2 A6)', () => {
  it('sin actividades ni filtros: CTA de importar (admin) y añadir a mano', async () => {
    setup()
    const w = mountPanel()
    const empty = w.get('[data-test="activities-empty-tour"]')
    expect(empty.text()).toContain('Esta gira todavía no tiene actividades')
    await w.get('[data-test="activities-empty-import"]').trigger('click')
    await w.get('[data-test="activities-empty-add"]').trigger('click')
    expect(w.emitted('openImport')).toHaveLength(1)
    expect(w.emitted('openAdd')).toHaveLength(1)
    expect(w.find('[data-test="activities-no-results"]').exists()).toBe(false)
  })

  it('sin admin: solo "Añadir a mano"', () => {
    setup()
    const w = mountPanel(false)
    expect(w.find('[data-test="activities-empty-tour"]').exists()).toBe(true)
    expect(w.find('[data-test="activities-empty-import"]').exists()).toBe(false)
    expect(w.get('[data-test="activities-empty-add"]').text()).toBe('Añadir a mano')
  })

  it('con búsqueda o filtros: "Sin resultados" en vez del CTA', () => {
    const store = setup()
    store.searchQuery = 'zzz'
    const w = mountPanel()
    expect(w.find('[data-test="activities-empty-tour"]').exists()).toBe(false)
    expect(w.get('[data-test="activities-no-results"]').text()).toBe('Sin resultados')
  })

  it('con actividades filtradas fuera: "Sin resultados" (en inglés también)', () => {
    const store = setup([ACTIVITY])
    store.filterCategory = ['personal']
    i18n.global.locale.value = 'en'
    const w = mountPanel()
    expect(w.find('[data-test="activities-empty-tour"]').exists()).toBe(false)
    expect(w.get('[data-test="activities-no-results"]').text()).toBe('No results')
  })
})
