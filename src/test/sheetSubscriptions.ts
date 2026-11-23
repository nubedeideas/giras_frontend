import type { SheetInspectResult, SheetSubscription } from '@/composables/useSheetSubscriptions'

/** Hoja vinculada (contrato de la spec 2026-11-23-importacion-f4-google-sheets.md, §3.8). */
export function sheetSub(overrides: Partial<SheetSubscription> = {}): SheetSubscription {
  return {
    uuid: 'G1',
    provider: 'gsheet',
    tour: 'T1',
    tour_name: 'Gira 2027',
    name: 'Gira 2027',
    spreadsheet_title: 'Gira 2027 · Producción',
    tabs: [
      { gid: 0, title: 'Itinerario', range: '', doc_kind: 'itinerary', missing: false, rows: 214 },
    ],
    open_url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit',
    reader: { name: 'Oscar', is_me: true, has_access: true },
    sync_enabled: true,
    last_status: 'ok',
    last_error_code: '',
    error_count: 0,
    last_attempt_at: '2026-11-23T10:00:00Z',
    last_synced_at: '2026-11-23T10:00:00Z',
    next_sync_at: '2026-11-23T16:03:00Z',
    stats: {
      rows_seen: 214,
      last_new: 3,
      last_changed: 1,
      last_removed: 0,
      removal_guard: false,
      pending_review: false,
      tabs_missing: 0,
    },
    pending_job: null,
    created_at: '2026-11-23T09:59:00Z',
    ...overrides,
  }
}

/** Respuesta de `POST inspect/`. */
export function sheetInspect(overrides: Partial<SheetInspectResult> = {}): SheetInspectResult {
  return {
    spreadsheet_title: 'Gira 2027 · Producción',
    already_subscribed: null,
    tabs: [
      { gid: 11, title: 'Notas', index: 0, hidden: true, rows: 10, columns: 3 },
      { gid: 0, title: 'Itinerario', index: 1, hidden: false, rows: 214, columns: 12 },
      { gid: 22, title: 'Equipo', index: 2, hidden: false, rows: 30, columns: 6 },
      { gid: 33, title: 'Hoteles', index: 3, hidden: false, rows: 40, columns: 8 },
      { gid: 44, title: 'Vuelos', index: 4, hidden: false, rows: 20, columns: 8 },
      { gid: 55, title: 'Backline', index: 5, hidden: false, rows: 15, columns: 4 },
      { gid: 66, title: 'Catering', index: 6, hidden: false, rows: 12, columns: 4 },
    ],
    ...overrides,
  }
}

/** 403 plano de "falta el permiso de Google" (`google_scope_missing_response`). */
export function scopeMissing() {
  return {
    code: 'google_scope_missing',
    detail: 'Conecta Google Sheets.',
    purpose: 'sheets',
    required_scopes: ['https://www.googleapis.com/auth/drive.file'],
    connected: true,
  }
}

/** Estado de Google con o sin el permiso de hojas. */
export function googleStatus(sheets: boolean) {
  return {
    connected: true,
    account_email: 'tm@giras.pro',
    granted_scopes: [],
    features: { calendar: true, calendar_write: true, contacts: false, sheets },
    connected_at: '2026-11-20T10:00:00Z',
  }
}
