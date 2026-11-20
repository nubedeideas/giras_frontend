import { apiClient, buildQuery } from '@/utils/apiClient'
import type { Paginated } from '@/types'

export type PlanCode = 'free' | 'starter' | 'premium' | 'custom'
export type SubscriptionStatus = 'pending' | 'active' | 'cancelled'

export interface SubscriptionPlanRef {
  uuid: string
  code: PlanCode
  name: string
  notification_limit: number
  max_shows: number
  price: string
  currency: string
}

export interface Subscription {
  uuid: string
  tour: string
  tour_name: string
  user: string
  user_email: string
  user_full_name: string
  plan: SubscriptionPlanRef
  status: SubscriptionStatus
  notifications_used: number
  remaining_notifications: number // -1 = ilimitado
  usage_percentage: number
  shows_used: number
  shows_limit: number
  is_active: boolean
  payments_count: number
  total_paid: string
  custom_pool: string | null
  allocated_notifications: number | null
  allocated_shows: number | null
}

export interface SubscriptionStats {
  total_tours: number
  active_subscriptions: number
  subscriptions_by_plan: Record<PlanCode, number>
  subscriptions_by_status: Record<SubscriptionStatus, number>
  total_notifications_sent: number
  total_revenue: string
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus
  plan__code?: PlanCode
  search?: string
}

export interface AllocatePayload {
  custom_pool: string
  allocated_notifications: number
  allocated_shows: number
}

export function useAdminSubscriptions() {
  function list(query: string | SubscriptionFilters = {}): Promise<Paginated<Subscription>> {
    const url =
      typeof query === 'string'
        ? query
        : `/admin/subscriptions/?${buildQuery({ page_size: 20, ...query })}`
    return apiClient.get<Paginated<Subscription>>(url, {
      fallback: 'Error al cargar suscripciones',
    })
  }

  function get(uuid: string): Promise<Subscription> {
    return apiClient.get<Subscription>(`/admin/subscriptions/${uuid}/`, {
      fallback: 'Error al cargar suscripción',
    })
  }

  function stats(): Promise<SubscriptionStats> {
    return apiClient.get<SubscriptionStats>('/admin/subscriptions/stats/', {
      fallback: 'Error al cargar estadísticas',
    })
  }

  function changePlan(uuid: string, planCode: PlanCode): Promise<Subscription> {
    return apiClient.post<Subscription>(
      `/admin/subscriptions/${uuid}/change-plan/`,
      { plan_code: planCode },
      { fallback: 'Error al cambiar el plan' }
    )
  }

  function activate(uuid: string): Promise<Subscription> {
    return apiClient.post<Subscription>(`/admin/subscriptions/${uuid}/activate/`, undefined, {
      fallback: 'Error al activar',
    })
  }

  function cancel(uuid: string, reason?: string): Promise<Subscription> {
    return apiClient.post<Subscription>(
      `/admin/subscriptions/${uuid}/cancel/`,
      reason ? { reason } : {},
      { fallback: 'Error al cancelar' }
    )
  }

  function allocate(uuid: string, payload: AllocatePayload): Promise<Subscription> {
    return apiClient.post<Subscription>(`/admin/subscriptions/${uuid}/allocate/`, payload, {
      fallback: 'Error al asignar cupo',
    })
  }

  return { list, get, stats, changePlan, activate, cancel, allocate }
}
