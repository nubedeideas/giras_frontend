import { describe, expect, it } from 'vitest'
import { activityRow, importJob, teamRow } from '@/test/importJobs'
import { activityJob } from '@/test/importActivities'
import type { ImportActivityRow } from '@/composables/useImportJobs'
import {
  activityIssueKey,
  activityNeedsAction,
  activityStatus,
  activityStatusKey,
  activityTypeOptions,
  canConfirm,
  detectedActivities,
  errorKey,
  formatDayLabel,
  formatLocalDate,
  formatLocalTime,
  groupActivitiesByDay,
  hasDayNumbers,
  pendingCounts,
  sortActivityRows,
  timezoneSourceKey,
} from './importReview'

const match = (status: ImportActivityRow['match']['status']): ImportActivityRow['match'] => ({
  status,
  by: status === 'new' ? null : 'type_time_title',
  activity_uuid: status === 'new' ? null : 'ACT1',
  activity_title: status === 'new' ? null : 'Show WiZink',
  activity_scheduled_at: status === 'new' ? null : '2026-12-03T20:00:00Z',
  activity_type_code: status === 'new' ? null : 'show',
  activity_external_source: null,
})

describe('activityNeedsAction', () => {
  it('needs_action o sin instante, salvo omitida', () => {
    expect(activityNeedsAction(activityRow())).toBe(false)
    expect(activityNeedsAction(activityRow({ needs_action: true }))).toBe(true)
    // Sin hora (confianza 0,7: el servidor no la marca) → confirm la rechazaría.
    expect(activityNeedsAction(activityRow({ start_time: null, scheduled_at: null }))).toBe(true)
    expect(activityNeedsAction(activityRow({ needs_action: true, action: 'skip' }))).toBe(false)
  })
})

describe('sortActivityRows', () => {
  it('primero las que piden acción, después rojas, después por scheduled_at', () => {
    const late = activityRow({ client_id: 'a1', scheduled_at: '2026-12-03T20:00:00Z' })
    const early = activityRow({ client_id: 'a2', scheduled_at: '2026-12-03T08:00:00Z' })
    const red = activityRow({ client_id: 'a3', confidence: 0.5, scheduled_at: '2026-12-03T23:00:00Z' })
    const pend = activityRow({ client_id: 'a4', needs_action: true, scheduled_at: '2026-12-03T23:30:00Z' })
    const noTime = activityRow({ client_id: 'a5', scheduled_at: null, action: 'skip' })
    expect(sortActivityRows([late, noTime, early, red, pend]).map((r) => r.client_id)).toEqual([
      'a4',
      'a3',
      'a2',
      'a1',
      'a5',
    ])
  })
})

describe('groupActivitiesByDay', () => {
  it('por fecha local, "sin fecha" al final, y día de scheduled_at en la zona de la gira', () => {
    const rows = [
      activityRow({ client_id: 'a1', date: '2026-12-04' }),
      activityRow({ client_id: 'a2', date: null, scheduled_at: null, needs_action: true }),
      activityRow({ client_id: 'a3', date: '2026-12-03' }),
      // Sin `date` pero con instante: 23:30 UTC del 3 es el 4 en Madrid.
      activityRow({ client_id: 'a4', date: null, scheduled_at: '2026-12-03T23:30:00Z' }),
    ]
    const groups = groupActivitiesByDay(rows, 'Europe/Madrid')
    expect(groups.map((g) => g.date)).toEqual(['2026-12-03', '2026-12-04', null])
    expect(groups[1].rows.map((r) => r.client_id)).toEqual(['a1', 'a4'])
    expect(groups[2].rows.map((r) => r.client_id)).toEqual(['a2'])
  })
})

describe('activityStatus / activityStatusKey', () => {
  it.each([
    [{}, 'new'],
    [{ action: 'skip' as const }, 'skipped'],
    [{ action: 'skip' as const, match: match('duplicate') }, 'duplicate'],
    [{ action: 'skip' as const, match: match('duplicate_in_draft'), duplicate_of: 'a1' }, 'duplicate_in_draft'],
    [{ match: match('possible_duplicate') }, 'possible_duplicate'],
    [{ match: match('possible_duplicate'), reviewed: true }, 'new'],
    [{ action: 'replace' as const, match: match('possible_duplicate') }, 'replace'],
    // Duplicado seguro recuperado ("Recuperar" → create): conserva la insignia.
    [{ match: match('duplicate') }, 'duplicate_kept'],
    [{ match: match('duplicate_in_draft'), duplicate_of: 'a1' }, 'duplicate_in_draft_kept'],
    [{ action: 'replace' as const, match: match('duplicate') }, 'replace'],
  ])('%o → %s', (o, status) => {
    const row = activityRow(o)
    expect(activityStatus(row)).toBe(status)
    expect(activityStatusKey(row)).toBe(`importer.activityStatus.${status}`)
  })
})

