import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { inboxItem } from '@/test/inbox'
import { formatInboxItem, goToInboxTarget, inboxTargetLocation } from './inbox'

const t = i18n.global.t

function fmt(overrides: Parameters<typeof inboxItem>[0]) {
  return formatInboxItem(inboxItem(overrides), t)
}

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('formatInboxItem', () => {
  it('formats each kind in es and en', () => {
    const conflict = {
      kind: 'schedule_conflict',
      params: {
        conflict_type: 'overlap',
        activity_a_title: 'Prueba de sonido',
        activity_b_title: 'Entrevista',
      },
    }
    const delay = {
      kind: 'flight_delay',
      params: {
        flight_number: 'IB3456',
        route: 'MAD → BCN',
        delay_minutes: 45,
        prev_delay_minutes: 20,
        gate: 'B12',
      },
    }
    const cancelled = { kind: 'flight_cancelled', params: { flight_number: 'VY1000' } }
    const diverted = { kind: 'flight_diverted', params: { flight_number: 'VY1000' } }
    const warning = {
      kind: 'plan_limit',
      params: { percentage: 80, used: 400, limit: 500, plan_name: 'Starter' },
    }
    const reached = {
      kind: 'plan_limit',
      params: { percentage: 100, used: 500, limit: 500, plan_name: 'Starter' },
    }

    expect(fmt(conflict)).toEqual({
      title: 'Conflicto de agenda',
      body: '«Prueba de sonido» se solapa con «Entrevista».',
    })
    expect(
      fmt({ ...conflict, params: { ...conflict.params, conflict_type: 'travel_time' } }).body
    ).toBe('No hay tiempo suficiente para llegar de «Prueba de sonido» a «Entrevista».')
    expect(fmt(delay)).toEqual({
      title: 'Vuelo IB3456 con 45 min de retraso',
      body: 'MAD → BCN. Antes llevaba 20 min de retraso. Puerta B12.',
    })
    expect(fmt(cancelled)).toEqual({
      title: 'Vuelo VY1000 cancelado',
      body: 'Contacta con la aerolínea para buscar alternativas.',
    })
    expect(fmt(diverted).title).toBe('Vuelo VY1000 desviado')
    expect(fmt(warning)).toEqual({
      title: 'Has usado el 80 % de tus notificaciones',
      body: 'La gira Gira Norte lleva 400 de 500 notificaciones de WhatsApp del plan Starter.',
    })
    expect(fmt(reached)).toEqual({
      title: 'Has alcanzado el límite de notificaciones',
      body: 'La gira Gira Norte ha usado las 500 notificaciones de WhatsApp del plan Starter. Cambia de plan para seguir enviando.',
    })

    i18n.global.locale.value = 'en'
    expect(fmt(conflict)).toEqual({
      title: 'Schedule conflict',
      body: '"Prueba de sonido" overlaps with "Entrevista".',
    })
    expect(fmt(delay)).toEqual({
      title: 'Flight IB3456 delayed 45 min',
      body: 'MAD → BCN. Previous delay: 20 min. Gate B12.',
    })
    expect(fmt(cancelled).title).toBe('Flight VY1000 cancelled')
    expect(fmt(diverted).body).toBe('Check the new destination with the airline.')
    expect(fmt(warning).title).toBe("You've used 80% of your notifications")
    expect(fmt(reached).title).toBe("You've reached your notification limit")
    expect(fmt({ kind: 'delivery_failed', params: { failed_count: 2 } }).title).toBe(
      'Undelivered messages'
    )
  })

  it('falls back to title and body for message and unknown kind', () => {
    const msg = fmt({ kind: 'message', title: 'Cambio de hotel', body: '<b>Ojo</b> al check-in' })
    expect(msg).toEqual({ title: 'Cambio de hotel', body: '<b>Ojo</b> al check-in' })
    i18n.global.locale.value = 'en'
    expect(fmt({ kind: 'message', title: 'Cambio de hotel', body: 'x' }).title).toBe(
      'Cambio de hotel'
    )
    expect(fmt({ kind: 'future_kind', title: 'Algo nuevo', body: 'Detalle' })).toEqual({
      title: 'Algo nuevo',
      body: 'Detalle',
    })
    // Sin los params necesarios, se usa la copia del backend.
    expect(fmt({ kind: 'flight_delay', params: {}, title: 'T', body: 'B' })).toEqual({
      title: 'T',
      body: 'B',
    })
    expect(fmt({ kind: 'schedule_conflict', params: {}, body: 'B' })).toEqual({
      title: 'Schedule conflict',
      body: 'B',
    })
  })

  it('omits empty route in flight delay', () => {
    const r = fmt({
      kind: 'flight_delay',
      params: {
        flight_number: 'IB1',
        route: '',
        delay_minutes: 60,
        prev_delay_minutes: 45,
        gate: '',
      },
    })
    expect(r.body).toBe('Antes llevaba 45 min de retraso.')
    i18n.global.locale.value = 'en'
    const en = fmt({
      kind: 'flight_delay',
      params: { flight_number: 'IB1', delay_minutes: 60, prev_delay_minutes: 45 },
    })
    expect(en.body).toBe('Previous delay: 45 min.')
  })

  it('pluralizes delivery_failed', () => {
    expect(
      fmt({ kind: 'delivery_failed', params: { failed_count: 1, date: '2026-11-21' } }).body
    ).toBe('1 envío de Gira Norte no se ha entregado hoy. Revisa los fallos en Informes.')
    expect(
      fmt({ kind: 'delivery_failed', params: { failed_count: 3, date: '2026-11-21' } }).body
    ).toBe('3 envíos de Gira Norte no se han entregado hoy. Revisa los fallos en Informes.')
    i18n.global.locale.value = 'en'
    expect(fmt({ kind: 'delivery_failed', params: { failed_count: 1 } }).body).toBe(
      "1 message from Gira Norte wasn't delivered today. Check the failures in Reports."
    )
    expect(fmt({ kind: 'delivery_failed', params: { failed_count: 4 } }).body).toBe(
      "4 messages from Gira Norte weren't delivered today. Check the failures in Reports."
    )
  })
})

