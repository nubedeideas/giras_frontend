import { ref } from 'vue'
import { apiClient, buildQuery } from '@/utils/apiClient'
import type { Paginated } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
// Shape de GET/POST /api/tours/{uuid}/crew-links/... (apps/crew/serializers.py::crew_link_row).

export type CrewLinkState =
  | 'active'
  | 'revoked'
  | 'expired'
  | 'disabled'
  | 'unavailable'
  | 'not_crew'
  | 'none'

export type CrewSource = 'member' | 'default_group' | 'group' | 'day_sheet' | 'contact_relation'

export interface CrewLink {
  uuid: string
  /** Solo si `state === 'active'` */
  url: string | null
  version: number
  created_at: string
  rotated_at: string | null
  revoked_at: string | null
  view_count: number
  first_viewed_at: string | null
  last_viewed_at: string | null
}

export interface CrewLinkRow {
  /** Sin teléfono ni email: solo si los tiene */
  contact: { uuid: string; display_name: string; has_phone: boolean; has_email: boolean }
  /** [] si ya no es crew pero tiene enlace */
  sources: CrewSource[]
  /** 'none' si no hay enlace */
  state: CrewLinkState
  link: CrewLink | null
}

/** Códigos de error (`{code, detail}`) de las acciones de enlace. */
export type CrewLinkErrorCode =
  | 'contact_not_in_crew'
  | 'portal_disabled'
  | 'link_revoked'
  | 'link_not_found'

// ─── Composable ───────────────────────────────────────────────────────────────

export function useCrewLinks() {
  const loading = ref(false)
  const error = ref('')

  const base = (tourUuid: string) => `/tours/${tourUuid}/crew-links/`

  /** GET /api/tours/{uuid}/crew-links/ (paginado, no crea enlaces). */
  async function listCrewLinks(
    tourUuid: string,
    page?: number,
    pageSize = 100
  ): Promise<Paginated<CrewLinkRow>> {
    loading.value = true
    error.value = ''
    try {
      const qs = buildQuery({ page, page_size: pageSize })
      return await apiClient.get<Paginated<CrewLinkRow>>(`${base(tourUuid)}?${qs}`, {
        fallback: 'Error al cargar los enlaces del crew',
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar los enlaces del crew'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** POST /api/tours/{uuid}/crew-links/{contact_uuid}/: 201 si lo crea, 200 si existía. */
  function ensureCrewLink(tourUuid: string, contactUuid: string): Promise<CrewLinkRow> {
    return apiClient.post<CrewLinkRow>(`${base(tourUuid)}${contactUuid}/`, {}, {
      fallback: 'Error al crear el enlace',
    })
  }

  /** POST .../rotate/: el enlace anterior deja de funcionar. */
  function rotateCrewLink(tourUuid: string, contactUuid: string): Promise<CrewLinkRow> {
    return apiClient.post<CrewLinkRow>(`${base(tourUuid)}${contactUuid}/rotate/`, {}, {
      fallback: 'Error al regenerar el enlace',
    })
  }

  /** POST .../revoke/ (idempotente). */
  function revokeCrewLink(tourUuid: string, contactUuid: string): Promise<CrewLinkRow> {
    return apiClient.post<CrewLinkRow>(`${base(tourUuid)}${contactUuid}/revoke/`, {}, {
      fallback: 'Error al revocar el enlace',
    })
  }

  return { loading, error, listCrewLinks, ensureCrewLink, rotateCrewLink, revokeCrewLink }
}
