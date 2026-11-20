import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import type { NotificationListItem } from '@/composables/useNotifications'
import ShowDayAlertStatus from '@/components/activities/ShowDayAlertStatus.vue'
import { TEMPLATE_TYPE_LABELS } from '@/composables/useNotificationTemplates'
import es from '@/i18n/es'
import en from '@/i18n/en'
import {
  alertTimePatch,
  alertTimeToInput,
  alertTimeToPayload,
  currentShowDayAlert,
  isQuarterHourTime,
  showDayAlertState,
  showDayAlertView,
} from './showDayAlert'

function notif(overrides: Partial<NotificationListItem> = {}): NotificationListItem {
  return {
    uuid: 'n1',
    title: 'Día de show: Madrid',
    notification_type: 'show_day_alert',
    channel: 'whatsapp',
    priority: 'normal',
    status: 'scheduled',
    sender_name: null,
    recipient_count: 4,
    confirmed_count: 0,
    confirmable: true,
    scheduled_for: '2026-12-01T08:00:00Z',
    send_timezone: 'Europe/Madrid',
    sent_at: null,
    created_at: '2026-11-30T08:00:00Z',
    ...overrides,
  }
}

describe('showDayAlertState', () => {
  it('none sin alertas', () => {
    expect(showDayAlertState([])).toEqual({ kind: 'none' })
  })

  it('scheduled con la hora y la zona de envío', () => {
    expect(showDayAlertState([notif()])).toEqual({
      kind: 'scheduled',
      at: '2026-12-01T08:00:00Z',
      timezone: 'Europe/Madrid',
    })
  })

  it('sending', () => {
    expect(showDayAlertState([notif({ status: 'sending' })])).toEqual({ kind: 'sending' })
  })

  it('sent con confirmados y total', () => {
    expect(
      showDayAlertState([notif({ status: 'sent', confirmed_count: 3, recipient_count: 4 })])
    ).toEqual({ kind: 'sent', confirmed: 3, total: 4 })
  })

  it('failed', () => {
    expect(showDayAlertState([notif({ status: 'failed' })])).toEqual({ kind: 'failed' })
  })

  it('cancelled', () => {
    expect(showDayAlertState([notif({ status: 'cancelled' })])).toEqual({ kind: 'cancelled' })
  })

  it('con dos alertas gana la más reciente por scheduled_for', () => {
    const old = notif({ uuid: 'old', status: 'sent', scheduled_for: '2026-11-01T08:00:00Z' })
    const recent = notif({ uuid: 'new', status: 'scheduled' })
    expect(showDayAlertState([recent, old]).kind).toBe('scheduled')
    expect(currentShowDayAlert([old, recent])?.uuid).toBe('new')
  })

  it('usa created_at si no hay scheduled_for', () => {
    const a = notif({ uuid: 'a', status: 'failed', scheduled_for: null })
    const b = notif({
      uuid: 'b',
      status: 'sending',
      scheduled_for: null,
      created_at: '2026-12-02T08:00:00Z',
    })
    expect(currentShowDayAlert([a, b])?.uuid).toBe('b')
  })

  it('una cancelada más reciente no tapa a la alerta viva', () => {
    const alive = notif({ uuid: 'alive', scheduled_for: '2026-12-01T07:00:00Z' })
    const cancelled = notif({ uuid: 'gone', status: 'cancelled' })
    expect(currentShowDayAlert([alive, cancelled])?.uuid).toBe('alive')
  })

  it('ignora otros tipos', () => {
    const items = [
      notif({ notification_type: 'event_reminder', status: 'sent' }),
      notif({ notification_type: 'show_day_agenda', status: 'sent' }),
    ]
    expect(showDayAlertState(items)).toEqual({ kind: 'none' })
  })
})

describe('showDayAlertView', () => {
  it('sin alerta: desactivada en la gira gana, luego show pasado = oculto, si no none', () => {
    const none = { kind: 'none' } as const
    expect(showDayAlertView(none, { tourEnabled: false, activityPast: true })).toBe('disabled')
    expect(showDayAlertView(none, { activityPast: true })).toBe('hidden')
    expect(showDayAlertView(none, { tourEnabled: true })).toBe('none')
    expect(showDayAlertView(none)).toBe('none')
  })

  it('con alerta enseña su estado aunque la gira la tenga desactivada o el show haya pasado', () => {
    const sent = { kind: 'sent', confirmed: 1, total: 2 } as const
    expect(showDayAlertView(sent, { tourEnabled: false, activityPast: true })).toBe('sent')
  })
})

