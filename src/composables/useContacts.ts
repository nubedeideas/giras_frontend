import { useAuthStore } from '@/stores/auth'
import type { Contact } from '@/types'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

export function useContacts() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function listContacts(params: Record<string, string> = {}): Promise<Contact[]> {
    const qs = new URLSearchParams({ page_size: '100', ...params }).toString()
    const all: Contact[] = []
    let url: string | null = `${API_BASE}/contacts/?${qs}`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar contactos')
      const data = await res.json()
      all.push(...(data.results ?? data))
      url = data.next ?? null
    }
    return all
  }

  async function getContact(uuid: string): Promise<Contact> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/${uuid}/`)
    if (!res.ok) throw new Error('Error al cargar contacto')
    return res.json()
  }

  async function createContact(payload: Partial<Contact>): Promise<Contact> {
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

  async function updateContact(uuid: string, payload: Partial<Contact>): Promise<Contact> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/${uuid}/`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      const lines: string[] = []
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        if (Array.isArray(val)) {
          val.forEach((v) => {
            if (typeof v === 'string') lines.push(key === 'non_field_errors' ? v : `${key}: ${v}`)
          })
        } else if (typeof val === 'string') {
          lines.push(key === 'detail' ? val : `${key}: ${val}`)
        } else if (val && typeof val === 'object') {
          lines.push(`${key}: ${JSON.stringify(val)}`)
        }
      }
      throw new Error(lines.join('\n') || 'Error al actualizar contacto')
    }
    return data
  }

  async function deleteContact(uuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/contacts/${uuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar contacto')
    }
  }

  return { listContacts, getContact, createContact, updateContact, deleteContact }
}
