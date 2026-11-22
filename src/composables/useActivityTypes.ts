import { apiClient } from '@/utils/apiClient'
import type { ReminderStep } from '@/utils/reminders'

export type { ReminderChannel, ReminderStep } from '@/utils/reminders'

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
  /**
   * Recordatorios del tipo (plantilla del usuario). `null` = fila legada: los pasos salen de
   * `default_reminder_minutes` por WhatsApp. Ver spec de recordatorios por tipo, D2.
   */
  reminder_steps?: ReminderStep[] | null
  /** Espejo de `reminder_steps` (solo lectura: el PATCH lo ignora). */
  readonly default_reminder_minutes?: number[]
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
  /**
   * Sin `tourUuid`, los tipos del usuario. Con él (`?tour=`), los del owner de la gira más los de
   * sistema: los que admite una actividad de esa gira aunque seas coadmin.
   */
  function listActivityTypes(tourUuid?: string): Promise<ActivityType[]> {
    const qs = tourUuid
      ? `tour=${encodeURIComponent(tourUuid)}&page_size=100`
      : 'page_size=100'
    return apiClient.getAll<ActivityType>(`/events/activity-types/?${qs}`, {
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

  /** PATCH /api/events/activity-types/{uuid}/ con `{reminder_steps}`. 400 con `code` de pasos. */
  function updateReminderSteps(uuid: string, steps: ReminderStep[]): Promise<ActivityType> {
    return apiClient.patch<ActivityType>(
      `/events/activity-types/${uuid}/`,
      { reminder_steps: steps },
      { fallback: 'No se han podido guardar los recordatorios' }
    )
  }

  /** POST /api/events/activity-types/reset-reminders/: valores de Giras (todos o esos códigos). */
  function resetReminders(codes?: string[]): Promise<{ updated: number }> {
    return apiClient.post<{ updated: number }>(
      '/events/activity-types/reset-reminders/',
      codes ? { codes } : {},
      { fallback: 'No se han podido restablecer los recordatorios' }
    )
  }

  return {
    listActivityTypes,
    createActivityType,
    updateActivityType,
    deleteActivityType,
    updateReminderSteps,
    resetReminders,
  }
}
