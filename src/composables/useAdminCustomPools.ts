import { apiClient, buildQuery } from '@/utils/apiClient'
import type { Paginated } from '@/types'

export interface CustomPool {
  uuid: string
  user: string
  user_email: string
  total_notifications: number
  total_shows: number
  allocated_notifications: number
  allocated_shows: number
  remaining_notifications: number
  remaining_shows: number
  is_active: boolean
  notes: string
}

export interface CreateCustomPoolPayload {
  user: string
  total_notifications: number
  total_shows: number
  notes?: string
}

export interface CustomPoolFilters {
  search?: string
}

export function useAdminCustomPools() {
  function list(query: string | CustomPoolFilters = {}): Promise<Paginated<CustomPool>> {
    const url =
      typeof query === 'string'
        ? query
        : `/admin/custom-pools/?${buildQuery({ page_size: 20, ...query })}`
    return apiClient.get<Paginated<CustomPool>>(url, {
      fallback: 'Error al cargar los cupos Custom',
    })
  }

  function create(payload: CreateCustomPoolPayload): Promise<CustomPool> {
    return apiClient.post<CustomPool>('/admin/custom-pools/', payload, {
      fallback: 'Error al crear el cupo',
    })
  }

  function update(uuid: string, payload: Partial<CreateCustomPoolPayload>): Promise<CustomPool> {
    return apiClient.patch<CustomPool>(`/admin/custom-pools/${uuid}/`, payload, {
      fallback: 'Error al actualizar el cupo',
    })
  }

  function remove(uuid: string): Promise<void> {
    return apiClient.delete(`/admin/custom-pools/${uuid}/`, {
      fallback: 'Error al eliminar el cupo',
    })
  }

  return { list, create, update, remove }
}
