import { apiClient } from '@/utils/apiClient'
import { toArray } from '@/utils/pagination'
import type { Paginated } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactRole {
  uuid: string
  name: string
  slug: string
  description: string
  icon: string
  color: string
  is_system: boolean
  is_active: boolean
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface CreateRolePayload {
  name: string
  color: string
  description?: string
  icon?: string
}

export interface UpdateRolePayload {
  name?: string
  color?: string
  description?: string
  icon?: string
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useContactRoles() {
  async function listRoles(): Promise<ContactRole[]> {
    const data = await apiClient.get<Paginated<ContactRole> | ContactRole[]>('/contacts/roles/', {
      fallback: 'Error al cargar roles',
    })
    return toArray(data)
  }

  function createRole(payload: CreateRolePayload): Promise<ContactRole> {
    return apiClient.post<ContactRole>('/contacts/roles/', payload, {
      fallback: 'Error al crear rol',
    })
  }

  function updateRole(uuid: string, payload: UpdateRolePayload): Promise<ContactRole> {
    return apiClient.patch<ContactRole>(`/contacts/roles/${uuid}/`, payload, {
      fallback: 'Error al actualizar rol',
    })
  }

  function deleteRole(uuid: string): Promise<void> {
    return apiClient.delete(`/contacts/roles/${uuid}/`, { fallback: 'Error al eliminar rol' })
  }

  return { listRoles, createRole, updateRole, deleteRole }
}
