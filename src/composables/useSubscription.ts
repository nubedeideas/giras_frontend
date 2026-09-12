import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'
import type { PlanCode, SubscriptionStatus } from './useAdminSubscriptions'
import type { NotificationUsageEntry } from './useAdminNotificationUsage'
import type { PaymentListItem } from './useAdminPayments'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  function base(tourUuid: string) {
    return `${API_BASE}/tours/${tourUuid}/subscription`
  }

  async function get(tourUuid: string): Promise<ClientSubscription> {
    const res = await auth().fetchWithAuth(`${base(tourUuid)}/`)
    if (!res.ok) throw new Error('Error al cargar la suscripción')
    return res.json()
  }

  async function usage(tourUuid: string): Promise<SubscriptionUsage> {
    const res = await auth().fetchWithAuth(`${base(tourUuid)}/usage/`)
    if (!res.ok) throw new Error('Error al cargar el consumo')
    return res.json()
  }

  async function history(tourUuid: string): Promise<Paginated<NotificationUsageEntry> | NotificationUsageEntry[]> {
    const res = await auth().fetchWithAuth(`${base(tourUuid)}/history/`)
    if (!res.ok) throw new Error('Error al cargar el historial')
    return res.json()
  }

  async function payments(tourUuid: string): Promise<Paginated<PaymentListItem> | PaymentListItem[]> {
    const res = await auth().fetchWithAuth(`${base(tourUuid)}/payments/`)
    if (!res.ok) throw new Error('Error al cargar los pagos')
    return res.json()
  }

  async function changePlan(tourUuid: string, planCode: PlanCode): Promise<ChangePlanResult> {
    const res = await auth().fetchWithAuth(`${base(tourUuid)}/change-plan/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ plan_code: planCode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al cambiar el plan')
    return data
  }

  async function cancel(tourUuid: string, reason?: string): Promise<ClientSubscription> {
    const res = await auth().fetchWithAuth(`${base(tourUuid)}/cancel/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(reason ? { reason } : {}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al cancelar')
    return data
  }

  return { get, usage, history, payments, changePlan, cancel }
}
