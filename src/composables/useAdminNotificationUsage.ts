import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'
import type { PlanCode } from './useAdminSubscriptions'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

export interface NotificationUsageEntry {
  uuid: string
  recipients_count: number
  plan_code: PlanCode
  channel: string
  notifications_used_before: number
  notifications_used_after: number
  notification_limit: number
  created_at: string
}

export interface NotificationUsageFilters {
  plan_code?: PlanCode
  search?: string
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return q.toString()
}

export function useAdminNotificationUsage() {
  function auth() {
    return useAuthStore()
  }

  async function list(
    query: string | NotificationUsageFilters = {},
  ): Promise<Paginated<NotificationUsageEntry>> {
    const url =
      typeof query === 'string'
        ? query
        : `${API_BASE}/admin/notification-usage/?${buildQuery({ page_size: 20, ...query })}`
    const res = await auth().fetchWithAuth(url)
    if (!res.ok) throw new Error('Error al cargar el log de uso')
    return res.json()
  }

  return { list }
}
