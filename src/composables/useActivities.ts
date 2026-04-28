import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityStatus =
  | 'draft'
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'delayed'

export type ActivityPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface ActivityTypeRef {
  uuid: string
  code: string
  name: string
  category: string
  icon: string
  color: string
  has_destination: boolean
  has_duration: boolean
  metadata_schema?: Record<string, unknown>
  default_reminder_minutes?: number[]
}

export interface ActivityTypeListItem {
  uuid: string
  code: string
  name: string
  category: string
  icon: string
  color: string
  has_destination: boolean
  has_duration: boolean
  is_system: boolean
}

/** Shape returned by ActivityListSerializer */
export interface ActivityListItem {
  uuid: string
  title: string
  scheduled_at: string
  end_at: string | null
  timezone: string
  local_start_time: string | null
  status: ActivityStatus
  priority: ActivityPriority
  all_day: boolean
  location_name: string
  destination_name: string
  activity_type_name: string
  activity_type_code: string
  activity_type_icon: string
  activity_type_color: string
  category: string
}

/** Shape returned by ActivitySerializer (detail) */
export interface Activity {
  uuid: string
  title: string
  description: string
  scheduled_at: string
  end_at: string | null
  timezone: string
  all_day: boolean
  status: ActivityStatus
  priority: ActivityPriority
  location_name: string
  location_address: string
  destination_name: string
  destination_address: string
  destination_timezone: string
  notes: string
  cost: string | null
  currency: string
  external_id: string
  external_source: string
  activity_type: ActivityTypeRef | null
  tour?: string
  tour_name?: string
  metadata?: Record<string, unknown>
  local_start_time?: string
  local_end_time?: string
  duration?: number
  created_at: string
  updated_at: string
}

export interface CreateActivityPayload {
  tour: string
  activity_type: string
  title: string
  scheduled_at: string
  end_at?: string | null
  timezone?: string
  all_day?: boolean
  status?: ActivityStatus
  priority?: ActivityPriority
  location_name?: string
  destination_name?: string
  notes?: string
  description?: string
  external_id?: string
  external_source?: string
}

export interface UpdateActivityPayload {
  activity_type?: string
  title?: string
  scheduled_at?: string
  end_at?: string | null
  timezone?: string
  all_day?: boolean
  status?: ActivityStatus
  priority?: ActivityPriority
  location_name?: string
  destination_name?: string
  notes?: string
  description?: string
}

// ─── Status / Priority display helpers ───────────────────────────────────────

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  delayed: 'Retrasada',
}

export const STATUS_COLORS: Record<ActivityStatus, { bg: string; text: string }> = {
  draft:       { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
  scheduled:   { bg: 'rgba(26,143,255,0.12)',  text: '#1a8fff' },
  confirmed:   { bg: 'rgba(31,173,90,0.12)',   text: '#1fad5a' },
  in_progress: { bg: 'rgba(168,216,0,0.12)',   text: '#a8d800' },
  completed:   { bg: 'rgba(31,173,90,0.15)',   text: '#34d399' },
  cancelled:   { bg: 'rgba(239,68,68,0.12)',   text: '#f87171' },
  delayed:     { bg: 'rgba(232,93,0,0.12)',    text: '#e85d00' },
}

export const PRIORITY_LABELS: Record<ActivityPriority, string> = {
  low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
}

export const PRIORITY_COLORS: Record<ActivityPriority, string> = {
  low: '#94a3b8', normal: '#1a8fff', high: '#e85d00', urgent: '#ef4444',
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useActivities() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function listActivities(params: Record<string, string> = {}): Promise<ActivityListItem[]> {
    const qs = new URLSearchParams({ page_size: '100', ...params }).toString()
    const all: ActivityListItem[] = []
    let url: string | null = `${API_BASE}/events/activities/?${qs}`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar actividades')
      const data = await res.json()
      all.push(...(data.results ?? data))
      url = data.next ?? null
    }
    return all
  }

  async function getActivity(uuid: string): Promise<Activity> {
    const res = await auth().fetchWithAuth(`${API_BASE}/events/activities/${uuid}/`)
    if (!res.ok) throw new Error('Error al cargar actividad')
    return res.json()
  }

  async function createActivity(payload: CreateActivityPayload): Promise<Activity> {
    const res = await auth().fetchWithAuth(`${API_BASE}/events/activities/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      const msg = Array.isArray(first) ? first[0] : data.detail ?? 'Error al crear actividad'
      throw new Error(String(msg))
    }
    return data
  }

  async function updateActivity(uuid: string, payload: UpdateActivityPayload): Promise<Activity> {
    const res = await auth().fetchWithAuth(`${API_BASE}/events/activities/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      const msg = Array.isArray(first) ? first[0] : data.detail ?? 'Error al actualizar actividad'
      throw new Error(String(msg))
    }
    return data
  }

  async function deleteActivity(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/events/activities/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar actividad')
    }
  }

  async function updateStatus(uuid: string, status: ActivityStatus): Promise<Activity> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/events/activities/${uuid}/update_status/`,
      { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ status }) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al actualizar estado')
    return data
  }

  async function completeActivity(uuid: string): Promise<Activity> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/events/activities/${uuid}/complete/`,
      { method: 'POST' },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al completar actividad')
    return data
  }

  async function cancelActivity(uuid: string, reason = ''): Promise<Activity> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/events/activities/${uuid}/cancel/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ reason }) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al cancelar actividad')
    return data
  }

  async function listActivityTypes(): Promise<ActivityTypeListItem[]> {
    const res = await auth().fetchWithAuth(`${API_BASE}/events/activity-types/`)
    if (!res.ok) throw new Error('Error al cargar tipos de actividad')
    const data = await res.json()
    return data.results ?? data
  }

  return {
    listActivities,
    getActivity,
    createActivity,
    updateActivity,
    deleteActivity,
    updateStatus,
    completeActivity,
    cancelActivity,
    listActivityTypes,
  }
}
