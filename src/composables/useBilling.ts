import { apiClient } from '@/utils/apiClient'
import type { Paginated } from '@/types'
import type { PlanCode } from './useAdminSubscriptions'
import type { PaymentListItem } from './useAdminPayments'

/** GET /api/subscriptions/plans/ — public catalog */
export interface PublicPlan {
  uuid: string
  code: PlanCode
  name: string
  description: string
  notification_limit: number
  max_shows: number
  price: string
  currency: string
  is_unlimited_notifications: boolean
  is_unlimited_shows: boolean
}

export function useBilling() {
  /** GET /api/subscriptions/my-billing/ — all of the current user's payments, across every tour */
  function myBilling(): Promise<Paginated<PaymentListItem> | PaymentListItem[]> {
    return apiClient.get('/subscriptions/my-billing/', {
      fallback: 'Error al cargar la facturación',
    })
  }

  function listPlans(): Promise<Paginated<PublicPlan> | PublicPlan[]> {
    return apiClient.get('/subscriptions/plans/', { fallback: 'Error al cargar los planes' })
  }

  return { myBilling, listPlans }
}
