import type { ImportJob, ImportJobListItem, ImportTeamRow } from '@/composables/useImportJobs'

/** Fixtures del importador (contrato de la spec 2026-11-22-importacion-f1-equipo.md, §3.4.6 y §5). */

export function teamRow(overrides: Partial<ImportTeamRow> = {}): ImportTeamRow {
  return {
    client_id: 't1',
    source_ref: {
      source: 'd1:Crew',
      document_uuid: 'D1',
      filename: 'Crew_2027.xlsx',
      sheet: 'Crew',
      row: 'Crew!2',
      kind: 'spreadsheet',
    },
    entity_type: 'person',
    first_name: 'Lucía',
    last_name: 'Martín',
    company: '',
    display_name: 'Lucía Martín',
    role_text: 'Monitores',
    role_slug: 'sound-engineer',
    role_uuid: 'R1',
    role_name: 'Sound Engineer',
    is_artist: false,
    phone: '+34611223344',
    phone_raw: '611 22 33 44',
    phone_status: 'valid',
    extra_phones: [],
    email: 'lucia@example.com',
    extra_emails: [],
    in_group: true,
    in_group_default: true,
    already_in_group: false,
    match: {
      status: 'new',
      by: null,
      contact_uuid: null,
      contact_name: null,
      contact_phone: null,
      candidates: [],
    },
    action: 'create',
    link_contact_uuid: null,
    ai_confidence: 0.95,
    confidence: 0.95,
    issues: [],
    needs_action: false,
    reviewed: false,
    edited: false,
    ...overrides,
  }
}

export function importListItem(overrides: Partial<ImportJobListItem> = {}): ImportJobListItem {
  return {
    uuid: 'J1',
    tour: 'T1',
    tour_name: 'Gira',
    status: 'ready',
    entry_point: 'tour',
    source_kind: 'file',
    filenames: ['Crew_2027.xlsx'],
    people_found: 1,
    summary: null,
    error_code: '',
    created_at: '2026-11-22T10:00:00Z',
    finished_at: null,
    confirmed_at: null,
    created_by_name: 'Ana',
    ...overrides,
  }
}

export function importJob(overrides: Partial<ImportJob> = {}): ImportJob {
  const team = overrides.draft?.team ?? [teamRow()]
  return {
    ...importListItem(),
    progress: { calls_done: 0, calls_total: 0 },
    detected: { sources: [] },
    draft: {
      team,
      warnings: [],
      assumptions: { default_region: 'ES', default_region_source: 'tour_timezone' },
    },
    summary: {
      total: team.length,
      to_create: team.filter((r) => r.action === 'create').length,
      to_link: team.filter((r) => r.action === 'link').length,
      to_skip: team.filter((r) => r.action === 'skip').length,
      in_group: team.filter((r) => r.in_group && r.action !== 'skip').length,
      needs_action: team.filter((r) => r.needs_action).length,
      without_phone: 0,
      not_mobile: 0,
    },
    team_group: {
      uuid: null,
      name: 'Equipo de la gira',
      exists: false,
      is_default: true,
      default_group_name: null,
    },
    result: {},
    error_message: '',
    purged_at: null,
    documents: [],
    ...overrides,
  }
}
