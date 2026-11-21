import { describe, expect, it } from 'vitest'
import { AUTO_CANCEL_REASON_LABELS } from '@/composables/useNotifications'
import { formatFollowers } from '@/composables/useSpotifySearch'
import { inputValueToIso, isoToInputValue } from './datetime'

describe('AUTO_CANCEL_REASON_LABELS', () => {
  // Valores que escribe el backend en metadata.auto_cancelled_reason
  // (notification_service.py, reminders.py, scheduler.py).
  const backendReasons = [
    'activity_rescheduled_past',
    'activity_deleted',
    'tour_deleted',
    'no_recipients',
    'event_deleted',
    'subscription_cancelled',
    // Bloque 3.2 (alerta del día de show)
    'show_day_alert_disabled',
    'show_changed',
    'template_not_approved',
    // Bloque 3.6 (reglas de notificación)
    'rule_disabled',
    'rule_changed',
    'rule_rescheduled',
    'replaced_by_rule',
    'activity_unavailable',
    'activity_type_changed',
    'activity_type_mismatch',
    'template_unavailable',
    // Recordatorios por tipo (reminders.py, quota.py, on_demand)
    'reminder_config_changed',
    'plan_limit_degraded',
    'plan_limit_reached',
    'flight_cancelled',
  ]

  it('tiene etiqueta para cada motivo del backend', () => {
    for (const reason of backendReasons) {
      expect(AUTO_CANCEL_REASON_LABELS[reason]).toMatch(/^Cancelada automáticamente: .+\.$/)
    }
  })
})

describe('motivos de cancelación de los recordatorios por tipo', () => {
  it('usa los textos de la spec', () => {
    expect(AUTO_CANCEL_REASON_LABELS.reminder_config_changed).toBe(
      'Cancelada automáticamente: cambió la configuración de recordatorios de este tipo.'
    )
    expect(AUTO_CANCEL_REASON_LABELS.plan_limit_degraded).toBe(
      'Cancelada automáticamente: se acabó el cupo de WhatsApp del plan y se envió por email o en la app.'
    )
    expect(AUTO_CANCEL_REASON_LABELS.plan_limit_reached).toBe(
      'Cancelada automáticamente: se acabó el cupo de WhatsApp del plan.'
    )
    expect(AUTO_CANCEL_REASON_LABELS.flight_cancelled).toBe(
      'Cancelada automáticamente: la aerolínea canceló el vuelo.'
    )
  })
})

describe('datetime', () => {
  it('ida y vuelta entre ISO UTC e input datetime-local en otra zona', () => {
    const iso = '2026-06-20T18:00:00.000Z'
    const input = isoToInputValue(iso, 'Europe/Madrid')
    expect(input).toBe('2026-06-20T20:00')
    expect(inputValueToIso(input, 'Europe/Madrid')).toBe(iso)
    expect(inputValueToIso('', 'Europe/Madrid')).toBeNull()
  })
})

describe('formatFollowers', () => {
  it('abrevia miles y millones', () => {
    expect(formatFollowers(950)).toBe('950')
    expect(formatFollowers(12_400)).toBe('12K')
    expect(formatFollowers(2_350_000)).toBe('2.4M')
  })
})
