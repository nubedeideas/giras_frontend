import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import type { ActivityListItem } from '@/composables/useActivities'
import type { ReminderTypeSetting } from '@/composables/useReminderSettings'
import type { SubscriptionUsage } from '@/composables/useSubscription'
import type { ReportsSummary } from '@/composables/useNotificationReports'
import {
  activityLocalTime,
  buildPendingItems,
  dashboardZone,
  isOngoing,
  ongoingUuids,
  joinTypeNames,
  planLevel,
  relativeDay,
  sendsBars,
  sendsFigures,
  upcomingWithin,
  type PendingInput,
} from './dashboard'

const NOW = DateTime.fromISO('2026-11-22T21:00:00Z')

function act(over: Partial<ActivityListItem> = {}): ActivityListItem {
  return {
    uuid: over.uuid ?? 'a',
    title: 'Show',
    scheduled_at: '2026-11-23T10:00:00Z',
    end_at: null,
    timezone: 'Europe/Madrid',
    local_start_time: null,
    status: 'scheduled',
    priority: 'normal',
    all_day: false,
    location_name: '',
    destination_name: '',
    activity_type_name: 'Concierto',
    activity_type_code: 'concert',
    activity_type_icon: '',
    activity_type_color: '#000',
    category: 'show',
    ...over,
  }
}

function usage(over: Partial<SubscriptionUsage> = {}): SubscriptionUsage {
  return {
    plan_code: 'basic' as SubscriptionUsage['plan_code'],
    plan_name: 'Básico',
    notifications_used: 10,
    notification_limit: 100,
    remaining: 90,
    usage_percentage: 10,
    is_unlimited: false,
    shows_used: 1,
    shows_limit: 10,
    is_active: true,
    ...over,
  }
}

function type(
  code: string,
  name: string,
  warnings: string[],
  steps: ReminderTypeSetting['effective_steps'] = [{ minutes: 60, channel: 'whatsapp' }]
): ReminderTypeSetting {
  return {
    activity_type_code: code,
    name,
    category: 'x',
    icon: '',
    color: '#000',
    template_steps: [],
    tour_steps: null,
    effective_steps: steps,
    steps_source: 'user',
    groups: [],
    base_source: 'admins',
    replaced_by_legacy_rule: false,
    warnings,
  }
}

function input(over: Partial<PendingInput> = {}): PendingInput {
  return {
    isAdmin: true,
    usage: usage(),
    pendingNotices: [],
    aiPending: 0,
    aiSuggestions: 0,
    catalogTypes: [],
    activities: [],
    now: NOW,
    ...over,
  }
}

describe('upcomingWithin', () => {
  it('incluye las de las próximas 24 h y las en curso, ordenadas', () => {
    const list = [
      act({ uuid: 'later', scheduled_at: '2026-11-23T18:00:00Z' }),
      act({ uuid: 'soon', scheduled_at: '2026-11-22T22:00:00Z' }),
      act({ uuid: 'ongoing', scheduled_at: '2026-11-22T20:00:00Z', end_at: '2026-11-22T23:00:00Z' }),
    ]
    expect(upcomingWithin(list, NOW).map((a) => a.uuid)).toEqual(['ongoing', 'soon', 'later'])
  })

  it('excluye canceladas, pasadas y las que empiezan a partir de 24 h', () => {
    const list = [
      act({ uuid: 'cancelled', status: 'cancelled', scheduled_at: '2026-11-22T22:00:00Z' }),
      act({ uuid: 'past', scheduled_at: '2026-11-22T19:00:00Z', end_at: '2026-11-22T20:00:00Z' }),
      act({ uuid: 'past-no-end', scheduled_at: '2026-11-22T18:30:00Z' }),
      act({ uuid: 'edge', scheduled_at: '2026-11-23T21:00:00Z' }),
      act({ uuid: 'in', scheduled_at: '2026-11-23T20:59:00Z' }),
    ]
    expect(upcomingWithin(list, NOW).map((a) => a.uuid)).toEqual(['in'])
  })

  it('la ventana es de instantes: no depende de la zona de la actividad', () => {
    const tokyo = act({ uuid: 't', timezone: 'Asia/Tokyo', scheduled_at: '2026-11-23T05:00:00Z' })
    const mex = act({
      uuid: 'm',
      timezone: 'America/Mexico_City',
      scheduled_at: '2026-11-23T05:00:00Z',
    })
    expect(upcomingWithin([tokyo, mex], NOW)).toHaveLength(2)
  })
})

