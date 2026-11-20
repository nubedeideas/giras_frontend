import { apiClient, buildQuery } from '@/utils/apiClient'
import type { Paginated } from '@/types'
import type { PlanCode } from './useAdminSubscriptions'

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

export function useAdminNotificationUsage() {
  function list(
    query: string | NotificationUsageFilters = {}
  ): Promise<Paginated<NotificationUsageEntry>> {
    const url =
      typeof query === 'string'
        ? query
        : `/admin/notification-usage/?${buildQuery({ page_size: 20, ...query })}`
    return apiClient.get<Paginated<NotificationUsageEntry>>(url, {
      fallback: 'Error al cargar el log de uso',
    })
  }

  return { list }
}
