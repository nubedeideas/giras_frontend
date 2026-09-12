import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return q.toString()
}

export function useAdminCustomPools() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function list(query: string | CustomPoolFilters = {}): Promise<Paginated<CustomPool>> {
    const url =
      typeof query === 'string'
        ? query
        : `${API_BASE}/admin/custom-pools/?${buildQuery({ page_size: 20, ...query })}`
    const res = await auth().fetchWithAuth(url)
    if (!res.ok) throw new Error('Error al cargar los cupos Custom')
    return res.json()
  }

  async function create(payload: CreateCustomPoolPayload): Promise<CustomPool> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/custom-pools/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      throw new Error(String(Array.isArray(first) ? first[0] : (data.detail ?? 'Error al crear el cupo')))
    }
    return data
  }

  async function update(uuid: string, payload: Partial<CreateCustomPoolPayload>): Promise<CustomPool> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/custom-pools/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al actualizar el cupo')
    return data
  }

  async function remove(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/custom-pools/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar el cupo')
    }
  }

  return { list, create, update, remove }
}
