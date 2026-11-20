import { apiClient } from '@/utils/apiClient'
import type { ContactListItem } from './useNotifications'

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
  function listGroups(tourUuid?: string): Promise<NotificationGroupListItem[]> {
    const qs = new URLSearchParams({ page_size: '100' })
    if (tourUuid) qs.set('tour', tourUuid)
    return apiClient.getAll<NotificationGroupListItem>(`/notifications/groups/?${qs}`, {
      fallback: 'Error al cargar grupos de notificación',
    })
  }

  function getGroup(uuid: string): Promise<NotificationGroup> {
    return apiClient.get<NotificationGroup>(`/notifications/groups/${uuid}/`, {
      fallback: 'Error al cargar grupo',
    })
  }

  function createGroup(payload: CreateGroupPayload): Promise<NotificationGroup> {
    return apiClient.post<NotificationGroup>('/notifications/groups/', payload, {
      fallback: 'Error al crear grupo',
    })
  }

  function updateGroup(uuid: string, payload: UpdateGroupPayload): Promise<NotificationGroup> {
    return apiClient.patch<NotificationGroup>(`/notifications/groups/${uuid}/`, payload, {
      fallback: 'Error al actualizar grupo',
    })
  }

  function deleteGroup(uuid: string): Promise<void> {
    return apiClient.delete(`/notifications/groups/${uuid}/`, {
      fallback: 'Error al eliminar grupo',
    })
  }

  function addContacts(uuid: string, contactUuids: string[]): Promise<ContactsMutationResult> {
    return apiClient.post<ContactsMutationResult>(
      `/notifications/groups/${uuid}/contacts/add/`,
      { contact_uuids: contactUuids },
      { fallback: 'Error al añadir contactos al grupo' }
    )
  }

  function removeContacts(
    uuid: string,
    contactUuids: string[]
  ): Promise<{ total_contacts: number }> {
    return apiClient.post<{ total_contacts: number }>(
      `/notifications/groups/${uuid}/contacts/remove/`,
      { contact_uuids: contactUuids },
      { fallback: 'Error al quitar contactos del grupo' }
    )
  }

  return {
    listGroups,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    addContacts,
    removeContacts,
  }
}
