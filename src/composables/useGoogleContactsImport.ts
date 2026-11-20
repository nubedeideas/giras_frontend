import { apiClient } from '@/utils/apiClient'
import { toArray } from '@/utils/pagination'
import type { Paginated } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportRole {
  uuid: string
  name: string
  slug: string
  color: string
  is_system: boolean
}

export interface ImportContact {
  uuid: string
  full_name: string
  first_name: string
  last_name: string
  primary_email: string
  primary_phone: string
  company_name?: string
  job_title?: string
  source: string
  role?: ImportRole
  is_favorite: boolean
  is_emergency: boolean
  is_confirmed: boolean
}

export interface ContactSubscription {
  id: number
  sync_enabled: boolean
  last_synced_at: string | null
  error_count: number
  last_error: string
}

export interface SyncStats {
  created: number
  updated: number
  deleted: number
  skipped: number
  errors: string[]
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useGoogleContactsImport() {
  // ── Subscription management ──────────────────────────────────────────────────

  /** Devuelve `null` si no hay suscripción o si la consulta falla (se registra el error). */
  async function getSubscription(): Promise<ContactSubscription | null> {
    try {
      const data = await apiClient.get<Paginated<ContactSubscription> | ContactSubscription[]>(
        '/integrations/contacts/'
      )
      const list = toArray(data)
      return list.length > 0 ? list[0] : null
    } catch (e) {
      console.error('[useGoogleContactsImport] getSubscription', e)
      return null
    }
  }

  function createSubscription(): Promise<ContactSubscription> {
    return apiClient.post<ContactSubscription>(
      '/integrations/contacts/',
      { sync_enabled: true },
      { fallback: 'Error al crear suscripción de contactos' }
    )
  }

  async function getOrCreateSubscription(): Promise<ContactSubscription> {
    const existing = await getSubscription()
    if (existing) return existing
    return createSubscription()
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────

  function syncNow(subId: number): Promise<SyncStats> {
    return apiClient.post<SyncStats>(`/integrations/contacts/${subId}/sync_now/`, undefined, {
      fallback: 'Error durante la sincronización',
    })
  }

  // ── Contacts ─────────────────────────────────────────────────────────────────

  async function fetchGoogleContacts(): Promise<ImportContact[]> {
    const data = await apiClient.get<Paginated<ImportContact> | ImportContact[]>(
      '/contacts/google-contacts/',
      { fallback: 'Error al cargar contactos' }
    )
    return toArray(data)
  }

  // ── Roles ─────────────────────────────────────────────────────────────────────

  /** Devuelve `[]` si la consulta falla (se registra el error): los roles son opcionales aquí. */
  async function fetchRoles(): Promise<ImportRole[]> {
    try {
      const data = await apiClient.get<Paginated<ImportRole> | ImportRole[]>('/contacts/roles/')
      return toArray(data)
    } catch (e) {
      console.error('[useGoogleContactsImport] fetchRoles', e)
      return []
    }
  }

  // ── Create contact ────────────────────────────────────────────────────────────

  function createContact(payload: Record<string, unknown>): Promise<ImportContact> {
    return apiClient.post<ImportContact>('/contacts/', payload, {
      fallback: 'Error al crear contacto',
    })
  }

  // ── Role assignment ───────────────────────────────────────────────────────────

  async function patchContactRole(uuid: string, roleUuid: string | null): Promise<void> {
    const payload: Record<string, unknown> = { is_confirmed: true }
    if (roleUuid) payload.role_id = roleUuid
    await apiClient.patch(`/contacts/${uuid}/`, payload, {
      fallback: `Error actualizando contacto ${uuid}`,
    })
  }

  return {
    getSubscription,
    getOrCreateSubscription,
    syncNow,
    fetchGoogleContacts,
    fetchRoles,
    createContact,
    patchContactRole,
  }
}
