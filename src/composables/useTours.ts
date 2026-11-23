import { apiClient } from '@/utils/apiClient'
import type { TourStatus } from '@/types'
import type { DateOrderSetting } from '@/composables/useImportJobs'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape from GET /api/tours/ (TourListSerializer) */
export interface TourListItem {
  uuid: string
  name: string
  artist_name: string
  start_date: string
  end_date: string
  status: TourStatus
  status_display: string
  spotify_image_url: string | null
  members_count: number
  events_count: number
  duration_days: number
  owner_email: string
  /**
   * Listado y detalle: el usuario administra la gira (owner, o miembro activo y no borrado con
   * rol admin/tour_manager). Staff **no** cuenta (ver `can_manage_crew`). No viene en el PATCH.
   */
  current_user_is_admin?: boolean
  /** Zona horaria IANA de la gira: por defecto de las actividades nuevas y del day sheet. */
  timezone: string
  /**
   * Avisos de la gira activos. Solo lectura: se cambia con `pause-notifications/` y
   * `resume-notifications/` (el PATCH lo ignora).
   */
  enable_notifications: boolean
  /** ISO desde que los avisos están en pausa, o null si están activos. */
  notifications_paused_at: string | null
  created_at: string
  updated_at: string
}

/** Shape from GET /api/tours/{uuid}/ (TourSerializer) — superset of TourListItem */
export interface TourFull extends TourListItem {
  description: string
  genre: string
  budget: string | null
  currency: string
  team_size: number | null
  notes: string
  tags: string[]
  settings: Record<string, unknown>
  spotify_artist_id: string | null
  spotify_artist_url: string | null
  spotify_followers: number | null
  spotify_synced_at: string | null
  is_active: boolean
  has_spotify_integration: boolean
  default_calendar: number | null
  default_notification_group: string | null
  default_notification_group_name: string | null
  /** Alerta del día de show (bloque 3.2). */
  show_day_alert_enabled: boolean
  /** "HH:MM:SS" o null (= hora por defecto del backend). */
  show_day_alert_time: string | null
  /** "HH:MM", p. ej. "09:00". Solo en GET /api/tours/{uuid}/. */
  show_day_alert_default_time: string
  /** false mientras Meta no apruebe la plantilla (sin SID). Solo en GET /api/tours/{uuid}/. */
  show_day_alert_available: boolean
  /** Portal del crew (bloque 3.4): enlace personal sin cuenta. */
  crew_portal_enabled: boolean
  /** Días de agenda visibles en el portal, hoy incluido (1-31). */
  crew_portal_days: number
  /** Puede gestionar el portal del crew y la visibilidad de documentos: admin de la gira o staff. */
  can_manage_crew?: boolean
  /** Solo en GET /api/tours/{uuid}/: YYYY-MM-DD en que caducan los enlaces del crew, o null. */
  crew_portal_expires_on?: string | null
  /**
   * F5a: orden de las fechas ambiguas de los documentos importados (`auto` por defecto). En el
   * detalle y en el PATCH, no en el listado. Opcional hasta que lo despliegue el backend.
   */
  date_order?: DateOrderSetting
}

/**
 * Respuesta de PATCH /api/tours/{uuid}/ (TourUpdateSerializer): los campos del modelo, sin los
 * calculados del retrieve (`show_day_alert_available`, `show_day_alert_default_time`,
 * `default_notification_group_name`, `current_user_is_admin`).
 */
export type TourUpdateResponse = Omit<
  TourFull,
  | 'show_day_alert_available'
  | 'show_day_alert_default_time'
  | 'default_notification_group_name'
  | 'current_user_is_admin'
>

export interface CreateTourPayload {
  name: string
  artist_name: string
  start_date: string
  end_date: string
  description?: string
  genre?: string
  budget?: string
  currency?: string
  team_size?: number
  notes?: string
  settings?: Record<string, unknown>
  spotify_artist_url?: string
  spotify_artist_id?: string
  spotify_image_url?: string
  spotify_followers?: number
  spotify_synced_at?: string
  /** IANA; si falta, el backend usa la del owner (si no es UTC) o `Europe/Madrid`. */
  timezone?: string
}

export interface UpdateTourPayload {
  name?: string
  artist_name?: string
  start_date?: string
  end_date?: string
  status?: TourStatus
  description?: string
  genre?: string
  budget?: string | null
  currency?: string
  team_size?: number | null
  notes?: string
  settings?: Record<string, unknown>
  spotify_artist_url?: string | null
  spotify_artist_id?: string | null
  spotify_image_url?: string | null
  spotify_followers?: number | null
  spotify_synced_at?: string | null
  default_calendar?: number | null
  default_notification_group?: string | null
  show_day_alert_enabled?: boolean
  /** "HH:MM" en tramos de 15 min; null = hora por defecto. */
  show_day_alert_time?: string | null
  crew_portal_enabled?: boolean
  /** 1-31; fuera de rango da 400 en el campo. */
  crew_portal_days?: number
  /** IANA; una zona no válida da 400 en el campo. */
  timezone?: string
  /** F5a: `auto|dmy|mdy`; otro valor da 400 en el campo. */
  date_order?: DateOrderSetting
}

/**
 * Respuesta de POST /api/tours/{uuid}/pause-notifications/ y resume-notifications/.
 * Pausar trae `held` (programadas futuras retenidas); reanudar, `cancelled` (vencidas durante la
 * pausa, canceladas con `tour_paused`) y `released`. `changed: false` = ya estaba así.
 */
export interface TourPauseResponse {
  enable_notifications: boolean
  notifications_paused_at: string | null
  changed: boolean
  held?: number
  cancelled?: number
  released?: number
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useTours() {
  function listTours(): Promise<TourListItem[]> {
    return apiClient.getAll<TourListItem>('/tours/?page_size=100', {
      fallback: 'Error al cargar giras',
    })
  }

  function getTour(uuid: string): Promise<TourFull> {
    return apiClient.get<TourFull>(`/tours/${uuid}/`, { fallback: 'Error al cargar gira' })
  }

  function createTour(payload: CreateTourPayload): Promise<TourFull> {
    return apiClient.post<TourFull>('/tours/', payload, { fallback: 'Error al crear gira' })
  }

  function updateTour(uuid: string, payload: UpdateTourPayload): Promise<TourUpdateResponse> {
    return apiClient.patch<TourUpdateResponse>(`/tours/${uuid}/`, payload, {
      fallback: 'Error al actualizar gira',
    })
  }

  function deleteTour(uuid: string): Promise<void> {
    return apiClient.delete(`/tours/${uuid}/`, { fallback: 'Error al eliminar gira' })
  }

  function pauseNotifications(uuid: string): Promise<TourPauseResponse> {
    return apiClient.post<TourPauseResponse>(`/tours/${uuid}/pause-notifications/`, undefined, {
      fallback: 'Error al pausar los avisos',
    })
  }

  function resumeNotifications(uuid: string): Promise<TourPauseResponse> {
    return apiClient.post<TourPauseResponse>(`/tours/${uuid}/resume-notifications/`, undefined, {
      fallback: 'Error al reanudar los avisos',
    })
  }

  return {
    listTours,
    getTour,
    createTour,
    updateTour,
    deleteTour,
    pauseNotifications,
    resumeNotifications,
  }
}
