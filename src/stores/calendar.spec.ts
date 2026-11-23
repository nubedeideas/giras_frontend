import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { jsonResponse, mockFetch } from '@/test/http'
import { dateKeyOf, useCalendarStore } from './calendar'
import { useActivitiesStore } from './activities'
import { useToursStore } from './tours'
import type { ActivityListItem } from '@/composables/useActivities'
import type { Tour } from '@/types'

function activity(uuid: string, scheduledAt: string): ActivityListItem {
  return {
    uuid,
    title: uuid,
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
  }
}

function tour(id: number, startDate: string): Tour {
  return { id, uuid: `T${id}`, name: `Gira ${id}`, start_date: startDate } as unknown as Tour
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  vi.useFakeTimers({ toFake: ['Date'] })
  // Hoy: 22 de noviembre de 2026 (mes 10)
  vi.setSystemTime(new Date(2026, 10, 22, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('calendar store: mes inicial (Paleta B §5.4.2)', () => {
  it('abre en el mes de la actividad seleccionada aunque la gira empiece antes', () => {
    const tours = useToursStore()
    tours.tours = [tour(1, '2026-01-10')]
    tours.activeTourId = 1
    const activities = useActivitiesStore()
    activities.activities = [activity('A1', '2026-03-15T20:00:00')]
    activities.selectedUuid = 'A1'

    const cal = useCalendarStore()
    cal.resetToDefaultMonth()

    expect(cal.currentYear).toBe(2026)
    expect(cal.currentMonth).toBe(2)
  })

  it('usa el detalle cargado si la seleccionada no está en el listado', () => {
    const activities = useActivitiesStore()
    activities.selectedUuid = 'A9'
    activities.selectedDetail = {
      uuid: 'A9',
      scheduled_at: '2027-05-02T10:00:00',
    } as unknown as typeof activities.selectedDetail

    const cal = useCalendarStore()
    cal.resetToDefaultMonth()

    expect([cal.currentYear, cal.currentMonth]).toEqual([2027, 4])
  })

  it('sin selección abre en el mes actual, no en el inicio de la gira', () => {
    const tours = useToursStore()
    tours.tours = [tour(1, '2026-01-10')]
    tours.activeTourId = 1

    const cal = useCalendarStore()
    cal.currentMonth = 0
    cal.resetToDefaultMonth()

    expect([cal.currentYear, cal.currentMonth]).toEqual([2026, 10])
  })

  it('al cambiar de gira vuelve al mes actual y limpia el día seleccionado', async () => {
    mockFetch(jsonResponse({ count: 0, next: null, previous: null, results: [] }))
    const tours = useToursStore()
    tours.tours = [tour(1, '2026-01-10'), tour(2, '2025-06-01')]
    tours.activeTourId = 1
    const activities = useActivitiesStore()
    activities.activities = [activity('A1', '2026-03-15T20:00:00')]
    activities.selectedUuid = 'A1'

    const cal = useCalendarStore()
    cal.resetToDefaultMonth()
    cal.selectDate('2026-03-15')
    expect(cal.currentMonth).toBe(2)

    tours.setActiveTour(2)
    await nextTick()

    expect([cal.currentYear, cal.currentMonth]).toEqual([2026, 10])
    expect(cal.selectedDate).toBeNull()
  })
})

describe('calendar store: elegir día con el detalle abierto', () => {
  function setup() {
    const activities = useActivitiesStore()
    activities.activities = [
      activity('A1', '2026-11-10T20:00:00'),
      activity('A2', '2026-11-12T09:00:00'),
    ]
    activities.selectedUuid = 'A1'
    return { activities, cal: useCalendarStore() }
  }

  it('otro día cierra el detalle y deja la agenda de ese día', () => {
    const { activities, cal } = setup()

    cal.selectDate('2026-11-12')

    expect(activities.selectedUuid).toBeNull()
    expect(cal.selectedDate).toBe('2026-11-12')
    expect(cal.activitiesForSelectedDate.map((a) => a.uuid)).toEqual(['A2'])
  })

  it('el día de la propia actividad mantiene el detalle', () => {
    const { activities, cal } = setup()

    cal.selectDate('2026-11-10')

    expect(activities.selectedUuid).toBe('A1')
    expect(cal.selectedDate).toBe('2026-11-10')
  })

  it('con el detalle abierto, repetir el día no lo deselecciona', () => {
    const { activities, cal } = setup()
    cal.selectedDate = '2026-11-12'

    cal.selectDate('2026-11-12')

    expect(cal.selectedDate).toBe('2026-11-12')
    expect(activities.selectedUuid).toBeNull()
  })

  it('sin detalle, un segundo clic en el mismo día lo deselecciona', () => {
    const cal = useCalendarStore()

    cal.selectDate('2026-11-12')
    cal.selectDate('2026-11-12')

    expect(cal.selectedDate).toBeNull()
  })

  it('cambiar de mes no cierra el detalle ni el día', () => {
    const { activities, cal } = setup()
    cal.selectedDate = '2026-11-10'

    cal.nextMonth()
    cal.prevMonth()
    cal.prevMonth()

    expect(activities.selectedUuid).toBe('A1')
    expect(cal.selectedDate).toBe('2026-11-10')
  })
})

describe('calendar store: día en la zona de la gira', () => {
  it('agrupa por el día de la gira, no por el del navegador', () => {
    const tours = useToursStore()
    tours.tours = [{ ...tour(1, '2026-01-10'), timezone: 'Asia/Tokyo' } as Tour]
    tours.activeTourId = 1
    const activities = useActivitiesStore()
    // 20:00Z del 2 de diciembre = 05:00 del 3 en Tokio.
    activities.activities = [activity('A1', '2026-12-02T20:00:00Z')]

    const cal = useCalendarStore()
    cal.selectedDate = '2026-12-03'

    expect(cal.activitiesForSelectedDate.map((a) => a.uuid)).toEqual(['A1'])
    expect(dateKeyOf('2026-12-02T20:00:00Z', 'Asia/Tokyo')).toBe('2026-12-03')
    expect(dateKeyOf('2026-12-02T20:00:00Z', 'America/Bogota')).toBe('2026-12-02')
  })
})

describe('calendar store: abrir una actividad desde el panel', () => {
  function setup(scheduledAt: string, timezone?: string) {
    const tours = useToursStore()
    tours.tours = [{ ...tour(1, '2026-01-10'), timezone } as Tour]
    tours.activeTourId = 1
    const activities = useActivitiesStore()
    const act = activity('A1', scheduledAt)
    activities.activities = [act]
    const select = vi.spyOn(activities, 'selectActivity').mockImplementation(async (uuid) => {
      activities.selectedUuid = uuid
    })
    const cal = useCalendarStore()
    cal.currentYear = 2026
    cal.currentMonth = 10
    return { act, activities, cal, select }
  }

  it('marca su día y abre el detalle', () => {
    const { act, cal, select } = setup('2026-11-12T09:00:00')

    cal.openActivity(act)

    expect(select).toHaveBeenCalledWith('A1')
    expect(cal.selectedDate).toBe('2026-11-12')
    expect([cal.currentYear, cal.currentMonth]).toEqual([2026, 10])
  })

  it('si el día cae en otro mes, la rejilla navega a ese mes (día de la gira)', () => {
    // 23:30Z del 31 de diciembre = 1 de enero en Madrid.
    const { act, cal } = setup('2026-12-31T23:30:00Z', 'Europe/Madrid')

    cal.openActivity(act)

    expect(cal.selectedDate).toBe('2027-01-01')
    expect([cal.currentYear, cal.currentMonth]).toEqual([2027, 0])
  })

  it('después, elegir el día de la propia actividad mantiene el detalle', () => {
    const { act, activities, cal } = setup('2026-11-12T09:00:00')

    cal.openActivity(act)
    cal.selectDate('2026-11-12')

    expect(activities.selectedUuid).toBe('A1')
    expect(cal.selectedDate).toBe('2026-11-12')
  })

  it('un fallo al cargar el detalle no deja la promesa sin capturar', async () => {
    const { act, activities, cal } = setup('2026-11-12T09:00:00')
    vi.spyOn(activities, 'selectActivity').mockRejectedValue(new Error('404'))

    expect(() => cal.openActivity(act)).not.toThrow()
    await Promise.resolve()
    expect(cal.selectedDate).toBe('2026-11-12')
  })
})
