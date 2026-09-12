import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'
import type { PlanCode } from './useAdminSubscriptions'
import type { PaymentListItem } from './useAdminPayments'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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
  function auth() {
    return useAuthStore()
  }

  /** GET /api/subscriptions/my-billing/ — all of the current user's payments, across every tour */
  async function myBilling(): Promise<Paginated<PaymentListItem> | PaymentListItem[]> {
    const res = await auth().fetchWithAuth(`${API_BASE}/subscriptions/my-billing/`)
    if (!res.ok) throw new Error('Error al cargar la facturación')
    return res.json()
  }

  async function listPlans(): Promise<Paginated<PublicPlan> | PublicPlan[]> {
    const res = await auth().fetchWithAuth(`${API_BASE}/subscriptions/plans/`)
    if (!res.ok) throw new Error('Error al cargar los planes')
    return res.json()
  }

  return { myBilling, listPlans }
}
