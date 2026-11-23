import type {
  ImportActivityRow,
  ImportActivitySummary,
  ImportJob,
  ImportJobSheet,
} from '@/composables/useImportJobs'
import { activityRow, importJob } from '@/test/importJobs'
import { activityNeedsAction } from '@/utils/importReview'

/** Fixtures de la revisión de actividades (F2 §3.5.8, §3.11). */

export function activitySummary(rows: ImportActivityRow[]): ImportActivitySummary {
  return {
    total: rows.length,
    to_create: rows.filter((r) => r.action === 'create').length,
    to_replace: rows.filter((r) => r.action === 'replace').length,
    to_skip: rows.filter((r) => r.action === 'skip').length,
    to_cancel: rows.filter((r) => r.action === 'cancel').length,
    needs_action: rows.filter(activityNeedsAction).length,
    duplicates: rows.filter((r) => r.match.status === 'duplicate').length,
    possible_duplicates: rows.filter((r) => r.match.status === 'possible_duplicate').length,
    outside_tour: rows.filter((r) => r.issues.includes('outside_tour')).length,
    in_past: rows.filter((r) => r.in_past).length,
    by_type: {},
    days: new Set(rows.map((r) => r.date)).size,
  }
}

/** Job en `ready` solo con actividades (sin equipo), con supuestos de F2. */
export function activityJob(
  rows: ImportActivityRow[] = [activityRow()],
  overrides: Partial<ImportJob> = {}
): ImportJob {
  const base = importJob({ draft: { team: [] } })
  return {
    ...base,
    filenames: ['Itinerario_MAD.pdf'],
    people_found: 0,
    activities_found: rows.length,
    expected: 'itinerary',
    detected: { sources: [], expected: 'itinerary' },
    draft: {
      team: [],
      activities: rows,
      warnings: [],
      assumptions: {
        default_region: 'ES',
        default_region_source: 'tour_timezone',
        year: 2026,
        year_source: 'tour',
        date_order: 'dmy',
        date_order_source: 'detected',
        date_order_conflict: false,
        default_timezone: 'Europe/Madrid',
        default_timezone_source: 'tour',
        day_one_date: null,
        day_one_source: null,
        hotel_checkin_time: '15:00',
        hotel_checkout_time: '12:00',
        cities: {
          'madrid|es': {
            label: 'Madrid',
            country: 'ES',
            timezone: 'Europe/Madrid',
            source: 'airports',
            candidates: ['Europe/Madrid'],
          },
        },
      },
    },
    summary: { ...base.summary!, activities: activitySummary(rows) },
    team_group: null,
    ...overrides,
  }
}

/** Fila de calendario (F3 §3.5.2): `source_ref.kind = 'ics'`, fecha y hora del fichero. */
export function calendarActivityRow(overrides: Partial<ImportActivityRow> = {}): ImportActivityRow {
  const base = activityRow()
  return {
    ...base,
    client_id: 'a5',
    source_ref: {
      source: 'd1',
      document_uuid: 'D1',
      filename: 'gira.ics',
      sheet: null,
      row: 'e12',
      page: null,
      kind: 'ics',
      snippet: 'SUMMARY:Show Madrid\nDTSTART;TZID=Europe/Madrid:20261203T210000',
      context: 'Gira 2026',
      uid: 'abc-123@icloud.com',
      recurrence_id: null,
      sequence: 0,
    },
    activity_type_code: 'show',
    type_name: 'Show',
    title: 'Show Madrid',
    date_text: 'DTSTART 2026-12-03 21:00 (Europe/Madrid)',
    date_source: 'ics',
    start_time: '21:00',
    end_time: '23:00',
    timezone_source: 'ics',
    scheduled_at: '2026-12-03T20:00:00Z',
    end_at: '2026-12-03T22:00:00Z',
    location_name: 'WiZink Center',
    destination_name: '',
    metadata: {},
    ...overrides,
  }
}

/** Fila "Cambió en el calendario" (`updated_in_source`): antes a las 20:00, ahora a las 21:00. */
export function calendarChangedRow(
  overrides: Partial<ImportActivityRow> = {},
  match: Partial<ImportActivityRow['match']> = {}
): ImportActivityRow {
  return calendarActivityRow({
    action: 'replace',
    match: {
      status: 'updated_in_source',
      by: 'uid',
      activity_uuid: 'ACT-1',
      activity_title: 'Show Madrid',
      activity_scheduled_at: '2026-12-03T19:00:00Z',
      activity_type_code: 'show',
      activity_external_source: 'ics',
      changed_fields: ['scheduled_at'],
      conflict: false,
      ...match,
    },
    ...overrides,
  })
}

