import { apiClient, buildQuery } from '@/utils/apiClient'
import type { ReminderStep } from '@/utils/reminders'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Revisión pendiente del tipo que asignó la IA de Calendar (`metadata.ai_review`, spec de
 * recordatorios por tipo, R3). Lo devuelven el listado y el detalle de actividades.
 */
export interface ActivityAiReview {
  status: 'pending' | 'confirmed'
  /** Código del tipo que propuso la IA. */
  type_code: string
  source: string
  at: string
}

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
  /** R3: `null`/ausente si la IA no asignó el tipo. */
  ai_review?: ActivityAiReview | null
  /**
   * Hoy NO viene en el listado (solo en detalle). Opcional para el contorno "importado" del
   * calendario cuando el backend lo añada (spec Paleta B §11.1).
   */
  external_source?: string
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
  /** String del backend ("2h 0m", ignora días): no se pinta; ver utils/duration.ts. */
  duration?: string | null
  /** R3: revisión del tipo asignado por la IA. */
  ai_review?: ActivityAiReview | null
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
  /**
   * Campo de escritura real del tipo en `ActivitySerializer` (`activity_type` es de solo lectura
   * en el PATCH). Cambiar el tipo confirma la revisión de la IA (R3).
   */
  activity_type_id?: string
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

export const PRIORITY_LABELS: Record<ActivityPriority, string> = {
  low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
}

export const PRIORITY_COLORS: Record<ActivityPriority, string> = {
  low: 'var(--ink-3)', normal: 'var(--scheduled-fg)', high: 'var(--priority-high)', urgent: 'var(--priority-high)',
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

  /** Actividades de la gira con el tipo de la IA pendiente de revisar (R3). */
  function listPendingAiReview(tourUuid: string): Promise<ActivityListItem[]> {
    return listActivities({ tour: tourUuid, ai_review: 'pending' })
  }

  /** Confirma el tipo propuesto por la IA. 409 `no_pending_review` si ya no está pendiente. */
  function confirmAiReview(uuid: string): Promise<Activity> {
    return apiClient.post<Activity>(
      `/events/activities/${uuid}/confirm-ai-review/`,
      {},
      { fallback: 'No se ha podido confirmar la actividad' }
    )
  }

  /**
   * Tipos de actividad (todas las páginas). Con `tourUuid`, los del owner de la gira más los de
   * sistema (`?tour=`): es lo que hay que ofrecer al editar una actividad de esa gira, porque un
   * coadmin tiene su propia lista. 404 si no eres miembro de la gira.
   */
  function listActivityTypes(tourUuid?: string): Promise<ActivityTypeListItem[]> {
    const qs = buildQuery({ tour: tourUuid, page_size: 100 })
    return apiClient.getAll<ActivityTypeListItem>(`/events/activity-types/?${qs}`, {
      fallback: 'Error al cargar tipos de actividad',
    })
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
    listPendingAiReview,
    confirmAiReview,
  }
}
