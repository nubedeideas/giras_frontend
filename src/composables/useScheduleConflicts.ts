import { apiClient } from '@/utils/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConflictType = 'overlap' | 'travel_time'

export interface ScheduleConflict {
  uuid: string
  conflict_type: ConflictType
  conflict_type_display: string
  description: string
  activity_a_uuid: string
  activity_a_title: string
  activity_b_uuid: string
  activity_b_title: string
  resolved: boolean
  resolved_at: string | null
  resolved_by_name: string | null
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useScheduleConflicts() {
  function listConflicts(tourUuid: string): Promise<ScheduleConflict[]> {
    return apiClient.getAll<ScheduleConflict>(`/tours/${tourUuid}/conflicts/?page_size=100`, {
      fallback: 'Error al cargar conflictos de agenda',
    })
  }

  function resolveConflict(tourUuid: string, conflictUuid: string): Promise<ScheduleConflict> {
    return apiClient.post<ScheduleConflict>(
      `/tours/${tourUuid}/conflicts/${conflictUuid}/resolve/`,
      undefined,
      { fallback: 'Error al resolver el conflicto' }
    )
  }

  return { listConflicts, resolveConflict }
}