describe('hora de la alerta', () => {
  it('recorta HH:MM:SS a HH:MM y vacío si no hay', () => {
    expect(alertTimeToInput('09:30:00')).toBe('09:30')
    expect(alertTimeToInput('21:45')).toBe('21:45')
    expect(alertTimeToInput(null)).toBe('')
    expect(alertTimeToInput('basura')).toBe('')
  })

  it('acepta solo tramos de 15 minutos', () => {
    for (const ok of ['00:00', '09:00', '09:15', '09:30', '23:45', '09:30:00']) {
      expect(isQuarterHourTime(ok)).toBe(true)
    }
    for (const ko of ['09:10', '09:59', '24:00', '9:00', '09:30:15', '', 'abc']) {
      expect(isQuarterHourTime(ko)).toBe(false)
    }
  })

  it('payload: vacío = null, válido = HH:MM, fuera de tramo = undefined', () => {
    expect(alertTimeToPayload('')).toBeNull()
    expect(alertTimeToPayload('  ')).toBeNull()
    expect(alertTimeToPayload('10:15')).toBe('10:15')
    expect(alertTimeToPayload('10:15:00')).toBe('10:15')
    expect(alertTimeToPayload('10:20')).toBeUndefined()
  })

  it('alertTimePatch: sin cambios no manda nada aunque la hora cargada esté fuera de tramo', () => {
    expect(alertTimePatch('09:10', '09:10')).toEqual({})
    expect(alertTimePatch('', '')).toEqual({})
    expect(alertTimePatch('09:15', '09:10')).toEqual({ show_day_alert_time: '09:15' })
    expect(alertTimePatch('', '09:10')).toEqual({ show_day_alert_time: null })
    expect(alertTimePatch('09:20', '09:10')).toBeNull()
  })
})

describe('etiquetas de los tipos nuevos', () => {
  it('reports.types y plantillas tienen show_day_alert y show_day_agenda', () => {
    expect(es.reports.types.show_day_alert).toBe('Alerta del día de show')
    expect(es.reports.types.show_day_agenda).toBe('Agenda del día de show')
    expect(en.reports.types.show_day_alert).toBe('Show day alert')
    expect(en.reports.types.show_day_agenda).toBe('Show day agenda')
    expect(TEMPLATE_TYPE_LABELS.show_day_alert).toBe('Alerta del día de show')
    expect(TEMPLATE_TYPE_LABELS.show_day_agenda).toBe('Agenda del día de show')
  })
})

describe('ShowDayAlertStatus', () => {
  function render(
    items: NotificationListItem[],
    props: { activityScheduledAt?: string; showDayAlertEnabled?: boolean } = {},
    locale: 'es' | 'en' = 'es'
  ) {
    i18n.global.locale.value = locale
    return mount(ShowDayAlertStatus, {
      props: { notifications: items, ...props },
      global: { plugins: [i18n] },
    })
  }

  it('sin alerta y show futuro explica cuándo se programa', () => {
    const w = render([], { activityScheduledAt: '2099-01-01T20:00:00Z' })
    expect(w.text()).toContain('se programa el día antes del show')
  })

  it('sin alerta y show pasado no pinta nada', () => {
    const w = render([], { activityScheduledAt: '2000-01-01T20:00:00Z' })
    expect(w.find('[data-testid="show-day-alert-status"]').exists()).toBe(false)
  })

  it('sin alerta y desactivada en la gira lo dice', () => {
    const w = render([], { activityScheduledAt: '2099-01-01T20:00:00Z', showDayAlertEnabled: false })
    expect(w.text()).toContain('Alerta del día de show desactivada en la gira')
  })

  it('programada muestra la hora local de envío con meses en el idioma de la interfaz', () => {
    expect(render([notif()]).text()).toMatch(
      /Alerta del día de show programada para 1 dic\.? 2026 · 09:00 \(GMT\+1\)/
    )
    const en = render([notif()], {}, 'en').text()
    expect(en).toContain('Show day alert scheduled for 1 Dec 2026 · 09:00 (GMT+1)')
    i18n.global.locale.value = 'es'
  })

  it('enviada muestra confirmados y no lleva botón de recordar (está en la tarjeta)', () => {
    const w = render([notif({ status: 'sent', confirmed_count: 1, recipient_count: 3 })], {
      activityScheduledAt: '2099-01-01T20:00:00Z',
    })
    expect(w.text()).toContain('enviada · 1/3 confirmados')
    expect(w.text()).not.toContain('Recordar a los que faltan')
  })
})
