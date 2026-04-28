import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityCategory =
  | 'logistics'
  | 'production'
  | 'media'
  | 'meetings'
  | 'fan'
  | 'personal'
  | 'other'

export interface ActivityType {
  uuid: string
  code: string
  name: string
  category: ActivityCategory
  icon: string
  color: string
  description: string
  display_order: number
  is_system: boolean
  is_active: boolean
  has_destination: boolean
  has_duration: boolean
  default_duration_minutes: number
  activity_count?: number
  created_at?: string
  updated_at?: string
}

export interface CreateActivityTypePayload {
  name: string
  category: ActivityCategory
  color: string
  icon?: string
  description?: string
  is_active?: boolean
  has_destination?: boolean
  has_duration?: boolean
  default_duration_minutes?: number
}

export interface UpdateActivityTypePayload {
  name?: string
  category?: ActivityCategory
  color?: string
  icon?: string
  description?: string
  is_active?: boolean
  has_destination?: boolean
  has_duration?: boolean
  default_duration_minutes?: number
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useActivityTypes() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function listActivityTypes(): Promise<ActivityType[]> {
    const all: ActivityType[] = []
    let url: string | null = `${API_BASE}/events/activity-types/?page_size=100`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar tipos de actividad')
      const data = await res.json()
      const page: ActivityType[] = data.results ?? data
      all.push(...page)
      url = data.next ?? null
    }
    return all
  }

  async function createActivityType(payload: CreateActivityTypePayload): Promise<ActivityType> {
    const res = await auth().fetchWithAuth(`${API_BASE}/events/activity-types/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      const msg = Array.isArray(first) ? first[0] : data.detail ?? 'Error al crear tipo de actividad'
      throw new Error(String(msg))
    }
    return data
  }

  async function updateActivityType(
    uuid: string,
    payload: UpdateActivityTypePayload,
  ): Promise<ActivityType> {
    const res = await auth().fetchWithAuth(`${API_BASE}/events/activity-types/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      const msg = Array.isArray(first) ? first[0] : data.detail ?? 'Error al actualizar tipo de actividad'
      throw new Error(String(msg))
    }
    return data
  }

  async function deleteActivityType(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/events/activity-types/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? data.error ?? 'Error al eliminar tipo de actividad')
    }
  }

  return { listActivityTypes, createActivityType, updateActivityType, deleteActivityType }
}