describe('en curso sin end_at', () => {
  it('cuenta 2 h desde el inicio', () => {
    const started = act({ scheduled_at: '2026-11-22T20:00:00Z', end_at: null })
    expect(isOngoing(started, NOW)).toBe(true)
    const old = act({ scheduled_at: '2026-11-22T18:59:00Z', end_at: null })
    expect(isOngoing(old, NOW)).toBe(false)
  })

  it('o hasta que empieza la siguiente, lo que llegue antes', () => {
    const show = act({ uuid: 'show', scheduled_at: '2026-11-22T20:00:00Z', end_at: null })
    const after = act({ uuid: 'after', scheduled_at: '2026-11-22T20:30:00Z', end_at: null })
    expect(isOngoing(show, NOW, DateTime.fromISO('2026-11-22T20:30:00Z').toMillis())).toBe(false)
    expect([...ongoingUuids([show, after], NOW)]).toEqual(['after'])
  })

  it('un show que acaba de empezar sigue en Próximas 24 h y fija la zona', () => {
    const show = act({
      uuid: 'show',
      timezone: 'America/Mexico_City',
      scheduled_at: '2026-11-22T20:45:00Z',
      end_at: null,
    })
    const later = act({ uuid: 'later', timezone: 'Europe/Madrid', scheduled_at: '2026-11-23T20:00:00Z' })
    expect(upcomingWithin([show, later], NOW).map((a) => a.uuid)).toEqual(['show', 'later'])
    expect(dashboardZone([show, later], NOW)).toBe('America/Mexico_City')
  })
})

describe('hora y día en la zona de la gira', () => {
  it('usa local_start_time si viene', () => {
    expect(
      activityLocalTime(act({ local_start_time: '2026-11-23T11:00:00+01:00' }))
    ).toBe('11:00')
  })

  it('sin local_start_time convierte scheduled_at a la zona de la actividad', () => {
    expect(activityLocalTime(act({ scheduled_at: '2026-11-23T10:00:00Z' }))).toBe('11:00')
    expect(
      activityLocalTime(act({ scheduled_at: '2026-11-23T10:00:00Z', timezone: 'America/Mexico_City' }))
    ).toBe('04:00')
  })

  it('Hoy/Mañana según el día natural de la zona de la actividad', () => {
    // 21:00Z = 22:00 en Madrid (día 22) y 06:00 del día 23 en Tokio.
    const madridTomorrow = act({ scheduled_at: '2026-11-23T08:00:00Z' })
    expect(relativeDay(madridTomorrow, NOW)).toBe('tomorrow')
    const tokyoToday = act({ scheduled_at: '2026-11-23T08:00:00Z', timezone: 'Asia/Tokyo' })
    expect(relativeDay(tokyoToday, NOW)).toBe('today')
    const madridToday = act({ scheduled_at: '2026-11-22T22:30:00Z' })
    expect(relativeDay(madridToday, NOW)).toBe('today')
  })

  it('dashboardZone toma la zona de la próxima actividad', () => {
    const list = [
      act({ uuid: 'past', scheduled_at: '2026-11-20T10:00:00Z', timezone: 'Europe/London' }),
      act({ uuid: 'next', scheduled_at: '2026-11-24T10:00:00Z', timezone: 'Asia/Tokyo' }),
    ]
    expect(dashboardZone(list, NOW)).toBe('Asia/Tokyo')
    expect(dashboardZone([list[0]], NOW)).toBe('Europe/London')
  })
})

describe('planLevel', () => {
  it('niveles por umbral', () => {
    expect(planLevel(null)).toBeNull()
    expect(planLevel(usage({ is_unlimited: true, usage_percentage: 150 }))).toBe('unlimited')
    expect(planLevel(usage({ usage_percentage: 79.9 }))).toBe('ok')
    expect(planLevel(usage({ usage_percentage: 80 }))).toBe('warning')
    expect(planLevel(usage({ usage_percentage: 100 }))).toBe('reached')
  })
})

