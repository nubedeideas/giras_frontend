import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import {
  activityConfirmationSummary,
  canRemindUnconfirmed,
  isActivityPast,
  isBlockingRemindError,
  recipientChipKind,
  remindErrorMessage,
  sortRecipientsForConfirmation,
} from './confirmations'
import { ApiError } from './apiClient'

const r = (status: string, extra: Record<string, string | null> = {}) =>
  ({ status, confirmed_at: null, delivered_at: null, read_at: null, ...extra }) as Parameters<
    typeof recipientChipKind
  >[0]

describe('recipientChipKind', () => {
  it('con botón de confirmar: confirmado, pendiente, fallido y sin enviar', () => {
    expect(recipientChipKind(r('confirmed', { confirmed_at: 'x' }), true)).toBe('confirmed')
    expect(recipientChipKind(r('read', { read_at: 'x' }), true)).toBe('pending')
    expect(recipientChipKind(r('sent'), true)).toBe('pending')
    expect(recipientChipKind(r('bounced'), true)).toBe('failed')
    expect(recipientChipKind(r('pending'), true)).toBe('notSent')
  })

  it('sin botón: enviado, entregado, leído', () => {
    expect(recipientChipKind(r('sent'), false)).toBe('sent')
    expect(recipientChipKind(r('sent', { delivered_at: 'x' }), false)).toBe('delivered')
    expect(recipientChipKind(r('delivered', { read_at: 'x' }), false)).toBe('read')
  })
})

describe('sortRecipientsForConfirmation', () => {
  it('pendientes primero, luego fallidos y confirmados al final', () => {
    const list = [
      r('confirmed', { confirmed_at: 'x' }),
      r('failed'),
      r('sent'),
      r('read', { read_at: 'x' }),
    ]
    expect(sortRecipientsForConfirmation(list, true).map((x) => x.status)).toEqual([
      'sent',
      'read',
      'failed',
      'confirmed',
    ])
  })
})

describe('canRemindUnconfirmed y activityConfirmationSummary', () => {
  const base = {
    confirmable: true,
    status: 'sent' as const,
    confirmed_count: 1,
    recipient_count: 3,
  }

  it('solo ofrece recordar si es confirmable, enviada y faltan confirmaciones', () => {
    expect(canRemindUnconfirmed(base)).toBe(true)
    expect(canRemindUnconfirmed({ ...base, confirmed_count: 3 })).toBe(false)
    expect(canRemindUnconfirmed({ ...base, confirmable: false })).toBe(false)
    expect(canRemindUnconfirmed({ ...base, status: 'scheduled' })).toBe(false)
  })

  it('suma solo las confirmables enviadas', () => {
    expect(
      activityConfirmationSummary([
        base,
        { ...base, confirmed_count: 2, recipient_count: 2 },
        { ...base, confirmable: false, confirmed_count: 0, recipient_count: 9 },
      ])
    ).toEqual({ confirmed: 3, total: 5 })
    expect(activityConfirmationSummary([{ ...base, status: 'draft' }])).toBeNull()
  })
})

describe('remindErrorMessage', () => {
  it('429 usa el texto de throttle propio', () => {
    expect(remindErrorMessage(new ApiError(429, { detail: 'x' }), 'muchos', 'fb')).toBe('muchos')
  })

  it('403 por cupo une error y detail', () => {
    const e = new ApiError(403, {
      error: 'Límite de notificaciones alcanzado',
      detail: 'Has usado 10 de 10',
      usage: { used: 10, limit: 10, remaining: 0 },
    })
    expect(remindErrorMessage(e, 't', 'fb')).toBe(
      'Límite de notificaciones alcanzado: Has usado 10 de 10'
    )
  })

  it('400 y 403 sin cupo muestran el mensaje del backend', () => {
    expect(
      remindErrorMessage(
        new ApiError(400, { error: 'La notificación no es de WhatsApp', code: 'not_whatsapp' }),
        't',
        'fb'
      )
    ).toBe('La notificación no es de WhatsApp')
    const noSub = new ApiError(403, { detail: 'Gira sin suscripción' })
    expect(remindErrorMessage(noSub, 't', 'fb')).toBe('Gira sin suscripción')
  })
})

describe('bloqueos del recordatorio', () => {
  it('isActivityPast compara scheduled_at con ahora', () => {
    const now = DateTime.fromISO('2026-11-20T12:00:00Z')
    expect(isActivityPast('2026-11-20T11:59:00Z', now)).toBe(true)
    expect(isActivityPast('2026-11-20T12:01:00Z', now)).toBe(false)
    expect(isActivityPast(null, now)).toBe(false)
  })

  it('no ofrece recordar si la actividad ya pasó', () => {
    const n = { confirmable: true, status: 'sent' as const, confirmed_count: 0, recipient_count: 2 }
    expect(canRemindUnconfirmed(n, true)).toBe(false)
    expect(canRemindUnconfirmed(n, false)).toBe(true)
  })

  it('los 400 con código definitivo bloquean; el resto no', () => {
    for (const code of [
      'activity_past',
      'tour_notifications_blocked',
      'not_confirmable',
      'not_whatsapp',
    ]) {
      expect(isBlockingRemindError(new ApiError(400, { error: 'x', code }))).toBe(true)
    }
    expect(isBlockingRemindError(new ApiError(400, { error: 'x', code: 'not_sent' }))).toBe(false)
    expect(isBlockingRemindError(new ApiError(403, { detail: 'Gira sin suscripción' }))).toBe(false)
    expect(isBlockingRemindError(new ApiError(429, { detail: 'x' }))).toBe(false)
    expect(isBlockingRemindError(new Error('x'))).toBe(false)
  })
})
