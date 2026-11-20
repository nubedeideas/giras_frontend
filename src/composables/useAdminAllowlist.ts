import { apiClient, buildQuery } from '@/utils/apiClient'
import type { Paginated } from '@/types'

export type AllowlistStatus = 'pending' | 'approved' | 'revoked'

export interface AllowedEmail {
  uuid: string
  email: string
  status: AllowlistStatus
  invited_by_email: string | null
  notes: string
  approved_at: string | null
  created_at: string
}

export interface CreateAllowedEmailPayload {
  email: string
  notes?: string
}

export interface AllowlistFilters {
  status?: AllowlistStatus
  search?: string
}

export function useAdminAllowlist() {
  function list(query: string | AllowlistFilters = {}): Promise<Paginated<AllowedEmail>> {
    const url =
      typeof query === 'string'
        ? query
        : `/admin/allowed-emails/?${buildQuery({ page_size: 20, ...query })}`
    return apiClient.get<Paginated<AllowedEmail>>(url, {
      fallback: 'Error al cargar la lista de acceso',
    })
  }

  function create(payload: CreateAllowedEmailPayload): Promise<AllowedEmail> {
    return apiClient.post<AllowedEmail>('/admin/allowed-emails/', payload, {
      fallback: 'Error al invitar el email',
    })
  }

  function update(
    uuid: string,
    payload: Partial<CreateAllowedEmailPayload>
  ): Promise<AllowedEmail> {
    return apiClient.patch<AllowedEmail>(`/admin/allowed-emails/${uuid}/`, payload, {
      fallback: 'Error al actualizar',
    })
  }

  function remove(uuid: string): Promise<void> {
    return apiClient.delete(`/admin/allowed-emails/${uuid}/`, { fallback: 'Error al eliminar' })
  }

  function revoke(uuid: string): Promise<AllowedEmail> {
    return apiClient.post<AllowedEmail>(`/admin/allowed-emails/${uuid}/revoke/`, undefined, {
      fallback: 'Error al revocar acceso',
    })
  }

  function approve(uuid: string): Promise<AllowedEmail> {
    return apiClient.post<AllowedEmail>(`/admin/allowed-emails/${uuid}/approve/`, undefined, {
      fallback: 'Error al aprobar acceso',
    })
  }

  return { list, create, update, remove, revoke, approve }
}
