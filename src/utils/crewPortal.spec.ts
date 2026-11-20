import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CrewActivity } from '@/composables/useCrewPortal'
import {
  activityTimeLabel,
  dateRange,
  dayOffsetLabel,
  dayLabel,
  detailLines,
  fileSize,
  localDate,
  localTime,
  showStatus,
  telHref,
} from './crewPortal'

// Zona del "navegador" muy distinta de las actividades: la hora debe salir del offset del ISO.
beforeAll(() => {
  vi.stubEnv('TZ', 'Pacific/Auckland')
})
afterAll(() => {
  vi.unstubAllEnvs()
})

function activity(over: Partial<CrewActivity> = {}): CrewActivity {
  return {
    uuid: 'a1',
    title: 'Show',
    description: '',
    status: 'scheduled',
    all_day: false,
    activity_type: null,
    start_local: '2026-11-24T23:30:00+01:00',
    end_local: null,
    timezone: 'Europe/Madrid',
    end_timezone: null,
    location_name: '',
    location_address: '',
    destination_name: '',
    destination_address: '',
    maps_url: null,
    details: {},
    ...over,
  }
}

describe('crewPortal utils', () => {
  it('localTime y localDate usan el offset del ISO, no la zona del navegador', () => {
    // Comprobación del entorno: en Auckland, el Date nativo daría otra hora.
    expect(new Date('2026-11-24T23:30:00+01:00').getHours()).not.toBe(23)
    expect(localTime('2026-11-24T23:30:00+01:00')).toBe('23:30')
    expect(localDate('2026-11-24T23:30:00+01:00')).toBe('2026-11-24')
    expect(localTime('2026-11-24T20:00:00-06:00')).toBe('20:00')
    expect(localTime(null)).toBe('')
    expect(localTime('basura')).toBe('')
  })

  it('activityTimeLabel solo muestra la zona si difiere de la del portal', () => {
    expect(activityTimeLabel(activity(), 'Europe/Madrid')).toMatchObject({
      start: '23:30',
      end: '',
      startZone: '',
      endZone: '',
    })
    const mx = activityTimeLabel(
      activity({ start_local: '2026-11-24T20:00:00-06:00', timezone: 'America/Mexico_City' }),
      'Europe/Madrid'
    )
    expect(mx.start).toBe('20:00')
    expect(mx.startZone).toMatch(/CST|GMT-6/)
  })

  it('vuelo con destino en otra zona: fin en su zona y +1 si cambia el día', () => {
    const label = activityTimeLabel(
      activity({
        start_local: '2026-11-24T22:00:00+01:00',
        end_local: '2026-11-25T05:30:00-05:00',
        end_timezone: 'America/New_York',
      }),
      'Europe/Madrid'
    )
    expect(label.start).toBe('22:00')
    expect(label.end).toBe('05:30')
    expect(label.endDayOffset).toBe(1)
    expect(label.endZone).toMatch(/EST|GMT-5/)
  })

  it('dayOffsetLabel lleva signo en los dos sentidos', () => {
    expect(dayOffsetLabel(0)).toBe('')
    expect(dayOffsetLabel(1)).toBe('+1')
    expect(dayOffsetLabel(-1)).toBe('\u22121')
  })

  it('formatea fechas de calendario sin desplazarlas', () => {
    expect(dayLabel('2026-11-24', 'es')).toBe('martes, 24 nov')
    expect(dateRange('2026-12-01', '2026-12-12', 'es')).toBe('1 – 12 dic 2026')
    expect(dateRange('2026-11-28', '2026-12-03', 'en')).toBe('28 Nov – 3 Dec 2026')
  })

  it('fileSize', () => {
    expect(fileSize(null)).toBe('')
    expect(fileSize(500)).toBe('500 B')
    expect(fileSize(2048)).toBe('2.0 KB')
    expect(fileSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })

  it('showStatus oculta los estados normales', () => {
    expect(showStatus('scheduled')).toBe(false)
    expect(showStatus('confirmed')).toBe(false)
    expect(showStatus('cancelled')).toBe(true)
    expect(showStatus('delayed')).toBe(true)
  })

  it('detailLines agrupa vuelo, hotel y transporte y enlaza el teléfono', () => {
    const lines = detailLines({
      airline: 'IB',
      flight_number: 'IB3166',
      terminal: '4',
      gate: 'J52',
      hotel_name: 'Hotel Sol',
      confirmation_number: 'ABC123',
      driver_name: 'Luis',
      driver_phone: '+34 600 11 22 33',
    })
    expect(lines).toHaveLength(3)
    expect(lines[0].map((p) => p.key)).toEqual(['flight', 'terminal', 'gate'])
    expect(lines[1].map((p) => p.value)).toEqual(['Hotel Sol', 'ABC123'])
    expect(lines[2][0]).toMatchObject({ key: 'driver', href: 'tel:+34600112233' })
    expect(detailLines({})).toEqual([])
  })

  it('telHref limpia separadores', () => {
    expect(telHref('(600) 11-22-33')).toBe('tel:600112233')
    expect(telHref('+52 55 1234 5678')).toBe('tel:+525512345678')
  })
})
