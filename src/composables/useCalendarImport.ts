import { DateTime } from 'luxon'
import { apiClient } from '@/utils/apiClient'
import { toArray } from '@/utils/pagination'
import type { Paginated } from '@/types'

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
  /** GET /api/integrations/calendars/google_calendars/ — calendarios disponibles en la cuenta de Google */
  function listGoogleCalendars(): Promise<GoogleCalendarItem[]> {
    return apiClient.get<GoogleCalendarItem[]>('/integrations/calendars/google_calendars/', {
      fallback: 'No se pudo obtener la lista de calendarios de Google',
    })
  }

  /** GET /api/integrations/calendars/ — calendarios suscritos del usuario */
  async function listCalendars(): Promise<CalendarSubscription[]> {
    const data = await apiClient.get<Paginated<CalendarSubscription> | CalendarSubscription[]>(
      '/integrations/calendars/',
      { fallback: 'Error al cargar calendarios' }
    )
    return toArray(data)
  }

  /**
   * POST /api/integrations/calendars/{id}/sync_now/
   * Sincronización síncrona: espera resultado con stats.
   */
  function syncCalendarNow(subscriptionId: number): Promise<SyncStats> {
    return apiClient.post<SyncStats>(
      `/integrations/calendars/${subscriptionId}/sync_now/`,
      undefined,
      { fallback: 'Error al sincronizar el calendario' }
    )
  }

  /**
   * GET /api/integrations/events/?subscription={id}&ordering=start_datetime
   * Devuelve todos los eventos del calendario (no importados / no ignorados).
   * El filtrado de fechas futuras se hace en cliente.
   */
  async function listCalendarEvents(subscriptionId: number): Promise<ImportedEvent[]> {
    const all = await apiClient.getAll<ImportedEvent>(
      `/integrations/events/?subscription=${subscriptionId}&ordering=start_datetime&page_size=100`,
      { fallback: 'Error al cargar eventos del calendario' }
    )
    // Exclude already imported/ignored; keep only future events
    const now = DateTime.now()
    return all.filter(
      (e) =>
        e.import_status !== 'imported' &&
        e.import_status !== 'ignored' &&
        DateTime.fromISO(e.start_datetime) >= now
    )
  }

  /** GET /api/integrations/events/{id}/preview_parse/ — AI preview without committing */
  function previewParse(eventId: number): Promise<ParsedPreview> {
    return apiClient.get<ParsedPreview>(`/integrations/events/${eventId}/preview_parse/`, {
      fallback: 'Error al obtener previsualización de IA',
    })
  }

  /** POST /api/integrations/events/bulk_smart_import/ — import + mark as imported */
  function bulkSmartImport(eventIds: number[]): Promise<BulkImportResult> {
    return apiClient.post<BulkImportResult>(
      '/integrations/events/bulk_smart_import/',
      { event_ids: eventIds },
      { fallback: 'Error al importar actividades' }
    )
  }

  /** POST /api/integrations/calendars/ — connect a new calendar subscription */
  function createCalendar(calendarId: string, calendarName: string): Promise<CalendarSubscription> {
    return apiClient.post<CalendarSubscription>(
      '/integrations/calendars/',
      { calendar_id: calendarId, calendar_name: calendarName },
      { fallback: 'Error al conectar el calendario' }
    )
  }

  /** DELETE /api/integrations/calendars/{id}/ — disconnect a calendar subscription */
  function deleteCalendar(subscriptionId: number): Promise<void> {
    return apiClient.delete(`/integrations/calendars/${subscriptionId}/`, {
      fallback: 'Error al desconectar el calendario',
    })
  }

  return {
    listGoogleCalendars,
    listCalendars,
    syncCalendarNow,
    listCalendarEvents,
    previewParse,
    bulkSmartImport,
    createCalendar,
    deleteCalendar,
  }
}
