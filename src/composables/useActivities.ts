import { apiClient } from '@/utils/apiClient'
import { toArray } from '@/utils/pagination'
import type { Paginated } from '@/types'
import type { ReminderStep } from '@/utils/reminders'

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
  /** Espejo de `reminder_steps`, solo lectura. */
  readonly default_reminder_minutes?: number[]
  /** `null` = fila legada (pasos derivados de `default_reminder_minutes` por WhatsApp). */
  reminder_steps?: ReminderStep[] | null
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
  function listActivities(params: Record<string, string> = {}): Promise<ActivityListItem[]> {
    const qs = new URLSearchParams({ page_size: '100', ...params }).toString()
    return apiClient.getAll<ActivityListItem>(`/events/activities/?${qs}`, {
      fallback: 'Error al cargar actividades',
    })
  }

  function getActivity(uuid: string): Promise<Activity> {
    return apiClient.get<Activity>(`/events/activities/${uuid}/`, {
      fallback: 'Error al cargar actividad',
    })
  }

  function createActivity(payload: CreateActivityPayload): Promise<Activity> {
    return apiClient.post<Activity>('/events/activities/', payload, {
      fallback: 'Error al crear actividad',
    })
  }

  function updateActivity(uuid: string, payload: UpdateActivityPayload): Promise<Activity> {
    return apiClient.patch<Activity>(`/events/activities/${uuid}/`, payload, {
      fallback: 'Error al actualizar actividad',
    })
  }

  function deleteActivity(uuid: string): Promise<void> {
    return apiClient.delete(`/events/activities/${uuid}/`, {
      fallback: 'Error al eliminar actividad',
    })
  }

  function updateStatus(uuid: string, status: ActivityStatus): Promise<Activity> {
    return apiClient.patch<Activity>(
      `/events/activities/${uuid}/update_status/`,
      { status },
      { fallback: 'Error al actualizar estado' }
    )
  }

  function completeActivity(uuid: string): Promise<Activity> {
    return apiClient.post<Activity>(`/events/activities/${uuid}/complete/`, undefined, {
      fallback: 'Error al completar actividad',
    })
  }

  function cancelActivity(uuid: string, reason = ''): Promise<Activity> {
    return apiClient.post<Activity>(
      `/events/activities/${uuid}/cancel/`,
      { reason },
      { fallback: 'Error al cancelar actividad' }
    )
  }

  async function listActivityTypes(): Promise<ActivityTypeListItem[]> {
    const data = await apiClient.get<Paginated<ActivityTypeListItem> | ActivityTypeListItem[]>(
      '/events/activity-types/',
      { fallback: 'Error al cargar tipos de actividad' }
    )
    return toArray(data)
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
