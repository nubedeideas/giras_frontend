import { useAuthStore } from '@/stores/auth'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TourDocumentType = 'rider' | 'visa' | 'insurance' | 'contract' | 'other'

export interface TourDocument {
  uuid: string
  file: string
  description: string
  document_type: TourDocumentType
  document_type_display: string
  uploaded_by_name: string
  file_size: number
  created_at: string
}

export interface UploadDocumentPayload {
  file: File
  description?: string
  document_type?: TourDocumentType
}

// Client-side pre-check mirroring the backend's format/size validation
// (PDF ≤15MB, Excel ≤20MB, image ≤5MB) — avoids a round trip for the common
// mistake, the server is still the source of truth (it also checks magic bytes).
const ALLOWED_EXTENSIONS: Record<string, number> = {
  pdf: 15 * 1024 * 1024,
  xlsx: 20 * 1024 * 1024,
  xls: 20 * 1024 * 1024,
  jpg: 5 * 1024 * 1024,
  jpeg: 5 * 1024 * 1024,
  png: 5 * 1024 * 1024,
  gif: 5 * 1024 * 1024,
  webp: 5 * 1024 * 1024,
}

export function validateDocumentFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const maxSize = ALLOWED_EXTENSIONS[ext]
  if (!maxSize) return 'Formato no permitido. Usa PDF, Excel (.xlsx/.xls) o imagen (jpg/png/gif/webp).'
  if (file.size > maxSize) return `El archivo supera el tamaño máximo permitido (${Math.round(maxSize / (1024 * 1024))}MB).`
  return null
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useTourDocuments() {
  function auth() {
    return useAuthStore()
  }

  async function listDocuments(tourUuid: string): Promise<TourDocument[]> {
    const all: TourDocument[] = []
    let url: string | null = `${API_BASE}/tours/${tourUuid}/documents/?page_size=100`
    while (url) {
      const res = await auth().fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al cargar documentos')
      const data = await res.json()
      all.push(...(data.results ?? data))
      url = data.next ?? null
    }
    return all
  }

  async function uploadDocument(tourUuid: string, payload: UploadDocumentPayload): Promise<TourDocument> {
    const form = new FormData()
    form.append('file', payload.file)
    if (payload.description) form.append('description', payload.description)
    if (payload.document_type) form.append('document_type', payload.document_type)

    const res = await auth().fetchWithAuth(`${API_BASE}/tours/${tourUuid}/documents/`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json()
    if (!res.ok) {
      const first = Object.values(data)[0]
      const msg = Array.isArray(first) ? first[0] : data.detail ?? 'Error al subir el documento'
      throw new Error(String(msg))
    }
    return data
  }

  async function downloadDocument(tourUuid: string, docUuid: string, filename: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/tours/${tourUuid}/documents/${docUuid}/`)
    if (!res.ok) throw new Error('Error al descargar el documento')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  async function deleteDocument(tourUuid: string, docUuid: string): Promise<void> {
    const res = await auth().fetchWithAuth(`${API_BASE}/tours/${tourUuid}/documents/${docUuid}/`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al eliminar el documento')
    }
  }

  return { listDocuments, uploadDocument, downloadDocument, deleteDocument }
}