/** Fila "Cancelada en el calendario" (`cancelled_in_source`) sin decidir: `skip` + `needs_action`. */
export function calendarCancelledRow(overrides: Partial<ImportActivityRow> = {}): ImportActivityRow {
  return calendarActivityRow({
    client_id: 'a6',
    action: 'skip',
    needs_action: true,
    match: {
      status: 'cancelled_in_source',
      by: 'uid',
      activity_uuid: 'ACT-2',
      activity_title: 'Prueba de sonido',
      activity_scheduled_at: '2026-12-03T15:00:00Z',
      activity_type_code: 'soundcheck',
      activity_external_source: 'ics',
    },
    ...overrides,
  })
}

// ─── Hoja de Google (F4 §3.6.3) ───────────────────────────────────────────────

/** `job.sheet` de una hoja vinculada; `open_url` solo para quien la lee. */
export function jobSheet(overrides: Partial<ImportJobSheet> = {}): ImportJobSheet {
  return {
    subscription_uuid: 'SUB-1',
    name: 'Gira 2027 · Producción',
    new: 2,
    changed: 1,
    removed: 1,
    open_url: 'https://docs.google.com/spreadsheets/d/abc123/edit',
    ...overrides,
  }
}

/** Fila de una hoja (`source_ref.kind = 'gsheet'`, pestaña "Itinerario", fila 14). */
export function sheetActivityRow(overrides: Partial<ImportActivityRow> = {}): ImportActivityRow {
  const base = calendarActivityRow()
  return {
    ...base,
    client_id: 's1',
    source_ref: {
      source: 'd1:Itinerario',
      document_uuid: 'D1',
      filename: 'Gira 2027 · Producción.xlsx',
      sheet: 'Itinerario',
      row: 'Hoja1!14',
      page: null,
      kind: 'gsheet',
      snippet: '21:00 | Show | WiZink Center',
      context: 'DAY 3 — MADRID — Mié 3 dic',
      gid: 123,
      row_number: 14,
    },
    date_source: 'text',
    timezone_source: 'city',
    ...overrides,
  }
}

/** "Cambió en la hoja" (`updated_in_source` por `sheet_row`): antes a las 20:00, ahora a las 21:00. */
export function sheetChangedRow(
  overrides: Partial<ImportActivityRow> = {},
  match: Partial<ImportActivityRow['match']> = {}
): ImportActivityRow {
  return sheetActivityRow({
    action: 'replace',
    match: {
      status: 'updated_in_source',
      by: 'sheet_row',
      activity_uuid: 'ACT-1',
      activity_title: 'Show Madrid',
      activity_scheduled_at: '2026-12-03T19:00:00Z',
      activity_type_code: 'show',
      activity_external_source: 'gsheet',
      changed_fields: ['scheduled_at'],
      conflict: false,
      ...match,
    },
    ...overrides,
  })
}

/** "Ya no está en la hoja" (`cancelled_in_source`) sin decidir: `skip` + `needs_action`. */
export function sheetRemovedRow(
  reason: 'row_removed' | 'slot_gone' = 'row_removed',
  overrides: Partial<ImportActivityRow> = {}
): ImportActivityRow {
  return sheetActivityRow({
    client_id: 's2',
    action: 'skip',
    needs_action: true,
    match: {
      status: 'cancelled_in_source',
      by: 'sheet_row',
      activity_uuid: 'ACT-2',
      activity_title: 'Prueba de sonido',
      activity_scheduled_at: '2026-12-03T15:00:00Z',
      activity_type_code: 'soundcheck',
      activity_external_source: 'gsheet',
      reason,
    },
    ...overrides,
  })
}

/** Duplicado de un import manual que se vinculará a la hoja (`match.link`, `skip`). */
export function sheetLinkRow(overrides: Partial<ImportActivityRow> = {}): ImportActivityRow {
  return sheetActivityRow({
    client_id: 's3',
    action: 'skip',
    match: {
      status: 'duplicate',
      by: 'type_time_title',
      activity_uuid: 'ACT-3',
      activity_title: 'Show Madrid',
      activity_scheduled_at: '2026-12-03T20:00:00Z',
      activity_type_code: 'show',
      activity_external_source: 'import_job',
      link: true,
    },
    ...overrides,
  })
}

/** Job `sheet_sync` en `ready` con `job.sheet` y `summary.activities.to_link`. */
export function sheetJob(
  rows: ImportActivityRow[] = [sheetActivityRow()],
  overrides: Partial<ImportJob> = {}
): ImportJob {
  const base = activityJob(rows, { source_kind: 'sheet_sync', sheet: jobSheet() })
  const summary = base.summary!
  return {
    ...base,
    filenames: ['Gira 2027 · Producción.xlsx'],
    summary: {
      ...summary,
      activities: {
        ...summary.activities!,
        to_link: rows.filter((r) => r.action === 'skip' && r.match.link).length,
      },
    },
    ...overrides,
  }
}
