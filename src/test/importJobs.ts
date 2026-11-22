import type {
  ImportActivityRow,
  ImportJob,
  ImportJobListItem,
  ImportNotificationsPreview,
  ImportTeamRow,
} from '@/composables/useImportJobs'

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

/** Fila de actividad (F2 §3.5.8): vuelo del 3 de diciembre en Madrid, sin problemas. */
export function activityRow(overrides: Partial<ImportActivityRow> = {}): ImportActivityRow {
  return {
    client_id: 'a1',
    source_ref: {
      source: 'd2',
      document_uuid: 'D2',
      filename: 'Itinerario_MAD.pdf',
      sheet: null,
      row: 'p3:L14',
      page: 3,
      kind: 'pdf_text',
      snippet: 'Wed 3 Dec · 10:30 · IB3456 MAD-BCN · Loc. ABC12',
      context: 'DAY 3 — MADRID — Wed 3 Dec',
    },
    activity_type_code: 'flight',
    type_name: 'Vuelo',
    type_available: true,
    title: 'IB3456 Madrid → Barcelona',
    date: '2026-12-03',
    date_text: 'Wed 3 Dec',
    date_source: 'text',
    start_time: '10:30',
    end_time: '11:45',
    end_date: '2026-12-03',
    all_day: false,
    timezone: 'Europe/Madrid',
    timezone_source: 'iata',
    destination_timezone: 'Europe/Madrid',
    scheduled_at: '2026-12-03T09:30:00Z',
    end_at: '2026-12-03T10:45:00Z',
    city: 'Madrid',
    city_key: 'madrid|es',
    country: 'ES',
    location_name: 'MAD',
    location_address: '',
    destination_name: 'BCN',
    destination_address: '',
    metadata: { flight_number: 'IB3456', airline: 'Iberia', booking_reference: 'ABC12' },
    notes: '',
    priority: 'high',
    pair_id: null,
    match: {
      status: 'new',
      by: null,
      activity_uuid: null,
      activity_title: null,
      activity_scheduled_at: null,
      activity_type_code: null,
      activity_external_source: null,
    },
    duplicate_of: null,
    action: 'create',
    ai_confidence: 0.94,
    confidence: 0.94,
    issues: [],
    needs_action: false,
    reviewed: false,
    edited: false,
    in_past: false,
    ...overrides,
  }
}

/** Respuesta de `preview-notifications/` (F2 §5). */
export function notificationsPreview(
  overrides: Partial<ImportNotificationsPreview> = {}
): ImportNotificationsPreview {
  return {
    recipients: {
      group: { uuid: 'G1', name: 'Equipo de la gira', is_tour_team: true, is_default: true },
      people: 9,
      people_from_import: 3,
      with_mobile: 10,
      with_email: 7,
      with_account: 2,
      without_phone: ['Marta Ruiz'],
      type_groups: [],
    },
    reminders_by_type: [
      {
        code: 'flight',
        name: 'Vuelo',
        activities: 6,
        steps: [
          { minutes: 1440, channel: 'email' },
          { minutes: 180, channel: 'whatsapp' },
          { minutes: 60, channel: 'in_app' },
        ],
        messages: { whatsapp: 72, email: 42, in_app: 12 },
      },
    ],
    rules: [],
    show_day_alert: { enabled: true, will_activate: true, days: 8, channel: 'whatsapp' },
    totals: { whatsapp: 311, email: 120, in_app: 40 },
    first_send_at: '2026-11-30T08:00:00Z',
    quota: { remaining: 500, plan_limit: 500, exceeds: false, overflow: 0 },
    paused: { current: false, after_confirm: false },
    tour_will_activate: true,
    warnings: [],
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
      // Con el grupo sin crear el backend da siempre `is_default=false`.
      is_default: false,
      default_group_name: null,
    },
    result: {},
    error_message: '',
    purged_at: null,
    documents: [],
    ...overrides,
  }
}
