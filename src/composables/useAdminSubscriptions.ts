import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return q.toString()
}

export function useAdminSubscriptions() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function list(query: string | SubscriptionFilters = {}): Promise<Paginated<Subscription>> {
    const url =
      typeof query === 'string'
        ? query
        : `${API_BASE}/admin/subscriptions/?${buildQuery({ page_size: 20, ...query })}`
    const res = await auth().fetchWithAuth(url)
    if (!res.ok) throw new Error('Error al cargar suscripciones')
    return res.json()
  }

  async function get(uuid: string): Promise<Subscription> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/subscriptions/${uuid}/`)
    if (!res.ok) throw new Error('Error al cargar suscripción')
    return res.json()
  }

  async function stats(): Promise<SubscriptionStats> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/subscriptions/stats/`)
    if (!res.ok) throw new Error('Error al cargar estadísticas')
    return res.json()
  }

  async function changePlan(uuid: string, planCode: PlanCode): Promise<Subscription> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/subscriptions/${uuid}/change-plan/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ plan_code: planCode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al cambiar el plan')
    return data
  }

  async function activate(uuid: string): Promise<Subscription> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/subscriptions/${uuid}/activate/`, {
      method: 'POST',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al activar')
    return data
  }

  async function cancel(uuid: string, reason?: string): Promise<Subscription> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/subscriptions/${uuid}/cancel/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(reason ? { reason } : {}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al cancelar')
    return data
  }

  async function allocate(uuid: string, payload: AllocatePayload): Promise<Subscription> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/subscriptions/${uuid}/allocate/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      throw new Error(String(Array.isArray(first) ? first[0] : (data.detail ?? 'Error al asignar cupo')))
    }
    return data
  }

  return { list, get, stats, changePlan, activate, cancel, allocate }
}
