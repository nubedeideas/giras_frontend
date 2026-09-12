import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

/** UserSerializer shape (subset) — GET /api/users/?search= only returns other users for staff/superuser */
export interface UserSearchResult {
  uuid: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  is_superuser: boolean
  is_staff: boolean
}

export function useAdminUsers() {
  function auth() {
    return useAuthStore()
  }

  async function search(query: string): Promise<UserSearchResult[]> {
    if (!query.trim()) return []
    const res = await auth().fetchWithAuth(
      `${API_BASE}/users/?search=${encodeURIComponent(query.trim())}&page_size=10`,
    )
    if (!res.ok) throw new Error('Error al buscar usuarios')
    const data: Paginated<UserSearchResult> = await res.json()
    return data.results
  }

  return { search }
}
