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
  ]

  it('tiene etiqueta para cada motivo del backend', () => {
    for (const reason of backendReasons) {
      expect(AUTO_CANCEL_REASON_LABELS[reason]).toMatch(/^Cancelada automáticamente: .+\.$/)
    }
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