describe('claves de issues y zonas', () => {
  it('nunca el código crudo', () => {
    expect(activityIssueKey('time_missing')).toBe('importer.activityIssues.time_missing')
    expect(activityIssueKey('in_past')).toBe('importer.activityIssues.in_past')
    expect(activityIssueKey('month_inferred')).toBe('importer.activityIssues.month_inferred')
    expect(activityIssueKey('possible_duplicate')).toBeNull()
    expect(activityIssueKey('inventado')).toBeNull()
    expect(timezoneSourceKey('iata')).toBe('importer.tzSource.iata')
    expect(timezoneSourceKey('nada')).toBeNull()
    expect(timezoneSourceKey(null)).toBeNull()
  })

  it('errores nuevos del PATCH y de confirm', () => {
    for (const code of ['invalid_action', 'invalid_type', 'invalid_timezone', 'unknown_city', 'date_required', 'activity_gone']) {
      expect(errorKey(code)).toBe(`importer.errors.${code}`)
    }
  })
})

describe('formato local', () => {
  it('hora y fecha en la zona dada', () => {
    expect(formatLocalTime('2026-12-03T09:30:00Z', 'Europe/Madrid')).toBe('10:30')
    expect(formatLocalTime('2026-12-03T09:30:00Z', 'America/Mexico_City')).toBe('03:30')
    expect(formatLocalTime(null, 'Europe/Madrid')).toBe('')
    expect(formatLocalDate('2026-12-03T23:30:00Z', 'Europe/Madrid', 'es')).toBe('vie 4 dic')
    expect(formatDayLabel('2026-12-03', 'en')).toBe('Thu 3 Dec')
  })
})

describe('hasDayNumbers', () => {
  it('con date_source day_number, "DAY 3" en el contexto o el Día 1 ya fijado', () => {
    expect(hasDayNumbers([activityRow({ source_ref: { ...activityRow().source_ref, context: null } })])).toBe(false)
    expect(hasDayNumbers([activityRow()])).toBe(true) // contexto "DAY 3 — MADRID"
    expect(hasDayNumbers([activityRow({ date_source: 'day_number', source_ref: { ...activityRow().source_ref, context: null } })])).toBe(true)
    expect(hasDayNumbers([], '2026-12-01')).toBe(true)
  })
})

describe('activityTypeOptions', () => {
  it('tipos de la gira con código válido y activos, más los de las filas que la gira no tiene', () => {
    const types = [
      { code: 'flight', name: 'Vuelo', color: '#123456', is_active: true, display_order: 2 },
      { code: 'soundcheck', name: 'Prueba de sonido', color: '#654321', is_active: true, display_order: 1 },
      { code: 'custom_x', name: 'Mío', color: '#000000', is_active: true, display_order: 0 },
      { code: 'rehearsal', name: 'Ensayo', color: '#111111', is_active: false, display_order: 3 },
    ]
    const opts = activityTypeOptions(types, [{ activity_type_code: 'show', type_name: 'Show' }])
    expect(opts).toEqual([
      { code: 'soundcheck', name: 'Prueba de sonido', color: '#654321' },
      { code: 'flight', name: 'Vuelo', color: '#123456' },
      { code: 'show', name: 'Show', color: null },
    ])
  })
})

describe('detectedActivities y pendingCounts', () => {
  it('suma por documento y cuenta equipo + actividades', () => {
    const job = activityJob([activityRow(), activityRow({ client_id: 'a2', needs_action: true })], {
      detected: {
        sources: [
          {
            ref: 'd2',
            document_uuid: 'D2',
            filename: 'Itinerario_MAD.pdf',
            kind: 'pdf_text',
            sheet: null,
            doc_kind: 'itinerary',
            processed: true,
            deferred: false,
            deferred_reason: null,
            rows_scanned: 40,
            truncated: false,
            people_found: 0,
            activities_found: 46,
          },
        ],
      },
    })
    expect(detectedActivities(job)).toEqual([{ key: 'D2', filename: 'Itinerario_MAD.pdf', activities: 46 }])
    expect(pendingCounts(job)).toEqual({ team: 0, activities: 1, total: 1 })
  })
})

describe('canConfirm con actividades', () => {
  it('equipo y actividades sin nada por resolver y al menos una fila no omitida', () => {
    expect(canConfirm(activityJob())).toBe(true)
    expect(canConfirm(activityJob([activityRow({ needs_action: true })]))).toBe(false)
    expect(canConfirm(activityJob([activityRow({ scheduled_at: null, start_time: null })]))).toBe(false)
    expect(canConfirm(activityJob([activityRow({ action: 'skip' })]))).toBe(false)
    // Equipo todo omitido pero con actividades: se puede.
    const mixed = importJob({ draft: { team: [teamRow({ action: 'skip' })], activities: [activityRow()] } })
    expect(canConfirm(mixed)).toBe(true)
    // Una actividad por resolver bloquea aunque el equipo esté listo.
    const blocked = importJob({ draft: { team: [teamRow()], activities: [activityRow({ needs_action: true })] } })
    expect(canConfirm(blocked)).toBe(false)
  })
})
