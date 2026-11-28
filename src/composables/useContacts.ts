import { apiClient } from '@/utils/apiClient'
import type { Contact } from '@/types'

export function useContacts() {
  function listContacts(params: Record<string, string> = {}): Promise<Contact[]> {
    const qs = new URLSearchParams({ page_size: '100', ...params }).toString()
    return apiClient.getAll<Contact>(`/contacts/?${qs}`, { fallback: 'Error al cargar contactos' })
  }

  function getContact(uuid: string): Promise<Contact> {
    return apiClient.get<Contact>(`/contacts/${uuid}/`, { fallback: 'Error al cargar contacto' })
  }

  function createContact(payload: Partial<Contact>): Promise<Contact> {
    return apiClient.post<Contact>('/contacts/', payload, { fallback: 'Error al crear contacto' })
  }

  function updateContact(uuid: string, payload: Partial<Contact>): Promise<Contact> {
    return apiClient.patch<Contact>(`/contacts/${uuid}/`, payload, {
      fallback: 'Error al actualizar contacto',
      allFieldErrors: true,
    })
  }

  function deleteContact(uuid: string): Promise<void> {
    return apiClient.delete(`/contacts/${uuid}/`, { fallback: 'Error al eliminar contacto' })
  }

  // Contacts are global by default (not tied to any tour) until explicitly
  // linked — this is that link. Needed after creating/confirming a contact
  // while a tour is active, or it silently won't show up in that tour's
  // filtered list (GET /api/contacts/?tour=<uuid>).
  // POST /api/contacts/{uuid}/add_to_tour/ → {message, created, added_to_team}. `add_to_team` se
  // omite (default true: si quien llama es admin, el contacto entra en el Equipo de la gira).
  // El contacto tiene que estar confirmado: con Google, el PATCH `is_confirmed` va antes.
  async function addToTour(
    uuid: string,
    tourUuid: string,
    opts: { roleUuid?: string } = {}
  ): Promise<void> {
    const body: { tour_uuid: string; role_uuid?: string } = { tour_uuid: tourUuid }
    if (opts.roleUuid) body.role_uuid = opts.roleUuid
    await apiClient.post(`/contacts/${uuid}/add_to_tour/`, body, {
      fallback: 'Error al asociar el contacto con la gira',
    })
  }

  return { listContacts, getContact, createContact, updateContact, deleteContact, addToTour }
}
