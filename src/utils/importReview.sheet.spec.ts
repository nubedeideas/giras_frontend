import { describe, expect, it } from 'vitest'
import {
  calendarActivityRow,
  sheetActivityRow,
  sheetChangedRow,
  sheetJob,
  sheetLinkRow,
  sheetRemovedRow,
  sheetWeakRow,
} from '@/test/importActivities'
import { activityRow } from '@/test/importJobs'
import {
  activityNeedsAction,
  activityStatus,
  activityStatusKey,
  canConfirm,
  isCalendarJob,
  isLiveSourceJob,
  isSheetJob,
  isSheetLinkRow,
  isSheetRow,
  isSheetWeakRow,
  pendingCounts,
  timezoneSourceKey,
  sheetCancelReason,
  sheetRowNumber,
} from '@/utils/importReview'
import { importActivityBadge } from '@/utils/statusBadge'

// F4 §4.2 y §4.4: filas y jobs de una hoja de Google vinculada.

describe('filas de hoja (F4)', () => {
  it('isSheetRow por source_ref.kind (también filas de equipo)', () => {
    expect(isSheetRow(sheetActivityRow())).toBe(true)
    expect(isSheetRow(calendarActivityRow())).toBe(false)
    expect(isSheetRow(activityRow())).toBe(false)
    expect(isSheetRow({ source_ref: null })).toBe(false)
  })

  it('sheetRowNumber: row_number o el número de "Pestaña!12"', () => {
    expect(sheetRowNumber(sheetActivityRow().source_ref)).toBe(14)
    expect(sheetRowNumber({ row: 'Hoja1!27' })).toBe(27)
    expect(sheetRowNumber({ row: 'Hoja1!27', row_number: 0 })).toBe(27)
    expect(sheetRowNumber({ row: 'L3' })).toBeNull()
    expect(sheetRowNumber(null)).toBeNull()
  })

  it('cambió en la hoja: textos de hoja, misma insignia que en calendario', () => {
    const row = sheetChangedRow()
    expect(activityStatus(row)).toBe('updated_in_source')
    expect(activityStatusKey(row)).toBe('importer.activityStatus.updated_in_sheet')
    expect(importActivityBadge(activityStatus(row))).toBe('scheduled')
    const conflict = sheetChangedRow({ needs_action: true }, { conflict: true })
    expect(activityStatusKey(conflict)).toBe('importer.activityStatus.updated_sheet_conflict')
    expect(importActivityBadge(activityStatus(conflict))).toBe('pending')
    // Mantener la de Giras: texto común.
    expect(activityStatusKey(sheetChangedRow({ action: 'skip' }))).toBe(
      'importer.activityStatus.updated_kept'
    )
  })

  it('fila reescrita (emparejado débil): pendiente con "skip" hasta elegir', () => {
    const weak = sheetWeakRow()
    expect(isSheetWeakRow(weak)).toBe(true)
    expect(isSheetWeakRow(sheetChangedRow())).toBe(false)
    expect(activityNeedsAction(weak)).toBe(true)
    expect(activityStatus(weak)).toBe('updated_weak')
    expect(activityStatusKey(weak)).toBe('importer.activityStatus.updated_sheet_weak')
    expect(importActivityBadge(activityStatus(weak))).toBe('pending')
    // Mantener la actual (`skip` + `reviewed`): resuelta.
    const kept = sheetWeakRow({ reviewed: true, needs_action: false })
    expect(activityNeedsAction(kept)).toBe(false)
    expect(activityStatus(kept)).toBe('updated_kept')
    // Sustituir.
    const replaced = sheetWeakRow({ action: 'replace', reviewed: true, needs_action: false })
    expect(activityNeedsAction(replaced)).toBe(false)
    expect(activityStatusKey(replaced)).toBe('importer.activityStatus.updated_in_sheet')
  })

  it('zona y fecha "de la hoja" (gsheet)', () => {
    expect(timezoneSourceKey('gsheet')).toBe('importer.tzSource.gsheet')
  })

  it('ya no está en la hoja: por motivo; pide decisión hasta elegir', () => {
    const removed = sheetRemovedRow()
    expect(sheetCancelReason(removed)).toBe('row_removed')
    expect(activityStatusKey(removed)).toBe('importer.activityStatus.removed_in_sheet')
    expect(importActivityBadge(activityStatus(removed))).toBe('pending')
    expect(activityNeedsAction(removed)).toBe(true)
    const slot = sheetRemovedRow('slot_gone')
    expect(sheetCancelReason(slot)).toBe('slot_gone')
    expect(activityStatusKey(slot)).toBe('importer.sheetCancel.slot_gone')
    // Sin `reason` (backend anterior): como fila retirada.
    const noReason = sheetRemovedRow()
    delete noReason.match.reason
    expect(sheetCancelReason(noReason)).toBe('row_removed')
    const cancel = sheetRemovedRow('row_removed', { action: 'cancel', needs_action: false })
    expect(activityStatus(cancel)).toBe('cancel')
    expect(importActivityBadge('cancel')).toBe('failed')
    expect(activityNeedsAction(cancel)).toBe(false)
  })

  it('se vinculará: duplicate_link en sent; "No vincular" vuelve al duplicado recuperado', () => {
    const link = sheetLinkRow()
    expect(isSheetLinkRow(link)).toBe(true)
    expect(activityStatus(link)).toBe('duplicate_link')
    expect(activityStatusKey(link)).toBe('importer.activityStatus.duplicate_link')
    expect(importActivityBadge('duplicate_link')).toBe('sent')
    expect(activityNeedsAction(link)).toBe(false)
    const created = sheetLinkRow({ action: 'create', reviewed: true })
    expect(activityStatus(created)).toBe('duplicate_kept')
    // Un duplicado sin `link` (contra iCal o Google Calendar) sigue siendo "se omite".
    const plain = sheetLinkRow({ match: { ...sheetLinkRow().match, link: false } })
    expect(isSheetLinkRow(plain)).toBe(false)
    expect(activityStatus(plain)).toBe('duplicate')
  })
})

describe('jobs de hoja (F4)', () => {
  it('isSheetJob por sheet, source_kind o filas de hoja; es fuente en vivo', () => {
    expect(isSheetJob(sheetJob())).toBe(true)
    expect(isSheetJob({ ...sheetJob(), sheet: null })).toBe(true)
    expect(isSheetJob({ ...sheetJob(), sheet: null, source_kind: 'file' })).toBe(true)
    expect(isSheetJob({ ...sheetJob([activityRow()]), sheet: null, source_kind: 'file' })).toBe(false)
    expect(isSheetJob(null)).toBe(false)
    expect(isLiveSourceJob(sheetJob())).toBe(true)
    expect(isCalendarJob(sheetJob())).toBe(false)
  })

  it('canConfirm: todo "Mantener" o "Vincular" se confirma; con una retirada sin decidir, no', () => {
    const kept = sheetJob([sheetChangedRow({ action: 'skip' }), sheetLinkRow()])
    expect(pendingCounts(kept).total).toBe(0)
    expect(canConfirm(kept)).toBe(true)
    const pending = sheetJob([sheetLinkRow(), sheetRemovedRow()])
    expect(pendingCounts(pending).activities).toBe(1)
    expect(canConfirm(pending)).toBe(false)
  })
})
