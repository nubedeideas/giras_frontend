import { apiClient, ApiError, buildQuery, type FieldErrors } from '@/utils/apiClient'
import type { ReminderChannel } from '@/utils/reminders'
import type { AudiencePerson } from '@/composables/useRecipientOverrides'
import type { Paginated } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/notifications/notices/ (spec 2026-11-21-recordatorios-por-tipo-y-bajo-
// demanda.md, §5.1 y §5.2, fase R2). Errores 400/409 envueltos con `details.code` (§5.3).

export type NoticeOrigin =
  | 'cirium_delay'
  | 'cirium_cancelled'
  | 'cirium_diverted'
  | 'cirium_early'
  | 'urgent'

export type NoticeStatus = 'pending' | 'sent' | 'discarded' | 'expired' | 'superseded'

export interface NoticeActivity {
  uuid: string
  title: string
  scheduled_at: string
  activity_type_code: string
}

/** Elemento del listado GET /notices/?tour=<uuid>. */
export interface Notice {
  uuid: string
  tour: string
  activity: NoticeActivity | null
  origin: NoticeOrigin
  status: NoticeStatus
  channel: ReminderChannel
  template_slug: string | null
  /**
   * Snapshot del cambio: `flight_number`, `route`, `flight_status`, `delay_minutes`,
   * `prev_delay_minutes`, `departure_shift_minutes`, `expected_departure`, `gate`.
   */
  params: Record<string, string | number | null>
  text_overrides: Record<string, string>
  title: string
  message: string
  expires_at: string | null
  /** Se rellena al enviar. */
  recipients_count: number
  created_at: string
  /** Última modificación; si cambia en el listado, se invalida el detalle en caché (`stores/notices`). */
  updated_at?: string
  sent_at: string | null
  sent_by_name: string | null
  closed_at: string | null
  closed_by_name: string | null
  /** `discarded`, `expired`, `departed`, `no_longer_applies`, `superseded`, `activity_unavailable` o `""`. */
  close_reason: string
  notification_uuid: string | null
}

export interface NoticeEditableKey {
  key: string
  max_length: number
  value: string
}

export interface NoticePreview {
  channel: ReminderChannel
  template_slug: string | null
  editable_keys: NoticeEditableKey[]
  /** Email / in_app. */
  rendered: { title: string; body: string } | null
  /** WhatsApp, con el primer destinatario. */
  variables: Record<string, string> | null
  /** Posición de cada variable en la plantilla de WhatsApp (`{nombre: posición}`); `null` en email/in_app. */
  variable_positions?: Record<string, number | string> | null // el backend manda la posición como texto ("4")
  people: AudiencePerson[]
  counts: { total: number; reachable: number; no_phone: number; no_email: number; no_account: number }
  /** `remaining`: `null` (o negativo, legado) con plan ilimitado o sin suscripción. */
  cost: { whatsapp: number; cost_usd: number; remaining: number | null; over_quota: boolean }
  allowed_channels: ReminderChannel[]
  allowed_templates: { slug: string; name: string; approved: boolean }[]
}

export interface NoticeSelection {
  use_activity_audience: boolean
  groups: string[]
  contacts: string[]
  excluded_contacts: string[]
}

/** GET/PATCH /notices/{uuid}/, respuesta de `send`, `discard` y del envío urgente (201). */
export interface NoticeDetail extends Notice {
  selection: NoticeSelection
  /** `null` si el aviso ya no está pendiente. */
  preview: NoticePreview | null
}

/** Body de PATCH y de `send`: solo los campos que el usuario ha cambiado. */
export interface NoticeEdit {
  channel?: ReminderChannel
  template_slug?: string
  text_overrides?: Record<string, string>
  title?: string
  message?: string
  selection?: Partial<NoticeSelection>
}

/** POST /notices/urgent/: `dry_run: true` = vista previa sin escrituras. */
export interface UrgentRequest extends NoticeEdit {
  activity: string
  dry_run: boolean
}

export interface NoticeListParams {
  /** Uno o varios (el backend admite `status=a,b,c`). */
  status?: NoticeStatus | NoticeStatus[]
  /** Solo la primera página, con este tamaño (historial). Sin él, se recorren todas. */
  limit?: number
}

// ─── Errores ──────────────────────────────────────────────────────────────────

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v || null
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = firstString(item)
      if (s) return s
    }
  }
  return null
}

function wrappedMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const err = (data as { error?: unknown }).error
  if (err && typeof err === 'object') return firstString((err as { message?: unknown }).message)
  return null
}

/**
 * Error 400/409 de la API de avisos con `details = {"<campo>": [msg], "code": ["<code>"]}`.
 * `code` sale de `details.code[0]`; el mensaje nunca es el `code` técnico.
 */
export class NoticeApiError extends ApiError {
  readonly code: string | null
  readonly fieldErrors: FieldErrors

  constructor(source: ApiError) {
    super(source.status, source.data, { fallback: 'No se ha podido completar la acción' })
    this.name = 'NoticeApiError'
    const details: FieldErrors = source.fieldErrors ?? {}
    this.code = firstString(details.code)
    const fields: FieldErrors = {}
    for (const [k, v] of Object.entries(details)) {
      if (k !== 'code') fields[k] = v
    }
    this.fieldErrors = fields
    const fieldMessage = Object.values(fields).map(firstString).find(Boolean)
    const general = wrappedMessage(source.data)
    if (fieldMessage) this.message = fieldMessage
    else if (general && general !== this.code) this.message = general
    else if (this.code && this.message === this.code) this.message = 'No se ha podido completar la acción'
  }
}

function toNoticeError(e: unknown): unknown {
  if (e instanceof ApiError && (e.status === 400 || e.status === 409) && e.fieldErrors) {
    return new NoticeApiError(e)
  }
  return e
}

async function wrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p
  } catch (e) {
    throw toNoticeError(e)
  }
}

// ─── Composable ───────────────────────────────────────────────────────────────

const BASE = '/notifications/notices/'

export function useNotices() {
  /** Pendientes primero por `expires_at`, el resto por `-created_at` (orden del backend). */
  async function list(
    tourUuid: string,
    { status: rawStatus, limit }: NoticeListParams = {}
  ): Promise<Notice[]> {
    const status = Array.isArray(rawStatus) ? rawStatus.join(',') : rawStatus
    if (limit) {
      const qs = buildQuery({ tour: tourUuid, status, page_size: limit })
      const page = await wrap(
        apiClient.get<Paginated<Notice> | Notice[]>(`${BASE}?${qs}`, {
          fallback: 'No se han podido cargar los avisos',
        })
      )
      return Array.isArray(page) ? page : (page?.results ?? [])
    }
    const qs = buildQuery({ tour: tourUuid, status, page_size: 50 })
    return wrap(
      apiClient.getAll<Notice>(`${BASE}?${qs}`, { fallback: 'No se han podido cargar los avisos' })
    )
  }

  function get(uuid: string): Promise<NoticeDetail> {
    return apiClient.get<NoticeDetail>(`${BASE}${uuid}/`, {
      fallback: 'No se ha podido cargar el aviso',
    })
  }

  function update(uuid: string, payload: NoticeEdit): Promise<NoticeDetail> {
    return wrap(
      apiClient.patch<NoticeDetail>(`${BASE}${uuid}/`, payload, {
        fallback: 'No se ha podido guardar el aviso',
      })
    )
  }

  /** Sin `payload` (o vacío) se envía tal cual está guardado. */
  function send(uuid: string, payload?: NoticeEdit): Promise<NoticeDetail> {
    return wrap(
      apiClient.post<NoticeDetail>(`${BASE}${uuid}/send/`, payload ?? {}, {
        fallback: 'No se ha podido enviar el aviso',
      })
    )
  }

  function discard(uuid: string): Promise<NoticeDetail> {
    return wrap(
      apiClient.post<NoticeDetail>(`${BASE}${uuid}/discard/`, {}, {
        fallback: 'No se ha podido descartar el aviso',
      })
    )
  }

  function urgentPreview(payload: Omit<UrgentRequest, 'dry_run'>): Promise<NoticePreview> {
    return wrap(
      apiClient.post<NoticePreview>(`${BASE}urgent/`, { ...payload, dry_run: true }, {
        fallback: 'No se ha podido preparar la vista previa',
      })
    )
  }

  function sendUrgent(payload: Omit<UrgentRequest, 'dry_run'>): Promise<NoticeDetail> {
    return wrap(
      apiClient.post<NoticeDetail>(`${BASE}urgent/`, { ...payload, dry_run: false }, {
        fallback: 'No se ha podido enviar el aviso urgente',
      })
    )
  }

  return { list, get, update, send, discard, urgentPreview, sendUrgent }
}
