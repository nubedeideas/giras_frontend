import { apiClient } from '@/utils/apiClient'

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
  function listDocuments(tourUuid: string): Promise<TourDocument[]> {
    return apiClient.getAll<TourDocument>(`/tours/${tourUuid}/documents/?page_size=100`, {
      fallback: 'Error al cargar documentos',
    })
  }

  function uploadDocument(tourUuid: string, payload: UploadDocumentPayload): Promise<TourDocument> {
    const form = new FormData()
    form.append('file', payload.file)
    if (payload.description) form.append('description', payload.description)
    if (payload.document_type) form.append('document_type', payload.document_type)
    return apiClient.post<TourDocument>(`/tours/${tourUuid}/documents/`, form, {
      fallback: 'Error al subir el documento',
    })
  }

  async function downloadDocument(
    tourUuid: string,
    docUuid: string,
    filename: string
  ): Promise<void> {
    const blob = await apiClient.get<Blob>(`/tours/${tourUuid}/documents/${docUuid}/`, {
      fallback: 'Error al descargar el documento',
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  function deleteDocument(tourUuid: string, docUuid: string): Promise<void> {
    return apiClient.delete(`/tours/${tourUuid}/documents/${docUuid}/`, {
      fallback: 'Error al eliminar el documento',
    })
  }

  return { listDocuments, uploadDocument, downloadDocument, deleteDocument }
}
