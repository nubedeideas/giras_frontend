import { useAuthStore } from '@/stores/auth'
import type { TourStatus } from '@/types'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useTours() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function listTours(): Promise<TourListItem[]> {
    const all: TourListItem[] = []
    let url: string | null = `${API_BASE}/tours/?page_size=100`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar giras')
      const data = await res.json()
      all.push(...(data.results ?? data))
      url = data.next ?? null
    }
    return all
  }

  async function getTour(uuid: string): Promise<TourFull> {
    const res = await auth().fetchWithAuth(`${API_BASE}/tours/${uuid}/`)
    if (!res.ok) throw new Error('Error al cargar gira')
    return res.json()
  }

  async function createTour(payload: CreateTourPayload): Promise<TourFull> {
    const res = await auth().fetchWithAuth(`${API_BASE}/tours/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      const msg = Array.isArray(first) ? first[0] : data.detail ?? 'Error al crear gira'
      throw new Error(String(msg))
    }
    return data
  }

  async function updateTour(uuid: string, payload: UpdateTourPayload): Promise<TourFull> {
    const res = await auth().fetchWithAuth(`${API_BASE}/tours/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      const msg = Array.isArray(first) ? first[0] : data.detail ?? 'Error al actualizar gira'
      throw new Error(String(msg))
    }
    return data
  }

  async function deleteTour(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/tours/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar gira')
    }
  }

  return { listTours, getTour, createTour, updateTour, deleteTour }
}