describe('buildPendingItems', () => {
  const future = [act({ activity_type_code: 'concert', scheduled_at: '2026-11-25T10:00:00Z' })]

  it('un no admin solo ve el cupo', () => {
    const items = buildPendingItems(
      input({
        isAdmin: false,
        usage: usage({ usage_percentage: 85 }),
        pendingNotices: [{ uuid: 'n1' }],
        aiPending: 2,
        aiSuggestions: 1,
        catalogTypes: [type('concert', 'Concierto', ['default_group_empty'])],
        activities: future,
      })
    )
    expect(items.map((i) => i.key)).toEqual(['plan-warning'])
  })

  it('80 % es aviso, 100 % crítico e ilimitado no sale', () => {
    expect(buildPendingItems(input({ usage: usage({ usage_percentage: 80 }) }))[0].severity).toBe(
      'warning'
    )
    const reached = buildPendingItems(input({ usage: usage({ usage_percentage: 100 }) }))
    expect(reached[0]).toMatchObject({ key: 'plan-reached', severity: 'critical' })
    expect(
      buildPendingItems(input({ usage: usage({ is_unlimited: true, usage_percentage: 300 }) }))
    ).toEqual([])
  })

  it('agrupa avisos de audiencia por código e ignora in_app_users_only', () => {
    const items = buildPendingItems(
      input({
        catalogTypes: [
          type('concert', 'Concierto', ['default_group_empty', 'in_app_users_only']),
          type('flight', 'Vuelo', ['default_group_empty', 'admins_without_phone']),
        ],
        activities: [
          ...future,
          act({ uuid: 'f', activity_type_code: 'flight', scheduled_at: '2026-11-26T10:00:00Z' }),
        ],
      })
    )
    expect(items.map((i) => i.key)).toEqual([
      'audience:default_group_empty',
      'audience:admins_without_phone',
    ])
    // Aviso de la gira: una fila, sin lista de tipos.
    expect(items[0].typeNames).toBeUndefined()
    expect(items[0].ctaKey).toBe('dashboard.pending.addTeam')
    expect(items[1].ctaKey).toBe('dashboard.pending.complete')
  })

  it('los avisos de la gira salen aunque no haya actividades futuras (payload real de dev)', () => {
    const warnings = ['default_group_empty', 'admins_without_phone', 'in_app_users_only']
    const catalogTypes = Array.from({ length: 22 }, (_, i) => type(`t${i}`, `Tipo ${i}`, warnings))
    const items = buildPendingItems(
      input({
        catalogTypes,
        activities: [act({ activity_type_code: 't0', scheduled_at: '2026-10-01T10:00:00Z' })],
      })
    )
    expect(items.map((i) => i.key)).toEqual([
      'audience:default_group_empty',
      'audience:admins_without_phone',
    ])
    expect(items.map((i) => i.ctaKey)).toEqual([
      'dashboard.pending.addTeam',
      'dashboard.pending.complete',
    ])
    // Otro admin sin teléfono: a Contactos (su teléfono sale del contacto vinculado).
    expect(items[1].to).toEqual({ path: '/contacts' })
  })

  it('admins_without_phone lleva a tu perfil si eres tú quien no tiene teléfono', () => {
    const items = buildPendingItems(
      input({
        catalogTypes: [type('concert', 'Concierto', ['admins_without_phone'])],
        selfMissingPhone: true,
      })
    )
    expect(items[0].to).toEqual({ path: '/settings', query: { tab: 'general' } })
  })

  it('los avisos solo cuentan si el tipo avisa (pasos efectivos o regla legada)', () => {
    const warnings = ['default_group_empty', 'admins_without_phone']
    expect(
      buildPendingItems(input({ catalogTypes: [type('concert', 'Concierto', warnings, [])] }))
    ).toEqual([])
    const legacy = { ...type('concert', 'Concierto', warnings, []), replaced_by_legacy_rule: true }
    expect(buildPendingItems(input({ catalogTypes: [legacy] })).map((i) => i.key)).toEqual([
      'audience:default_group_empty',
      'audience:admins_without_phone',
    ])
    // Uno que avisa basta aunque otros no.
    expect(
      buildPendingItems(
        input({
          catalogTypes: [
            type('a', 'A', ['default_group_empty'], []),
            type('b', 'B', ['default_group_empty']),
          ],
        })
      )
    ).toHaveLength(1)
  })

  it('type_groups_empty lista los tipos afectados con actividades futuras', () => {
    const items = buildPendingItems(
      input({
        catalogTypes: [
          type('concert', 'Concierto', ['type_groups_empty']),
          type('flight', 'Vuelo', ['type_groups_empty']),
        ],
        activities: future,
      })
    )
    expect(items).toHaveLength(1)
    expect(items[0].typeNames).toEqual(['Concierto'])
  })

  it('ignora avisos del tipo sin actividades futuras no canceladas', () => {
    const items = buildPendingItems(
      input({
        catalogTypes: [type('concert', 'Concierto', ['type_groups_empty'])],
        activities: [
          act({ activity_type_code: 'concert', scheduled_at: '2026-11-20T10:00:00Z' }),
          act({
            uuid: 'c',
            activity_type_code: 'concert',
            status: 'cancelled',
            scheduled_at: '2026-11-25T10:00:00Z',
          }),
        ],
      })
    )
    expect(items).toEqual([])
  })

  it('ordena por severidad: crítico, aviso, info', () => {
    const items = buildPendingItems(
      input({
        usage: usage({ usage_percentage: 100 }),
        pendingNotices: [{ uuid: 'n1' }, { uuid: 'n2' }],
        aiPending: 1,
        aiSuggestions: 3,
        catalogTypes: [type('concert', 'Concierto', ['no_base_groups'])],
        activities: future,
      })
    )
    expect(items.map((i) => i.severity)).toEqual(['critical', 'warning', 'warning', 'info', 'info'])
    expect(items.map((i) => i.key)).toEqual([
      'plan-reached',
      'notices',
      'audience:no_base_groups',
      'ai-types',
      'ai-suggestions',
    ])
    expect(items[1].count).toBe(2)
    expect(items[1].to).toEqual({ path: '/tour', query: { tab: 'notices' } })
  })

  it('un solo borrador de aviso enlaza directo a él', () => {
    const [item] = buildPendingItems(input({ pendingNotices: [{ uuid: 'n1' }] }))
    expect(item.to).toEqual({ path: '/tour', query: { tab: 'notices', notice: 'n1' } })
    expect(item.ctaKey).toBe('dashboard.pending.reviewAndSend')
  })

  it('avisos en pausa: solo si la gira está en pausa, primero de los warning, con acción', () => {
    expect(
      buildPendingItems(input({ notificationsPaused: false })).find(
        (i) => i.kind === 'notifications-paused'
      )
    ).toBeUndefined()
    const items = buildPendingItems(
      input({
        notificationsPaused: true,
        usage: usage({ usage_percentage: 85 }),
        pendingNotices: [{ uuid: 'n1' }],
      })
    )
    expect(items.map((i) => i.key)).toEqual(['notifications-paused', 'plan-warning', 'notices'])
    expect(items[0]).toMatchObject({
      severity: 'warning',
      ctaKey: 'dashboard.pending.resume',
      action: 'resume-notifications',
    })
    expect(items[0].to).toBeUndefined()
  })

  it('avisos en pausa: detrás de los críticos', () => {
    const items = buildPendingItems(
      input({ notificationsPaused: true, usage: usage({ usage_percentage: 100 }) })
    )
    expect(items.map((i) => i.key)).toEqual(['plan-reached', 'notifications-paused'])
  })

  it('avisos en pausa: un no admin la ve sin botón', () => {
    const items = buildPendingItems(input({ isAdmin: false, notificationsPaused: true }))
    expect(items.map((i) => i.key)).toEqual(['notifications-paused'])
    expect(items[0].ctaKey).toBeUndefined()
    expect(items[0].action).toBeUndefined()
  })

  it('joinTypeNames corta en 3 con +N', () => {
    expect(joinTypeNames(['A', 'B'])).toBe('A, B')
    expect(joinTypeNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C +2')
  })
})

describe('agregados de envíos', () => {
  const summary = {
    totals: {
      recipients: 12,
      pending: 0,
      sent: 10,
      delivered: 8,
      read: 5,
      confirmed: 1,
      failed: 2,
      confirmable_sent: 0,
    },
  } as unknown as ReportsSummary

  it('sendsFigures saca enviados, entregados y fallidos', () => {
    expect(sendsFigures(summary)).toEqual({ sent: 10, delivered: 8, failed: 2 })
  })

  it('sendsBars normaliza al día con más envíos', () => {
    const point = (date: string, sent: number, failed = 0) => ({
      date,
      sent,
      delivered: 0,
      read: 0,
      confirmed: 0,
      failed,
    })
    const bars = sendsBars([point('2026-11-20', 2), point('2026-11-21', 0), point('2026-11-22', 4, 1)])
    expect(bars.map((b) => b.height)).toEqual([50, 0, 100])
    expect(bars[2]).toMatchObject({ sent: 4, failed: 1 })
  })

  it('sendsBars sin envíos deja todas a 0', () => {
    expect(
      sendsBars([{ date: 'x', sent: 0, delivered: 0, read: 0, confirmed: 0, failed: 0 }])[0].height
    ).toBe(0)
  })
})
