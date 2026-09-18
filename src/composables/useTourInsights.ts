import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubscriptionUsageSummary {
  [key: string]: unknown
}

export interface TourInsights {
  tour_uuid: string
  tour_name: string
  subscription: SubscriptionUsageSummary
  members_count: number
  shows_count: number
  events_count: number
  activities_count: number
  activities_by_status: Record<string, number>
  schedule_conflicts_active: number
  wallet_passes_count: number
  wallet_passes_by_status: Record<string, number>
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useTourInsights() {
  function auth() {
    return useAuthStore()
  }

  async function getInsights(tourUuid: string): Promise<TourInsights> {
    const res = await auth().fetchWithAuth(`${API_BASE}/tours/${tourUuid}/insights/`)
    if (!res.ok) throw new Error('Error al cargar los insights de la gira')
    return res.json()
  }

  return { getInsights }
}
