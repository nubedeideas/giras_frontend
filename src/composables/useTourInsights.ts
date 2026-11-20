import { apiClient } from '@/utils/apiClient'

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
  function getInsights(tourUuid: string): Promise<TourInsights> {
    return apiClient.get<TourInsights>(`/tours/${tourUuid}/insights/`, {
      fallback: 'Error al cargar los insights de la gira',
    })
  }

  return { getInsights }
}
