import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape from CalendarSubscriptionSerializer */
export interface CalendarSubscription {
  id: number
  calendar_id: string
  calendar_name: string
  is_active: boolean
  sync_enabled: boolean
  last_synced_at: string | null
  webhook_status: 'active' | 'expired' | 'not_registered'
  has_valid_webhook: boolean
  error_count: number
  last_error: string
}

/** Shape from SyncStatsSerializer */
export interface SyncStats {
  created: number
  updated: number
  deleted: number
  routed: number
  ambiguous: number
  no_match: number
  errors: string[]
}

export type ImportedEventStatus =
  | 'pending'
  | 'assigned'
  | 'ambiguous'
  | 'no_match'
  | 'imported'
  | 'ignored'

/** Shape from ImportedEventListSerializer */
export interface ImportedEvent {
  id: number
  summary: string
  start_datetime: string
  end_datetime: string | null
  all_day: boolean
  location: string
  import_status: ImportedEventStatus
  tour: number | null
  tour_name: string | null
  subscription_calendar: string
  giras_processed: boolean
  google_html_link: string
  created_at: string
}

/** Response from preview_parse — AIPreviewSerializer */
export interface ParsedPreview {
  activity_type_code: string | null
  title: string
  description: string
  priority: string
  status: string
  location_name: string
  location_address: string
  destination_name: string
  destination_address: string
  notes: string
  metadata: Record<string, unknown>
}

/** Single result entry from bulk_smart_import — BulkSmartImportResultSerializer */
export interface BulkImportResultItem {
  imported_event_id: number
  google_event_id: string
  summary: string
  status: 'success' | 'skipped' | 'error'
  activity_id: number | null
  activity_title: string | null
  activity_type_code: string | null
  error: string | null
}

/** Full response from bulk_smart_import */
export interface BulkImportResult {
  summary: {
    success: number
    skipped: number
    error: number
    total: number
  }
  results: BulkImportResultItem[]
}

// ─── Composable ───────────────────────────────────────────────────────────────

/** Shape of a Google Calendar list entry */
export interface GoogleCalendarItem {
  id: string
  summary: string
  description: string
  primary: boolean
  access_role: string
}

export function useCalendarImport() {
  function auth() {
    return useAuthStore()
  }

  /** GET /api/integrations/calendars/google_calendars/ — calendarios disponibles en la cuenta de Google */
  async function listGoogleCalendars(): Promise<GoogleCalendarItem[]> {
    const res = await auth().fetchWithAuth(`${API_BASE}/integrations/calendars/google_calendars/`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        (err as { error?: string }).error ?? 'No se pudo obtener la lista de calendarios de Google',
      )
    }
    return res.json()
  }

  /** GET /api/integrations/calendars/ — calendarios suscritos del usuario */
  async function listCalendars(): Promise<CalendarSubscription[]> {
    const res = await auth().fetchWithAuth(`${API_BASE}/integrations/calendars/`)
    if (!res.ok) throw new Error('Error al cargar calendarios')
    const data = await res.json()
    return data.results ?? data
  }

  /**
   * POST /api/integrations/calendars/{id}/sync_now/
   * Sincronización síncrona: espera resultado con stats.
   */
  async function syncCalendarNow(subscriptionId: number): Promise<SyncStats> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/integrations/calendars/${subscriptionId}/sync_now/`,
      { method: 'POST' },
    )
    if (!res.ok) throw new Error('Error al sincronizar el calendario')
    return res.json()
  }

  /**
   * GET /api/integrations/events/?subscription={id}&ordering=start_datetime
   * Devuelve todos los eventos del calendario (no importados / no ignorados).
   * El filtrado de fechas futuras se hace en cliente.
   */
  async function listCalendarEvents(subscriptionId: number): Promise<ImportedEvent[]> {
    const all: ImportedEvent[] = []
    let url: string | null =
      `${API_BASE}/integrations/events/?subscription=${subscriptionId}&ordering=start_datetime&page_size=100`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar eventos del calendario')
      const data = await res.json()
      all.push(...(data.results ?? data))
      url = data.next ?? null
    }
    // Exclude already imported/ignored; keep only future events
    const now = new Date()
    return all.filter(
      (e) =>
        e.import_status !== 'imported' &&
        e.import_status !== 'ignored' &&
        new Date(e.start_datetime) >= now,
    )
  }

  /** GET /api/integrations/events/{id}/preview_parse/ — AI preview without committing */
  async function previewParse(eventId: number): Promise<ParsedPreview> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/integrations/events/${eventId}/preview_parse/`,
    )
    if (!res.ok) throw new Error('Error al obtener previsualización de IA')
    return res.json()
  }

  /** POST /api/integrations/events/bulk_smart_import/ — import + mark as imported */
  async function bulkSmartImport(eventIds: number[]): Promise<BulkImportResult> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/integrations/events/bulk_smart_import/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ids: eventIds }),
      },
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        (err as { detail?: string; error?: string }).detail ??
          (err as { detail?: string; error?: string }).error ??
          'Error al importar actividades',
      )
    }
    return res.json()
  }

  /** POST /api/integrations/calendars/ — connect a new calendar subscription */
  async function createCalendar(calendarId: string, calendarName: string): Promise<CalendarSubscription> {
    const res = await auth().fetchWithAuth(`${API_BASE}/integrations/calendars/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendar_id: calendarId, calendar_name: calendarName }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        (err as { detail?: string }).detail ?? 'Error al conectar el calendario',
      )
    }
    return res.json()
  }

  /** DELETE /api/integrations/calendars/{id}/ — disconnect a calendar subscription */
  async function deleteCalendar(subscriptionId: number): Promise<void> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/integrations/calendars/${subscriptionId}/`,
      { method: 'DELETE' },
    )
    if (!res.ok && res.status !== 204) throw new Error('Error al desconectar el calendario')
  }

  return { listGoogleCalendars, listCalendars, syncCalendarNow, listCalendarEvents, previewParse, bulkSmartImport, createCalendar, deleteCalendar }
}
