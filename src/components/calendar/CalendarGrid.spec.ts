import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useToursStore } from '@/stores/tours'
import { useActivitiesStore } from '@/stores/activities'
import { useCalendarStore } from '@/stores/calendar'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import type { ActivityListItem } from '@/composables/useActivities'
import type { Tour } from '@/types'
import { catalog, typeSetting } from '@/test/reminders'
import CalendarGrid from './CalendarGrid.vue'

function tour(isAdmin: boolean): Tour {
  return {
    id: 1,
    uuid: 'T1',
    name: 'Gira',
    artist_name: 'Artista',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    status: 'active',
    currency: 'EUR',
    color: '#000',
    owner_email: 'a@b.es',
    current_user_is_admin: isAdmin,
  } as Tour
}

function activity(uuid: string, extra: Partial<ActivityListItem> = {}): ActivityListItem {
  return {
    uuid,
    title: `Actividad ${uuid}`,
    scheduled_at: '2026-11-10T20:00:00+01:00',
    end_at: null,
    timezone: 'Europe/Madrid',
    local_start_time: '2026-11-10T20:00:00+01:00',
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
  }
}

function setup(isAdmin: boolean, acts: ActivityListItem[]) {
  const tours = useToursStore()
  tours.tours = [tour(isAdmin)]
  tours.activeTourId = 1
  const activities = useActivitiesStore()
  activities.activities = acts
  const cal = useCalendarStore()
  cal.currentYear = 2026
  cal.currentMonth = 10
  const reminderCatalog = useReminderCatalogStore()
  const load = vi.spyOn(reminderCatalog, 'load').mockResolvedValue()
  const reset = vi.spyOn(reminderCatalog, 'reset')
  return { reminderCatalog, load, reset }
}

function mountGrid() {
  return mount(CalendarGrid, {
    global: { plugins: [i18n], stubs: { TourSelectPrompt: true, CalendarActivityListPanel: true } },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 22, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CalendarGrid', () => {
  it('no admin: no pide el catálogo y todos los chips son normales', async () => {
    const { load, reset } = setup(false, [activity('A1')])
    const w = mountGrid()
    await flushPromises()

    expect(load).not.toHaveBeenCalled()
    expect(reset).toHaveBeenCalled()
    const chip = w.get('[data-test="calendar-chip"]')
    expect(chip.attributes('data-notifiable')).toBeUndefined()
    expect(chip.classes()).toContain('bg-bg-2')
  })

  it('admin: pide el catálogo; el tipo con recordatorios sale en night salvo si está cancelada', async () => {
    const { load, reminderCatalog } = setup(true, [
      activity('A1'),
      activity('A2', { status: 'cancelled' }),
    ])
    reminderCatalog.catalog = catalog({ types: [typeSetting({ activity_type_code: 'show' })] })
    const w = mountGrid()
    await flushPromises()

    expect(load).toHaveBeenCalledWith('T1')
    const chips = w.findAll('[data-test="calendar-chip"]')
    expect(chips).toHaveLength(2)
    expect(chips[0].attributes('data-notifiable')).toBe('true')
    expect(chips[0].classes()).toContain('bg-night')
    expect(chips[1].attributes('data-notifiable')).toBeUndefined()
    expect(chips[1].classes()).toEqual(expect.arrayContaining(['line-through', 'text-ink-2']))
  })

  it('pinta "+N más" con más de 3 actividades en el día', async () => {
    setup(false, ['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => activity(id)))
    const w = mountGrid()
    await flushPromises()

    expect(w.findAll('[data-test="calendar-chip"]')).toHaveLength(3)
    expect(w.get('[data-test="calendar-more"]').text()).toBe('+2 más')
  })

  it('la hora del chip es la local de la actividad y se oculta por debajo de xl', async () => {
    setup(false, [activity('A1')])
    const w = mountGrid()
    await flushPromises()

    const time = w.get('[data-test="calendar-chip-time"]')
    expect(time.text()).toBe('20:00')
    expect(time.classes()).toEqual(expect.arrayContaining(['hidden', 'xl:inline']))
    expect(w.get('[data-test="calendar-chip"]').classes()).toContain('overflow-hidden')
  })

  it('marca hoy con lima suave y borde oliva', async () => {
    setup(false, [])
    const w = mountGrid()
    await flushPromises()

    const today = w.get('[data-today="true"]')
    expect(today.classes()).toEqual(expect.arrayContaining(['bg-lime-soft', 'border-olive']))
  })
})
