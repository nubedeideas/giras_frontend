import { describe, expect, it } from 'vitest'
import {
  activityJob,
  calendarActivityRow,
  calendarCancelledRow,
  calendarChangedRow,
} from '@/test/importActivities'
import { activityRow } from '@/test/importJobs'
import {
  activityIssueKey,
  activityNeedsAction,
  activityStatus,
  activityStatusKey,
  canConfirm,
  formatRecurrenceId,
  isCalendarRow,
  pendingCounts,
  removedActivityUuids,
  timezoneSourceKey,
  warningKey,
} from '@/utils/importReview'
import { importActivityBadge } from '@/utils/statusBadge'

describe('filas de calendario (F3)', () => {
  it('isCalendarRow por source_ref.kind', () => {
    expect(isCalendarRow(calendarActivityRow())).toBe(true)
    expect(isCalendarRow(activityRow())).toBe(false)
  })

  it('cambió en el calendario: se actualiza, con conflicto pide decisión, omitida se mantiene', () => {
    const row = calendarChangedRow()
    expect(activityStatus(row)).toBe('updated_in_source')
    expect(activityStatusKey(row)).toBe('importer.activityStatus.updated_in_source')
    expect(importActivityBadge('updated_in_source')).toBe('scheduled')
    expect(activityNeedsAction(row)).toBe(false)

    const conflict = calendarChangedRow({ needs_action: true }, { conflict: true })
    expect(activityStatus(conflict)).toBe('updated_conflict')
    expect(importActivityBadge('updated_conflict')).toBe('pending')
    expect(activityNeedsAction(conflict)).toBe(true)

    // Con conflicto ya decidido ("Actualizar"): deja de pedir decisión.
    const decided = calendarChangedRow({ needs_action: false, reviewed: true }, { conflict: true })
    expect(activityStatus(decided)).toBe('updated_in_source')

    const kept = calendarChangedRow({ action: 'skip' })
    expect(activityStatus(kept)).toBe('updated_kept')
    expect(importActivityBadge('updated_kept')).toBe('off')
  })

  it('cancelada en el calendario: por resolver aunque venga omitida, hasta elegir', () => {
    const row = calendarCancelledRow()
    expect(activityNeedsAction(row)).toBe(true)
    expect(activityStatus(row)).toBe('cancelled_in_source')
    expect(importActivityBadge('cancelled_in_source')).toBe('pending')

    const cancel = calendarCancelledRow({ action: 'cancel', needs_action: false, reviewed: true })
    expect(activityNeedsAction(cancel)).toBe(false)
    expect(activityStatus(cancel)).toBe('cancel')
    expect(activityStatusKey(cancel)).toBe('importer.activityStatus.cancel')
    expect(importActivityBadge('cancel')).toBe('failed')

    const keep = calendarCancelledRow({ needs_action: false })
    expect(activityNeedsAction(keep)).toBe(false)
    expect(activityStatus(keep)).toBe('cancelled_kept')
  })

  it('canConfirm y pendingCounts cuentan las canceladas sin decidir', () => {
    let job = activityJob([calendarCancelledRow()])
    expect(pendingCounts(job).activities).toBe(1)
    expect(canConfirm(job)).toBe(false)
    job = activityJob([calendarCancelledRow({ action: 'cancel', needs_action: false })])
    expect(pendingCounts(job).activities).toBe(0)
    expect(canConfirm(job)).toBe(true)
    // "Mantener" en la única fila: no queda nada que confirmar.
    job = activityJob([calendarCancelledRow({ needs_action: false })])
    expect(canConfirm(job)).toBe(false)
  })

  it('issue checkout_inferred y zonas ics/ics_calendar con texto propio', () => {
    expect(activityIssueKey('checkout_inferred')).toBe('importer.activityIssues.checkout_inferred')
    expect(timezoneSourceKey('ics')).toBe('importer.tzSource.ics')
    expect(timezoneSourceKey('ics_calendar')).toBe('importer.tzSource.ics_calendar')
  })

  it('warningKey: avisos ics_* y nunca un código desconocido', () => {
    expect(warningKey('ics_outside_window')).toBe('importer.warnings.ics_outside_window')
    expect(warningKey('ics_classification_unavailable')).toBe(
      'importer.warnings.ics_classification_unavailable'
    )
    expect(warningKey('rows_truncated')).toBe('importer.warnings.rows_truncated')
    expect(warningKey('otro_codigo')).toBeNull()
    expect(warningKey(null)).toBeNull()
  })

  it('removedActivityUuids lee detected.ical.removed', () => {
    expect(removedActivityUuids(activityJob())).toEqual([])
    const job = activityJob([], {
      detected: {
        sources: [],
        ical: {
          subscription_uuid: 'S1',
          name: 'Gira 2026',
          removed: [{ key: 'k1', activity_uuid: 'ACT-2', summary: 'Prueba de sonido' }],
        },
      },
    })
    expect(removedActivityUuids(job)).toEqual(['ACT-2'])
  })

  it('formatRecurrenceId: UTC a la zona, local y de día', () => {
    expect(formatRecurrenceId('20261203T200000Z', 'Europe/Madrid')).toBe('jue 3 dic 21:00')
    expect(formatRecurrenceId('20261203T200000', 'Europe/Madrid')).toBe('jue 3 dic 20:00')
    expect(formatRecurrenceId('20261203', 'Europe/Madrid')).toBe('jue 3 dic')
    expect(formatRecurrenceId('basura', 'Europe/Madrid')).toBe('')
    expect(formatRecurrenceId(null, 'Europe/Madrid')).toBe('')
  })
})
