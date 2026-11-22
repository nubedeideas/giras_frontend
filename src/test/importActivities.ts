import type { ImportActivityRow, ImportActivitySummary, ImportJob } from '@/composables/useImportJobs'
import { activityRow, importJob } from '@/test/importJobs'
import { activityNeedsAction } from '@/utils/importReview'

/** Fixtures de la revisión de actividades (F2 §3.5.8, §3.11). */

export function activitySummary(rows: ImportActivityRow[]): ImportActivitySummary {
  return {
    total: rows.length,
    to_create: rows.filter((r) => r.action === 'create').length,
    to_replace: rows.filter((r) => r.action === 'replace').length,
    to_skip: rows.filter((r) => r.action === 'skip').length,
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