describe('inboxTargetLocation', () => {
  const target = (type: string, activity_uuid: string | null = null) =>
    inboxItem({
      target: { type: type as never, tour_uuid: 'T1', activity_uuid, conflict_uuid: null },
    })

  it('maps every target type to a route', () => {
    expect(inboxTargetLocation(target('activity', 'A1'))).toEqual({
      path: '/events',
      query: { activity: 'A1' },
    })
    expect(inboxTargetLocation(target('conflict'))).toEqual({
      path: '/tour',
      query: { tab: 'conflicts' },
    })
    expect(inboxTargetLocation(target('plan'))).toEqual({
      path: '/settings',
      query: { tab: 'subscription' },
    })
    expect(inboxTargetLocation(target('reports'))).toEqual({ path: '/reports' })
  })

  it('returns null for none and missing activity uuid', () => {
    expect(inboxTargetLocation(target('none'))).toBeNull()
    expect(inboxTargetLocation(target('activity', null))).toBeNull()
  })

  it('goToInboxTarget activates the tour and pushes only with a destination', async () => {
    const router = { push: vi.fn().mockResolvedValue(undefined) }
    const tours = { setActiveTourByUuid: vi.fn(() => true) }
    expect(await goToInboxTarget(target('reports'), router, tours)).toBe(true)
    expect(tours.setActiveTourByUuid).toHaveBeenCalledWith('T1')
    expect(router.push).toHaveBeenCalledWith({ path: '/reports' })

    router.push.mockClear()
    tours.setActiveTourByUuid.mockClear()
    expect(await goToInboxTarget(target('none'), router, tours)).toBe(false)
    expect(router.push).not.toHaveBeenCalled()
    expect(tours.setActiveTourByUuid).not.toHaveBeenCalled()
  })
})
