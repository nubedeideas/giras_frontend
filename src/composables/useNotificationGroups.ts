import { useAuthStore } from '@/stores/auth'
import type { ContactListItem } from './useNotifications'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape from GET /api/notifications/groups/ (list, resumido) */
export interface NotificationGroupListItem {
  uuid: string
  name: string
  tour: string | null
  tour_name: string | null
  contact_count: number
}

/** Shape from GET/POST/PATCH /api/notifications/groups/{uuid}/ (detalle) */
export interface NotificationGroup {
  uuid: string
  name: string
  description: string
  tour: string | null
  tour_name: string | null
  contacts: ContactListItem[]
  contact_count: number
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface CreateGroupPayload {
  name: string
  description?: string
  tour?: string | null
  contact_uuids?: string[]
}

export interface UpdateGroupPayload {
  name?: string
  description?: string
  tour?: string | null
}

export interface ContactsMutationResult {
  added: string[]
  skipped: string[]
  not_found: string[]
  total_contacts: number
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useNotificationGroups() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function listGroups(tourUuid?: string): Promise<NotificationGroupListItem[]> {
    const qs = new URLSearchParams({ page_size: '100' })
    if (tourUuid) qs.set('tour', tourUuid)
    const all: NotificationGroupListItem[] = []
    let url: string | null = `${API_BASE}/notifications/groups/?${qs}`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar grupos de notificación')
      const data = await res.json()
      all.push(...(data.results ?? data))
      url = data.next ?? null
    }
    return all
  }

  async function getGroup(uuid: string): Promise<NotificationGroup> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/groups/${uuid}/`)
    if (!res.ok) throw new Error('Error al cargar grupo')
    return res.json()
  }

  async function createGroup(payload: CreateGroupPayload): Promise<NotificationGroup> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/groups/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.name?.[0] ?? data.detail ?? 'Error al crear grupo')
    return data
  }

  async function updateGroup(uuid: string, payload: UpdateGroupPayload): Promise<NotificationGroup> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/groups/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.name?.[0] ?? data.detail ?? 'Error al actualizar grupo')
    return data
  }

  async function deleteGroup(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/notifications/groups/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar grupo')
    }
  }

  async function addContacts(uuid: string, contactUuids: string[]): Promise<ContactsMutationResult> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/groups/${uuid}/contacts/add/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ contact_uuids: contactUuids }) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al agregar contactos al grupo')
    return data
  }

  async function removeContacts(uuid: string, contactUuids: string[]): Promise<{ total_contacts: number }> {
    const res = await auth().fetchWithAuth(
      `${API_BASE}/notifications/groups/${uuid}/contacts/remove/`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ contact_uuids: contactUuids }) },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Error al quitar contactos del grupo')
    return data
  }

  return { listGroups, getGroup, createGroup, updateGroup, deleteGroup, addContacts, removeContacts }
}
