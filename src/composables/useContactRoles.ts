import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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
  function auth() { return useAuthStore() }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function listRoles(): Promise<ContactRole[]> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/roles/`)
    if (!res.ok) throw new Error('Error al cargar roles')
    const data = await res.json()
    return data.results ?? data
  }

  async function createRole(payload: CreateRolePayload): Promise<ContactRole> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/roles/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.name?.[0] ?? data.detail ?? 'Error al crear rol')
    return data
  }

  async function updateRole(uuid: string, payload: UpdateRolePayload): Promise<ContactRole> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/roles/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.name?.[0] ?? data.detail ?? 'Error al actualizar rol')
    return data
  }

  async function deleteRole(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/roles/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Error al eliminar rol')
    }
  }

  return { listRoles, createRole, updateRole, deleteRole }
}
