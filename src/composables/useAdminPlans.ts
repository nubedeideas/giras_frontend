import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'
import type { PlanCode } from './useAdminSubscriptions'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

export interface Plan {
  uuid: string
  code: PlanCode
  name: string
  description: string
  notification_limit: number
  max_shows: number
  price: string
  currency: string
  features: Record<string, unknown>
  is_active: boolean
  is_default: boolean
  display_order: number
  is_unlimited_notifications: boolean
  is_unlimited_shows: boolean
  created_at: string
  updated_at: string
}

export interface UpdatePlanPayload {
  name?: string
  description?: string
  notification_limit?: number
  max_shows?: number
  price?: string
  currency?: string
  features?: Record<string, unknown>
  is_active?: boolean
  is_default?: boolean
  display_order?: number
}

export interface CreatePlanPayload extends UpdatePlanPayload {
  code: PlanCode
  name: string
}

export interface PlanFilters {
  code?: PlanCode
  is_active?: boolean
  search?: string
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return q.toString()
}

export function useAdminPlans() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function list(query: string | PlanFilters = {}): Promise<Paginated<Plan>> {
    const url =
      typeof query === 'string'
        ? query
        : `${API_BASE}/admin/plans/?${buildQuery({ page_size: 20, ...query })}`
    const res = await auth().fetchWithAuth(url)
    if (!res.ok) throw new Error('Error al cargar los planes')
    return res.json()
  }

  async function create(payload: CreatePlanPayload): Promise<Plan> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/plans/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      throw new Error(String(Array.isArray(first) ? first[0] : (data.detail ?? 'Error al crear el plan')))
    }
    return data
  }

  async function update(uuid: string, payload: UpdatePlanPayload): Promise<Plan> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/plans/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      throw new Error(String(Array.isArray(first) ? first[0] : (data.detail ?? 'Error al actualizar el plan')))
    }
    return data
  }

  async function remove(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/plans/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar el plan')
    }
  }

  return { list, create, update, remove }
}
