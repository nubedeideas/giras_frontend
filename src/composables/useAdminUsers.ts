import { apiClient } from '@/utils/apiClient'
import type { Paginated } from '@/types'

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
  async function search(query: string): Promise<UserSearchResult[]> {
    if (!query.trim()) return []
    const data = await apiClient.get<Paginated<UserSearchResult>>(
      `/users/?search=${encodeURIComponent(query.trim())}&page_size=10`,
      { fallback: 'Error al buscar usuarios' }
    )
    return data.results
  }

  return { search }
}
