import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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
  function auth() {
    return useAuthStore()
  }

  async function listConflicts(tourUuid: string): Promise<ScheduleConflict[]> {
    const all: ScheduleConflict[] = []
    let url: string | null = `${API_BASE}/tours/${tourUuid}/conflicts/?page_size=100`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar conflictos de agenda')
      const data = await res.json()
      all.push(...(data.results ?? data))
      url = data.next ?? null
    }
    return all
  }

  async function resolveConflict(tourUuid: string, conflictUuid: string): Promise<ScheduleConflict> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/tours/${tourUuid}/conflicts/${conflictUuid}/resolve/`,
      { method: 'POST' },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al resolver el conflicto')
    return data
  }

  return { listConflicts, resolveConflict }
}
