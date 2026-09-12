import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return q.toString()
}

export function useAdminAllowlist() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function list(query: string | AllowlistFilters = {}): Promise<Paginated<AllowedEmail>> {
    const url =
      typeof query === 'string'
        ? query
        : `${API_BASE}/admin/allowed-emails/?${buildQuery({ page_size: 20, ...query })}`
    const res = await auth().fetchWithAuth(url)
    if (!res.ok) throw new Error('Error al cargar la lista de acceso')
    return res.json()
  }

  async function create(payload: CreateAllowedEmailPayload): Promise<AllowedEmail> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/allowed-emails/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      throw new Error(String(Array.isArray(first) ? first[0] : (data.detail ?? 'Error al invitar el email')))
    }
    return data
  }

  async function update(uuid: string, payload: Partial<CreateAllowedEmailPayload>): Promise<AllowedEmail> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/allowed-emails/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al actualizar')
    return data
  }

  async function remove(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/allowed-emails/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar')
    }
  }

  async function revoke(uuid: string): Promise<AllowedEmail> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/allowed-emails/${uuid}/revoke/`, {
      method: 'POST',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al revocar acceso')
    return data
  }

  async function approve(uuid: string): Promise<AllowedEmail> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/allowed-emails/${uuid}/approve/`, {
      method: 'POST',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al aprobar acceso')
    return data
  }

  return { list, create, update, remove, revoke, approve }
}
