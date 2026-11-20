import { apiClient } from '@/utils/apiClient'
import type { Paginated } from '@/types'
import type { PlanCode, SubscriptionStatus } from './useAdminSubscriptions'
import type { NotificationUsageEntry } from './useAdminNotificationUsage'
import type { PaymentListItem } from './useAdminPayments'

export interface SubscriptionPlanRef {
  uuid: string
  code: PlanCode
  name: string
  notification_limit: number
  max_shows: number
  price: string
  currency: string
}

/** GET /api/tours/{tour}/subscription/ */
export interface ClientSubscription {
  uuid: string
  status: SubscriptionStatus
  plan: SubscriptionPlanRef
  notifications_used: number
  remaining_notifications: number
  usage_percentage: number
  shows_used: number
  shows_limit: number
  is_active: boolean
}

/** GET /api/tours/{tour}/subscription/usage/ */
export interface SubscriptionUsage {
  plan_code: PlanCode
  plan_name: string
  notifications_used: number
  notification_limit: number
  remaining: number
  usage_percentage: number
  is_unlimited: boolean
  shows_used: number
  shows_limit: number
  is_active: boolean
}

export type ChangePlanResult =
  | { status: 'no_change' }
  | { status: 'admin_setup_required' }
  | { status: 'payment_required'; payment_url: string; subscription: ClientSubscription }
  | { status: 'success' }

export function useSubscription() {
  function base(tourUuid: string) {
    return `/tours/${tourUuid}/subscription`
  }

  function get(tourUuid: string): Promise<ClientSubscription> {
    return apiClient.get<ClientSubscription>(`${base(tourUuid)}/`, {
      fallback: 'Error al cargar la suscripción',
    })
  }

  function usage(tourUuid: string): Promise<SubscriptionUsage> {
    return apiClient.get<SubscriptionUsage>(`${base(tourUuid)}/usage/`, {
      fallback: 'Error al cargar el consumo',
    })
  }

  function history(
    tourUuid: string
  ): Promise<Paginated<NotificationUsageEntry> | NotificationUsageEntry[]> {
    return apiClient.get(`${base(tourUuid)}/history/`, { fallback: 'Error al cargar el historial' })
  }

  function payments(tourUuid: string): Promise<Paginated<PaymentListItem> | PaymentListItem[]> {
    return apiClient.get(`${base(tourUuid)}/payments/`, { fallback: 'Error al cargar los pagos' })
  }

  function changePlan(tourUuid: string, planCode: PlanCode): Promise<ChangePlanResult> {
    return apiClient.post<ChangePlanResult>(
      `${base(tourUuid)}/change-plan/`,
      { plan_code: planCode },
      { fallback: 'Error al cambiar el plan' }
    )
  }

  function cancel(tourUuid: string, reason?: string): Promise<ClientSubscription> {
    return apiClient.post<ClientSubscription>(
      `${base(tourUuid)}/cancel/`,
      reason ? { reason } : {},
      { fallback: 'Error al cancelar' }
    )
  }

  return { get, usage, history, payments, changePlan, cancel }
}
