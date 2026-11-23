import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { inboxItem } from '@/test/inbox'
import { formatInboxItem, goToInboxTarget, inboxTargetLocation, isNoticeTarget } from './inbox'

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

  it('plan_limit al 100 % con automatic_degraded añade la frase de degradación', () => {
    const params = { percentage: 100, used: 500, limit: 500, plan_name: 'Starter' }
    expect(fmt({ kind: 'plan_limit', params: { ...params, automatic_degraded: true } }).body).toBe(
      'La gira Gira Norte ha usado las 500 notificaciones de WhatsApp del plan Starter. Cambia de plan para seguir enviando. Los recordatorios automáticos pasan a email y aviso en la app, y no se envía ningún WhatsApp hasta que cambies de plan.'
    )
    expect(fmt({ kind: 'plan_limit', params }).body).not.toContain('recordatorios automáticos')
    expect(
      fmt({ kind: 'plan_limit', params: { ...params, percentage: 80, automatic_degraded: true } })
        .body
    ).not.toContain('recordatorios automáticos')
  })

  it('plan_limit con suscripción no activa usa su propio texto, sin porcentaje', () => {
    const item = fmt({
      kind: 'plan_limit',
      params: { automatic_degraded: true, reason: 'subscription_inactive', plan_name: 'Starter', status: 'pending' },
    })
    expect(item.title).toBe('Tu plan aún no está activo')
    expect(item.body).toBe(
      'El plan Starter de la gira Gira Norte todavía no está activo. Los recordatorios automáticos pasan a email y aviso en la app, y no se envía ningún WhatsApp hasta que cambies de plan.'
    )
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

describe('formatInboxItem: billing_discrepancy', () => {
  it('formats billing_discrepancy in es and en with plural', () => {
    const one = {
      kind: 'billing_discrepancy',
      tour: null,
      params: { new_count: 1, date: '2026-11-21' },
    }
    const many = { ...one, params: { new_count: 4, date: '2026-11-21' } }
    expect(fmt(one)).toEqual({
      title: 'Discrepancias en la facturación de Twilio',
      body: '1 discrepancia nueva en la auditoría de Twilio.',
    })
    expect(fmt(many).body).toBe('4 discrepancias nuevas en la auditoría de Twilio.')
    i18n.global.locale.value = 'en'
    expect(fmt(one)).toEqual({
      title: 'Twilio billing discrepancies',
      body: '1 new discrepancy in the Twilio audit.',
    })
    expect(fmt(many).body).toBe('4 new discrepancies in the Twilio audit.')
    // Sin `new_count`, cuerpo del backend.
    expect(fmt({ kind: 'billing_discrepancy', params: {}, body: 'B' }).body).toBe('B')
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

  it('maps admin_costs target to admin costs tab', async () => {
    const item = inboxItem({
      kind: 'billing_discrepancy',
      tour: null,
      target: { type: 'admin_costs', tour_uuid: null, activity_uuid: null, conflict_uuid: null },
    })
    expect(inboxTargetLocation(item)).toEqual({ path: '/admin', query: { tab: 'costs' } })
    const router = { push: vi.fn().mockResolvedValue(undefined) }
    const tours = { setActiveTourByUuid: vi.fn(() => true) }
    expect(await goToInboxTarget(item, router, tours)).toBe(true)
    expect(router.push).toHaveBeenCalledWith({ path: '/admin', query: { tab: 'costs' } })
    expect(tours.setActiveTourByUuid).not.toHaveBeenCalled()
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

describe('avisos bajo demanda (R2)', () => {
  it('formatea flight_early en es y en', () => {
    const item = {
      kind: 'flight_early',
      params: { flight_number: 'IB3456', minutes: 35, route: 'MAD → BCN', notice_uuid: 'N1' },
    }
    expect(fmt(item)).toEqual({
      title: 'Vuelo IB3456 adelantado 35 min',
      body: 'MAD → BCN. Revisa el aviso y envíalo al equipo.',
    })
    i18n.global.locale.value = 'en'
    expect(fmt(item).title).toBe('Flight IB3456 departing 35 min early')
  })

  it('flight_early sin ruta no empieza por ". " y sin params cae a la copia del backend', () => {
    expect(fmt({ kind: 'flight_early', params: { flight_number: 'IB1', minutes: -20 } })).toEqual({
      title: 'Vuelo IB1 adelantado 20 min',
      body: 'Revisa el aviso y envíalo al equipo.',
    })
    expect(fmt({ kind: 'flight_early', params: {}, title: 'T', body: 'B' })).toEqual({
      title: 'T',
      body: 'B',
    })
  })

  it('destino notice lleva a la pestaña Avisos con el aviso abierto', () => {
    const item = inboxItem({
      kind: 'flight_delay',
      target: {
        type: 'notice',
        tour_uuid: 'T1',
        activity_uuid: 'A1',
        conflict_uuid: null,
        notice_uuid: 'N1',
      },
    })
    expect(inboxTargetLocation(item)).toEqual({
      path: '/tour',
      query: { tab: 'notices', notice: 'N1' },
    })
  })

  it('destino notice sin uuid en target usa params.notice_uuid, o solo la pestaña', () => {
    const base = { type: 'notice' as const, tour_uuid: 'T1', activity_uuid: null, conflict_uuid: null }
    expect(
      inboxTargetLocation(inboxItem({ params: { notice_uuid: 'N2' }, target: base }))
    ).toEqual({ path: '/tour', query: { tab: 'notices', notice: 'N2' } })
    expect(inboxTargetLocation(inboxItem({ target: base }))).toEqual({
      path: '/tour',
      query: { tab: 'notices' },
    })
  })

  it('goToInboxTarget activa la gira del aviso antes de navegar', async () => {
    const router = { push: vi.fn().mockResolvedValue(undefined) }
    const tours = { setActiveTourByUuid: vi.fn().mockReturnValue(true) }
    const item = inboxItem({
      target: {
        type: 'notice',
        tour_uuid: 'T9',
        activity_uuid: null,
        conflict_uuid: null,
        notice_uuid: 'N1',
      },
    })
    expect(await goToInboxTarget(item, router, tours)).toBe(true)
    expect(tours.setActiveTourByUuid).toHaveBeenCalledWith('T9')
    expect(router.push).toHaveBeenCalledWith({
      path: '/tour',
      query: { tab: 'notices', notice: 'N1' },
    })
  })
})

describe('plan_limit sin porcentaje (cupo fail-closed)', () => {
  const noticeTarget = {
    type: 'notice' as const,
    tour_uuid: 'T1',
    activity_uuid: null,
    conflict_uuid: null,
    notice_uuid: 'N9',
  }

  it('plan_limit_unavailable: el limitador no responde', () => {
    const item = { kind: 'plan_limit', params: { reason: 'plan_limit_unavailable' } }
    expect(fmt(item)).toEqual({
      title: 'No se ha podido comprobar el cupo de WhatsApp',
      body: 'Los envíos se reintentan solos; si persiste, avísanos.',
    })
    i18n.global.locale.value = 'en'
    expect(fmt(item).title).toBe("We couldn't check the WhatsApp quota")
  })

  it('notice_blocked: texto propio y enlace al aviso, sin "Revisar y enviar"', () => {
    const item = inboxItem({
      kind: 'plan_limit',
      params: { reason: 'notice_blocked', notice_uuid: 'N9', notice_origin: 'urgent' },
      target: noticeTarget,
    })
    expect(formatInboxItem(item, t)).toEqual({
      title: 'Un aviso no se ha enviado por WhatsApp',
      body: 'Se ha agotado el cupo del plan. Envíalo por email o en la app, o cambia de plan.',
    })
    expect(inboxTargetLocation(item)).toEqual({
      path: '/tour',
      query: { tab: 'notices', notice: 'N9' },
    })
    expect(isNoticeTarget(item)).toBe(false)
    expect(isNoticeTarget(inboxItem({ kind: 'flight_delay', target: noticeTarget }))).toBe(true)
    i18n.global.locale.value = 'en'
    expect(formatInboxItem(item, t).title).toBe("A notice wasn't sent by WhatsApp")
  })

  it('notice_quota_unavailable: aviso cerrado sin enviarse', () => {
    const item = {
      kind: 'plan_limit',
      params: { reason: 'notice_quota_unavailable', notice_uuid: 'N9' },
    }
    expect(fmt(item)).toEqual({
      title: 'Un aviso se ha cerrado sin enviarse',
      body: 'No se ha podido comprobar el cupo de WhatsApp del plan.',
    })
    i18n.global.locale.value = 'en'
    expect(fmt(item).body).toBe("We couldn't check the plan's WhatsApp quota.")
  })

  it('un reason desconocido sin porcentaje sigue usando la copia del backend', () => {
    expect(
      fmt({ kind: 'plan_limit', params: { reason: 'xyz' }, title: 'T', body: 'B' })
    ).toEqual({ title: 'T', body: 'B' })
  })
})

describe('import_done (F2)', () => {
  const params = {
    job_uuid: 'J1',
    created: 44,
    replaced: 1,
    reminders: 120,
    first_send_at: '2026-11-30T08:00:00Z',
    paused: false,
  }
  // Lo que manda el backend (`import_done_texts`, en la zona de la gira).
  const backend = { title: 'Importación: 44 actividades creadas', body: 'Cuerpo del backend' }

  it('título con las creadas y cuerpo con recordatorios y primer envío en la zona de la gira', () => {
    const text = formatInboxItem(
      inboxItem({ kind: 'import_done', params, ...backend }),
      t,
      'es',
      'Europe/Madrid'
    )
    expect(text.title).toBe('Importación: 44 actividades creadas')
    expect(text.body).toMatch(
      /^También se ha actualizado 1 actividad\. 120 recordatorios programados\. Primer envío: 30 nov/
    )
    expect(text.body).toContain('09:00')
  })

  it('sin la zona de la gira (params no la traen): cuerpo del backend', () => {
    const text = formatInboxItem(inboxItem({ kind: 'import_done', params, ...backend }), t, 'es')
    expect(text.title).toBe('Importación: 44 actividades creadas')
    expect(text.body).toBe('Cuerpo del backend')
  })

  it('solo sustituciones: el título las cuenta (no "0 actividades creadas")', () => {
    const only = { ...params, created: 0, replaced: 3 }
    expect(formatInboxItem(inboxItem({ kind: 'import_done', params: only }), t).title).toBe(
      'Importación: 3 actividades actualizadas'
    )
    expect(
      formatInboxItem(inboxItem({ kind: 'import_done', params: { ...only, replaced: 1 } }), t).title
    ).toBe('Importación: 1 actividad actualizada')
  })

  it('con la gira en pausa, el cuerpo lo dice; singular con una actividad', () => {
    const text = formatInboxItem(
      inboxItem({ kind: 'import_done', params: { ...params, created: 1, replaced: 0, paused: true } }),
      t
    )
    expect(text.title).toBe('Importación: 1 actividad creada')
    expect(text.body).toBe('Los avisos de la gira están en pausa.')
  })

  it('sin recordatorios, sin params o en inglés', () => {
    expect(
      formatInboxItem(
        inboxItem({ kind: 'import_done', params: { ...params, replaced: 0, reminders: 0, first_send_at: '' } }),
        t
      ).body
    ).toBe('No hay recordatorios programados.')
    expect(formatInboxItem(inboxItem({ kind: 'import_done', params: {} }), t)).toEqual({
      title: 'Título',
      body: 'Cuerpo',
    })
    i18n.global.locale.value = 'en'
    const en = formatInboxItem(
      inboxItem({ kind: 'import_done', params: { ...params, replaced: 0 } }),
      t,
      'en',
      'Europe/Madrid'
    )
    expect(en.title).toBe('Import: 44 activities created')
    expect(en.body).toMatch(/^120 reminders scheduled\. First send: 30 Nov/)
  })

  it('lleva a la revisión del job y activa su gira', async () => {
    const item = inboxItem({ kind: 'import_done', params })
    expect(inboxTargetLocation(item)).toEqual({ name: 'tour-import', params: { jobUuid: 'J1' } })
    expect(inboxTargetLocation(inboxItem({ kind: 'import_done', params: {} }))).toBeNull()
    const router = { push: vi.fn().mockResolvedValue(undefined) }
    const tours = { setActiveTourByUuid: vi.fn(() => true) }
    expect(await goToInboxTarget(item, router, tours)).toBe(true)
    expect(tours.setActiveTourByUuid).toHaveBeenCalledWith('T1')
    expect(isNoticeTarget(item)).toBe(false)
  })
})

describe('import_pending, ical_sync_failed e import_done con canceladas (F3)', () => {
  const pending = {
    job_uuid: 'J9',
    calendar: 'Gira 2027 (iCloud)',
    new: 3,
    changed: 1,
    cancelled: 1,
    source: 'ical',
  }

  it('import_pending: título con el total y cuerpo con los recuentos; lleva a la revisión', async () => {
    const item = inboxItem({ kind: 'import_pending', params: pending })
    expect(formatInboxItem(item, t)).toEqual({
      title: 'Cambios en Gira 2027 (iCloud): 5 por revisar',
      body: '3 nuevas · 1 cambiada · 1 cancelada',
    })
    // Solo los recuentos mayores que 0 (como el backend), con plural.
    expect(fmt({ kind: 'import_pending', params: { ...pending, new: 1, changed: 0 } }).body).toBe(
      '1 nueva · 1 cancelada'
    )
    expect(
      fmt({ kind: 'import_pending', params: { ...pending, new: 0, changed: 2, cancelled: 0 } }).body
    ).toBe('2 cambiadas')
    // Todo a 0: la copia del backend.
    expect(
      fmt({ kind: 'import_pending', params: { ...pending, new: 0, changed: 0, cancelled: 0 } }).body
    ).toBe('Cuerpo')
    expect(inboxTargetLocation(item)).toEqual({ name: 'tour-import', params: { jobUuid: 'J9' } })
    const router = { push: vi.fn().mockResolvedValue(undefined) }
    const tours = { setActiveTourByUuid: vi.fn(() => true) }
    expect(await goToInboxTarget(item, router, tours)).toBe(true)
    expect(router.push).toHaveBeenCalledWith({ name: 'tour-import', params: { jobUuid: 'J9' } })
    // Activa la gira del ítem (el backend manda `target.type="none"` sin gira).
    const noTarget = inboxItem({
      kind: 'import_pending',
      params: pending,
      tour: { uuid: 'T7', name: 'Gira Sur' },
      target: { type: 'none', tour_uuid: null, activity_uuid: null, conflict_uuid: null },
    })
    await goToInboxTarget(noTarget, router, tours)
    expect(tours.setActiveTourByUuid).toHaveBeenLastCalledWith('T7')
    // Sin nombre de calendario: "tu calendario"; sin recuentos: la copia del backend.
    expect(fmt({ kind: 'import_pending', params: { ...pending, calendar: '' } }).title).toBe(
      'Cambios en tu calendario: 5 por revisar'
    )
    expect(fmt({ kind: 'import_pending', params: { job_uuid: 'J9' } })).toEqual({
      title: 'Título',
      body: 'Cuerpo',
    })
    expect(inboxTargetLocation(inboxItem({ kind: 'import_pending', params: {} }))).toBeNull()
    i18n.global.locale.value = 'en'
    expect(formatInboxItem(item, t).title).toBe('Changes in Gira 2027 (iCloud): 5 to review')
  })

  it('ical_sync_failed: motivo traducido (nunca el código) y destino Ajustes › Calendarios', () => {
    const item = inboxItem({
      kind: 'ical_sync_failed',
      params: { subscription_uuid: 'S1', calendar: 'Gira 2027', error_code: 'http_404' },
    })
    const text = formatInboxItem(item, t)
    expect(text.title).toBe('No podemos leer el calendario Gira 2027')
    expect(text.body).toBe(
      'El calendario ya no está publicado o la dirección ha cambiado. Hemos pausado la sincronización tras varios intentos; puedes reanudarla en Ajustes › Calendarios.'
    )
    expect(
      fmt({ kind: 'ical_sync_failed', params: { subscription_uuid: 'S1', calendar: '', error_code: 'http_503' } })
    ).toEqual({
      title: 'No podemos leer tu calendario',
      body: 'No hemos podido conectar con el calendario. Hemos pausado la sincronización tras varios intentos; puedes reanudarla en Ajustes › Calendarios.',
    })
    expect(text.body).not.toContain('http_404')
    expect(inboxTargetLocation(item)).toEqual({ path: '/settings', query: { tab: 'calendars' } })
    const unknown = formatInboxItem(
      inboxItem({ kind: 'ical_sync_failed', params: { calendar: 'X', error_code: 'raro' } }),
      t
    )
    expect(unknown.body).toMatch(/^No se ha podido completar\. Inténtalo de nuevo\. Hemos pausado/)
    expect(fmt({ kind: 'ical_sync_failed', params: {} })).toEqual({ title: 'Título', body: 'Cuerpo' })
  })

  it('import_done con params.cancelled añade las canceladas al título', () => {
    const params = {
      job_uuid: 'J1',
      created: 2,
      replaced: 0,
      cancelled: 3,
      reminders: 0,
      first_send_at: '',
      paused: false,
    }
    expect(formatInboxItem(inboxItem({ kind: 'import_done', params }), t).title).toBe(
      'Importación: 2 actividades creadas · 3 canceladas'
    )
    expect(
      formatInboxItem(inboxItem({ kind: 'import_done', params: { ...params, cancelled: 0 } }), t).title
    ).toBe('Importación: 2 actividades creadas')
    // Solo canceladas: el título las cuenta a ellas.
    expect(
      formatInboxItem(
        inboxItem({ kind: 'import_done', params: { ...params, created: 0, cancelled: 1 } }),
        t
      ).title
    ).toBe('Importación: 1 actividad cancelada')
    // Plural también en el añadido: "· 1 cancelada".
    expect(
      formatInboxItem(
        inboxItem({ kind: 'import_done', params: { ...params, cancelled: 1 } }),
        t
      ).title
    ).toBe('Importación: 2 actividades creadas · 1 cancelada')
  })
})
