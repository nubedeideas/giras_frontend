import { apiClient } from '@/utils/apiClient'

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
  function listActivityTypes(): Promise<ActivityType[]> {
    return apiClient.getAll<ActivityType>('/events/activity-types/?page_size=100', {
      fallback: 'Error al cargar tipos de actividad',
    })
  }

  function createActivityType(payload: CreateActivityTypePayload): Promise<ActivityType> {
    return apiClient.post<ActivityType>('/events/activity-types/', payload, {
      fallback: 'Error al crear tipo de actividad',
    })
  }

  function updateActivityType(
    uuid: string,
    payload: UpdateActivityTypePayload
  ): Promise<ActivityType> {
    return apiClient.patch<ActivityType>(`/events/activity-types/${uuid}/`, payload, {
      fallback: 'Error al actualizar tipo de actividad',
    })
  }

  function deleteActivityType(uuid: string): Promise<void> {
    return apiClient.delete(`/events/activity-types/${uuid}/`, {
      fallback: 'Error al eliminar tipo de actividad',
    })
  }

  return { listActivityTypes, createActivityType, updateActivityType, deleteActivityType }
}
