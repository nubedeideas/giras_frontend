import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  AUTO_CANCEL_REASON_LABELS,
  NOTIF_STATUS_COLORS,
  notifStatusColors,
  notifStatusLabel,
  useNotifications,
} from './useNotifications'
import i18n from '@/i18n'
import { callAt, jsonResponse, mockFetch } from '@/test/http'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

describe('AUTO_CANCEL_REASON_LABELS', () => {
  it('explica los motivos nuevos de evento borrado y suscripción cancelada', () => {
    expect(AUTO_CANCEL_REASON_LABELS.event_deleted).toBe(
      'Cancelada automáticamente: el evento se eliminó.'
    )
    expect(AUTO_CANCEL_REASON_LABELS.subscription_cancelled).toBe(
      'Cancelada automáticamente: la suscripción de la gira se canceló.'
    )
  })

  it('explica los motivos de la alerta del día de show', () => {
    expect(AUTO_CANCEL_REASON_LABELS.show_day_alert_disabled).toBe(
      'Cancelada automáticamente: la alerta del día de show se desactivó para esta gira.'
    )
    expect(AUTO_CANCEL_REASON_LABELS.show_changed).toBe(
      'Cancelada automáticamente: el show cambió de día o se canceló.'
    )
    expect(AUTO_CANCEL_REASON_LABELS.template_not_approved).toBe(
      'Cancelada automáticamente: la plantilla de WhatsApp aún no está aprobada.'
    )
  })

  it('mantiene los motivos anteriores', () => {
    for (const reason of [
      'activity_rescheduled_past',
      'activity_deleted',
      'tour_deleted',
      'no_recipients',
    ]) {
      expect(AUTO_CANCEL_REASON_LABELS[reason]).toMatch(/^Cancelada automáticamente: /)
    }
  })
})

describe('useNotifications.remindUnconfirmed', () => {
  it('hace POST con dry_run y devuelve los recuentos', async () => {
    const result = {
      dry_run: true,
      eligible: 2,
      queued: 0,
      excluded: { confirmed: 1, not_delivered: 0, no_phone: 0, max_reminders: 0, too_soon: 1 },
      max_reminders_per_recipient: 2,
      min_interval_minutes: 60,
    }
    const fetchMock = mockFetch(jsonResponse(result))

    await expect(useNotifications().remindUnconfirmed('n-1', true)).resolves.toEqual(result)

    const { url, init } = callAt(fetchMock, 0)
    expect(url).toBe('http://api.test/api/notifications/n-1/remind-unconfirmed/')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ dry_run: true })
  })

  it('por defecto envía de verdad (dry_run false)', async () => {
    const fetchMock = mockFetch(jsonResponse({ dry_run: false, eligible: 1, queued: 1 }))
    await useNotifications().remindUnconfirmed('n-1')
    expect(JSON.parse(String(callAt(fetchMock, 0).init.body))).toEqual({ dry_run: false })
  })
})

describe('estado de notificación heredado o desconocido', () => {
  it('pending tiene etiqueta y colores propios', () => {
    expect(notifStatusLabel('pending')).toBe('Pendiente')
    expect(notifStatusColors('pending')).toEqual(NOTIF_STATUS_COLORS.draft)
  })

  it('un estado desconocido no rompe: etiqueta cruda y colores de borrador', () => {
    expect(notifStatusLabel('raro')).toBe('raro')
    expect(notifStatusColors('raro')).toEqual(NOTIF_STATUS_COLORS.draft)
  })
})

describe('textos de exclusión del recordatorio', () => {
  it('interpolan los límites que manda el backend', () => {
    const t = i18n.global.t
    i18n.global.locale.value = 'es'
    expect(t('confirmations.excluded.too_soon', { n: 2, minutes: 90, max: 3 })).toBe(
      'Recordadas hace menos de 90 minutos (2)'
    )
    expect(t('confirmations.excluded.max_reminders', { n: 1, minutes: 90, max: 3 })).toBe(
      'Ya recibieron 3 recordatorios (1)'
    )
  })
})
