import { apiClient } from '@/utils/apiClient'
import type { TourStatus } from '@/types'

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
  enable_notifications: boolean
  spotify_artist_id: string | null
  spotify_artist_url: string | null
  spotify_followers: number | null
  spotify_synced_at: string | null
  is_active: boolean
  has_spotify_integration: boolean
  default_calendar: number | null
  default_notification_group: string | null
  default_notification_group_name: string | null
}

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

  function updateTour(uuid: string, payload: UpdateTourPayload): Promise<TourFull> {
    return apiClient.patch<TourFull>(`/tours/${uuid}/`, payload, {
      fallback: 'Error al actualizar gira',
    })
  }

  function deleteTour(uuid: string): Promise<void> {
    return apiClient.delete(`/tours/${uuid}/`, { fallback: 'Error al eliminar gira' })
  }

  return { listTours, getTour, createTour, updateTour, deleteTour }
}
