import { ref } from 'vue'
import { ApiError, apiClient } from '@/utils/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────
// Shape de GET /api/crew/{token}/ (apps/crew/views.py::CrewPortalView, serializers.py y
// services/agenda.py::serialize_activity). Endpoint público: sin `Authorization`.

export type CrewErrorCode =
  | 'invalid'
  | 'revoked'
  | 'expired'
  | 'disabled'
  | 'tour_cancelled'
  | 'unavailable'
  | 'rate_limited'
  | 'network'

export type CrewActivityStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'delayed'

export interface CrewActivityDetails {
  flight_number: string
  airline: string
  terminal: string
  gate: string
  flight_status: string
  delay_minutes: number
  hotel_name: string
  confirmation_number: string
  transport_type: string
  vehicle_plate: string
  driver_name: string
  driver_phone: string
}

export interface CrewActivity {
  uuid: string
  title: string
  /** '' si no hay */
  description: string
  status: CrewActivityStatus
  all_day: boolean
  activity_type: { code: string; name: string; category: string; icon: string; color: string } | null
  /** ISO con el offset de `timezone` */
  start_local: string
  /** ISO con el offset de `end_timezone` (o de `timezone` si es null) */
  end_local: string | null
  /** IANA de inicio */
  timezone: string
  /** Zona de destino (vuelos/transporte) o null */
  end_timezone: string | null
  location_name: string
  location_address: string
  destination_name: string
  destination_address: string
  maps_url: string | null
  /** Solo las claves con valor */
  details: Partial<CrewActivityDetails>
}

export interface CrewDay {
  /** YYYY-MM-DD, fecha local de las actividades */
  date: string
  is_today: boolean
  /** Orden cronológico real */
  activities: CrewActivity[]
}

export interface CrewDocument {
  uuid: string
  description: string
  document_type: 'rider' | 'visa' | 'insurance' | 'contract' | 'other'
  document_type_display: string
  file_name: string
  file_size: number | null
  created_at: string
  /** Absoluta: https://app.giras.pro/api/crew/<token>/documents/<uuid>/ */
  download_url: string
}

export type CrewPortalMode = 'upcoming' | 'live' | 'finished'

export interface CrewPortal {
  tour: {
    name: string
    artist_name: string
    status: 'draft' | 'active' | 'completed'
    start_date: string
    end_date: string
    start_city: string
    end_city: string
    /** Absoluta o null */
    poster_url: string | null
    contacts_text: string
  }
  /** Solo el propio contacto */
  contact: { first_name: string; display_name: string }
  /** Zona del portal (la que define "hoy") */
  timezone: string
  /** YYYY-MM-DD en `timezone` */
  today: string
  mode: CrewPortalMode
  range: { from: string; to: string }
  /** Todos los días del rango, también vacíos */
  days: CrewDay[]
  next_activity_date: string | null
  documents: CrewDocument[]
  /** YYYY-MM-DD */
  expires_on: string
  generated_at: string
}

// ─── Errores ──────────────────────────────────────────────────────────────────

const GONE_CODES: ReadonlySet<CrewErrorCode> = new Set([
  'revoked',
  'expired',
  'disabled',
  'tour_cancelled',
  'unavailable',
])

export class CrewPortalError extends Error {
  readonly code: CrewErrorCode

  constructor(code: CrewErrorCode) {
    super(code)
    this.name = 'CrewPortalError'
    this.code = code
  }
}

/**
 * Traduce un error de la llamada al `code` del portal.
 * 404 (JSON `invalid` o el 404 HTML de Django si el token no casa con la regex) da `invalid`;
 * 410 da su `code` (`revoked` si falta o no se reconoce); 429 (formato envuelto del handler)
 * da `rate_limited`; 0/5xx y cualquier otra cosa, `network`.
 */
export function crewErrorCode(e: unknown): CrewErrorCode {
  if (!(e instanceof ApiError)) return 'network'
  if (e.status === 404) return 'invalid'
  if (e.status === 410) {
    const data = e.data as { code?: unknown } | null
    const code = typeof data?.code === 'string' ? (data.code as CrewErrorCode) : null
    return code && GONE_CODES.has(code) ? code : 'revoked'
  }
  if (e.status === 429) return 'rate_limited'
  return 'network'
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** GET /api/crew/{token}/ sin auth. Lanza `CrewPortalError`. */
export async function getPortal(token: string): Promise<CrewPortal> {
  try {
    return await apiClient.get<CrewPortal>(`/crew/${encodeURIComponent(token)}/`, {
      auth: false,
    })
  } catch (e) {
    throw new CrewPortalError(crewErrorCode(e))
  }
}

export function useCrewPortal() {
  const portal = ref<CrewPortal | null>(null)
  const loading = ref(false)
  const error = ref<CrewErrorCode | null>(null)

  /** Carga (o recarga) el portal. Si falla una recarga, se conserva lo último cargado. */
  async function load(token: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      portal.value = await getPortal(token)
    } catch (e) {
      const code = e instanceof CrewPortalError ? e.code : 'network'
      error.value = code
      // Un enlace que deja de ser válido no debe seguir mostrando la agenda.
      if (code !== 'network' && code !== 'rate_limited') portal.value = null
    } finally {
      loading.value = false
    }
  }

  return { portal, loading, error, load, getPortal }
}
