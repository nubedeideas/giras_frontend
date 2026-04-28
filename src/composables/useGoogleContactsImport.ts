import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

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
  function auth() { return useAuthStore() }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  // ── Subscription management ──────────────────────────────────────────────────

  async function getSubscription(): Promise<ContactSubscription | null> {
    const res = await auth().fetchWithAuth(`${API_BASE}/integrations/contacts/`)
    if (!res.ok) return null
    const data = await res.json()
    const list: ContactSubscription[] = data.results ?? data
    return list.length > 0 ? list[0] : null
  }

  async function createSubscription(): Promise<ContactSubscription> {
    const res = await auth().fetchWithAuth(`${API_BASE}/integrations/contacts/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ sync_enabled: true }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? err.error ?? 'Error al crear suscripción de contactos')
    }
    return res.json()
  }

  async function getOrCreateSubscription(): Promise<ContactSubscription> {
    const existing = await getSubscription()
    if (existing) return existing
    return createSubscription()
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────

  async function syncNow(subId: number): Promise<SyncStats> {
    const res = await auth().fetchWithAuth(`${API_BASE}/integrations/contacts/${subId}/sync_now/`, {
      method: 'POST',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Error durante la sincronización')
    }
    return res.json()
  }

  // ── Contacts ─────────────────────────────────────────────────────────────────

  async function fetchGoogleContacts(): Promise<ImportContact[]> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/google-contacts/`)
    if (!res.ok) throw new Error('Error al cargar contactos')
    const data = await res.json()
    return data.results ?? data
  }

  // ── Roles ─────────────────────────────────────────────────────────────────────

  async function fetchRoles(): Promise<ImportRole[]> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/roles/`)
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
  }

  // ── Create contact ────────────────────────────────────────────────────────────

  async function createContact(payload: Record<string, unknown>): Promise<ImportContact> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      const msg = Array.isArray(first) ? first[0] : data.detail ?? 'Error al crear contacto'
      throw new Error(String(msg))
    }
    return data
  }

  // ── Role assignment ───────────────────────────────────────────────────────────

  async function patchContactRole(uuid: string, roleUuid: string | null): Promise<void> {
    const payload: Record<string, unknown> = { is_confirmed: true }
    if (roleUuid) payload.role_id = roleUuid
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Error actualizando contacto ${uuid}`)
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
