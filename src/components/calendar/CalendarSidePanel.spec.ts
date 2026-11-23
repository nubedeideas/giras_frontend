import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useToursStore } from '@/stores/tours'
import { useActivitiesStore } from '@/stores/activities'
import { useCalendarStore } from '@/stores/calendar'
import type { ActivityListItem } from '@/composables/useActivities'
import type { Tour } from '@/types'
import CalendarSidePanel from './CalendarSidePanel.vue'

function tour(isAdmin: boolean, timezone = 'Europe/Madrid'): Tour {
  return { id: 1, uuid: 'T1', name: 'Gira', current_user_is_admin: isAdmin, timezone } as Tour
}

function activity(uuid: string, scheduledAt: string, extra: Partial<ActivityListItem> = {}) {
  return {
    uuid,
    title: `Actividad ${uuid}`,
    scheduled_at: scheduledAt,
    end_at: null,
    timezone: 'Europe/Madrid',
    local_start_time: null,
    status: 'scheduled',
    priority: 'normal',
    all_day: false,
    location_name: '',
    destination_name: '',
    activity_type_name: 'Show',
    activity_type_code: 'show',
    activity_type_icon: '',
    activity_type_color: '#000',
    category: 'other',
    ...extra,
  } as ActivityListItem
}

function setup(opts: { isAdmin?: boolean; timezone?: string; acts?: ActivityListItem[] } = {}) {
  const tours = useToursStore()
  tours.tours = [tour(opts.isAdmin ?? true, opts.timezone)]
  tours.activeTourId = 1
  const activities = useActivitiesStore()
  activities.activities = opts.acts ?? []
  const select = vi.spyOn(activities, 'selectActivity').mockImplementation(async (uuid) => {
    activities.selectedUuid = uuid
  })
  const cal = useCalendarStore()
  cal.currentYear = 2026
  cal.currentMonth = 10
  return { tours, activities, cal, select }
}

function mountPanel() {
  return mount(CalendarSidePanel, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 22, 12))
})

afterEach(() => {
  vi.useRealTimers()
  i18n.global.locale.value = 'es'
})

describe('CalendarSidePanel: abrir desde "Próximos"', () => {
  it('selecciona la actividad, marca su día y lleva la rejilla a su mes', async () => {
    const { cal, select } = setup({ acts: [activity('A1', '2026-12-03T19:00:00Z')] })
    const w = mountPanel()

    await w.get('[data-test="calendar-upcoming-activity"]').trigger('click')

    expect(select).toHaveBeenCalledWith('A1')
    expect(cal.selectedDate).toBe('2026-12-03')
    expect([cal.currentYear, cal.currentMonth]).toEqual([2026, 11])
  })
})

describe('CalendarSidePanel: día sin actividades', () => {
  it('muestra el estado vacío con el acceso a Añadir', async () => {
    const { cal } = setup({ acts: [activity('A1', '2026-12-03T19:00:00Z')] })
    cal.selectedDate = '2026-11-25'
    const w = mountPanel()

    const empty = w.get('[data-test="calendar-day-empty"]')
    expect(empty.text()).toContain('No hay actividades este día')
    expect(empty.get('p').classes()).toContain('text-ink-2')
    await empty.get('[data-test="calendar-day-add"]').trigger('click')
    expect(w.emitted('add')).toHaveLength(1)
  })

  it('con actividades ese día no muestra el estado vacío', () => {
    const { cal } = setup({ acts: [activity('A1', '2026-12-03T19:00:00Z')] })
    cal.selectedDate = '2026-12-03'
    const w = mountPanel()

    expect(w.find('[data-test="calendar-day-empty"]').exists()).toBe(false)
    expect(w.findAll('[data-test="calendar-day-activity"]')).toHaveLength(1)
  })
})

describe('CalendarSidePanel: botón Añadir', () => {
  it('emite add para admins', async () => {
    setup()
    const w = mountPanel()
    await w.get('[data-test="calendar-add"]').trigger('click')
    expect(w.emitted('add')).toHaveLength(1)
  })

  it('no aparece a quien no es admin de la gira', () => {
    const { cal } = setup({ isAdmin: false })
    cal.selectedDate = '2026-11-25'
    const w = mountPanel()
    expect(w.find('[data-test="calendar-add"]').exists()).toBe(false)
    expect(w.find('[data-test="calendar-day-add"]').exists()).toBe(false)
    expect(w.get('[data-test="calendar-day-empty"]').text()).toContain(
      'No hay actividades este día'
    )
  })
})

describe('CalendarSidePanel: fecha y hora con Luxon en la zona de la gira', () => {
  it('fecha corta localizada, nunca ISO crudo', async () => {
    const { cal } = setup()
    cal.selectedDate = '2026-12-02'
    const w = mountPanel()

    const label = w.get('[data-test="calendar-day-label"]')
    expect(label.text()).toBe('mié 2 dic')
    expect(label.classes()).toEqual(expect.arrayContaining(['font-time', 'tnum']))

    i18n.global.locale.value = 'en'
    await w.vm.$nextTick()
    expect(label.text()).toBe('Wed 2 Dec')
  })

  it('la hora es la de la zona de la gira', () => {
    // 20:00Z = 05:00 del día siguiente en Tokio.
    setup({ timezone: 'Asia/Tokyo', acts: [activity('A1', '2026-12-02T20:00:00Z')] })
    const w = mountPanel()
    expect(w.get('[data-test="calendar-activity-time"]').text()).toBe('05:00')
  })

  it('todo el día se muestra como tal, no como "Hoy"', () => {
    setup({ acts: [activity('A1', '2026-12-03T11:00:00Z', { all_day: true })] })
    const w = mountPanel()
    expect(w.get('[data-test="calendar-activity-time"]').text()).toBe('Todo el día')
  })
})
