import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useActivitiesStore } from '@/stores/activities'
import { useCalendarStore } from '@/stores/calendar'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import CalendarView from './CalendarView.vue'

const stubs: Record<string, Component | boolean> = {
  CalendarGrid: true,
  ActivityDetail: true,
  MobileDetailOverlay: true,
  SelectTourModal: true,
  AddActivityModal: true,
  CreateActivityModal: true,
  ImportCalActivitiesModal: true,
  ImportDropModal: true,
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

function setTour(isAdmin = true) {
  const tours = useToursStore()
  tours.tours = [
    {
      id: 1,
      uuid: 'T1',
      name: 'Gira',
      current_user_is_admin: isAdmin,
      timezone: 'Asia/Tokyo',
    } as Tour,
  ]
  tours.activeTourId = 1
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/calendar', component: CalendarView }],
  })
  await router.push('/calendar')
  await router.isReady()
  vi.spyOn(useActivitiesStore(), 'loadActivities').mockResolvedValue()
  const w = mount({ template: '<RouterView />' }, { global: { plugins: [router, i18n], stubs } })
  await flushPromises()
  return w
}

describe('CalendarView: Añadir desde el panel lateral', () => {
  it('abre el alta y pasa el día seleccionado como fecha inicial', async () => {
    setTour()
    const w = await mountView()
    useCalendarStore().selectedDate = '2026-12-03'
    await flushPromises()

    await w.get('[data-test="calendar-day-add"]').trigger('click')
    const add = w.findComponent({ name: 'AddActivityModal' })
    expect(add.props('show')).toBe(true)
    expect(add.props('canImport')).toBe(true)

    add.vm.$emit('close')
    add.vm.$emit('openCreate')
    await flushPromises()
    const create = w.findComponent({ name: 'CreateActivityModal' })
    expect(create.props('show')).toBe(true)
    expect(create.props('initialDate')).toBe('2026-12-03')
  })

  it('sin día seleccionado no prerrellena fecha', async () => {
    setTour()
    const w = await mountView()

    await w.get('[data-test="calendar-add"]').trigger('click')
    expect(w.findComponent({ name: 'AddActivityModal' }).props('show')).toBe(true)
    expect(w.findComponent({ name: 'CreateActivityModal' }).props('initialDate')).toBeNull()
  })

  it('no hay botón de alta para quien no es admin', async () => {
    setTour(false)
    const w = await mountView()
    expect(w.find('[data-test="calendar-add"]').exists()).toBe(false)
  })

  it('sin gira activa (móvil) sigue el camino de Actividades: elegir gira y luego el alta', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    )
    stubs.MobileDetailOverlay = { template: '<div><slot /></div>' } 
    try {
      const w = await mountView()
      useCalendarStore().selectedDate = '2026-12-03'
      await flushPromises()

      await w.get('[data-test="calendar-add"]').trigger('click')
      const select = w.findComponent({ name: 'SelectTourModal' })
      expect(select.props('show')).toBe(true)
      expect(w.findComponent({ name: 'AddActivityModal' }).props('show')).toBe(false)

      select.vm.$emit('selected')
      await flushPromises()
      expect(w.findComponent({ name: 'AddActivityModal' }).props('show')).toBe(true)
      expect(w.findComponent({ name: 'CreateActivityModal' }).props('initialDate')).toBeNull()
    } finally {
      stubs.MobileDetailOverlay = true
    }
  })
})
