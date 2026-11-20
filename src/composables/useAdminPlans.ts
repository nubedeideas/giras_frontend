import { apiClient, buildQuery } from '@/utils/apiClient'
import type { Paginated } from '@/types'
import type { PlanCode } from './useAdminSubscriptions'

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

export function useAdminPlans() {
  function list(query: string | PlanFilters = {}): Promise<Paginated<Plan>> {
    const url =
      typeof query === 'string'
        ? query
        : `/admin/plans/?${buildQuery({ page_size: 20, ...query })}`
    return apiClient.get<Paginated<Plan>>(url, {
      fallback: 'Error al cargar los planes',
    })
  }

  function create(payload: CreatePlanPayload): Promise<Plan> {
    return apiClient.post<Plan>('/admin/plans/', payload, { fallback: 'Error al crear el plan' })
  }

  function update(uuid: string, payload: UpdatePlanPayload): Promise<Plan> {
    return apiClient.patch<Plan>(`/admin/plans/${uuid}/`, payload, {
      fallback: 'Error al actualizar el plan',
    })
  }

  function remove(uuid: string): Promise<void> {
    return apiClient.delete(`/admin/plans/${uuid}/`, { fallback: 'Error al eliminar el plan' })
  }

  return { list, create, update, remove }
}
