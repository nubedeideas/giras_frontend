import i18n from '@/i18n'
import { apiClient, buildQuery } from '@/utils/apiClient'
import type { Paginated } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de la spec 3.3 (§5.2): InboxItemSerializer de `apps/notifications/inbox_serializers.py`.

export type InboxKind =
  | 'message'
  | 'schedule_conflict'
  | 'flight_delay'
  | 'flight_cancelled'
  | 'flight_diverted'
  // Avisos bajo demanda (R2): salida adelantada; params `{ flight_number, minutes, route, notice_uuid }`.
  | 'flight_early'
  | 'plan_limit'
  | 'delivery_failed'
  // Bloque 3.5: solo superusuarios, sin gira; params `{ new_count, date }`.
  | 'billing_discrepancy'

export type InboxSeverity = 'info' | 'warning' | 'critical'

export type InboxTargetType =
  | 'activity'
  | 'conflict'
  | 'plan'
  | 'reports'
  // Bloque 3.5: `/admin?tab=costs`.
  | 'admin_costs'
  // Avisos bajo demanda (R2): `/tour?tab=notices&notice=<uuid>`.
  | 'notice'
  | 'none'

export interface InboxTarget {
  type: InboxTargetType
  tour_uuid: string | null
  /** Solo si la actividad existe y no está borrada. */
  activity_uuid: string | null
  /** Solo si el conflicto existe y no está borrado. */
  conflict_uuid: string | null
  /** Solo en `type: 'notice'`. */
  notice_uuid?: string | null
}

// GET /api/notifications/inbox/ (results), `item` de POST /inbox/{uuid}/read/
export interface InboxItem {
  uuid: string
  /** Se toleran kinds futuros: se pintan con `title`/`body`. */
  kind: InboxKind | string
  severity: InboxSeverity
  /** Copia en español; la UI usa i18n salvo en `message` y en kinds desconocidos. */
  title: string
  body: string
  /** `plan_limit` añade `automatic_degraded: boolean` al 100 % (recordatorios por tipo, D7). */
  params: Record<string, string | number | boolean>
  is_read: boolean
  /** ISO 8601 UTC. */
  read_at: string | null
  /** ISO 8601 UTC; orden del listado (desc). */
  occurred_at: string
  created_at: string
  tour: { uuid: string; name: string } | null
  target: InboxTarget
}

// GET /api/notifications/inbox/unread-count/
export interface InboxUnreadCount {
  unread: number
  /** Del ítem visible más reciente, leído o no. */
  latest_occurred_at: string | null
}

// POST /api/notifications/inbox/{uuid}/read/
export interface InboxReadResponse {
  item: InboxItem
  unread: number
}

// POST /api/notifications/inbox/read-all/
export interface InboxReadAllResponse {
  updated: number
  unread: number
}

export interface InboxListParams {
  unread?: boolean
  tour?: string
  kind?: InboxKind[]
  page?: number
  pageSize?: number
}

export interface InboxReadAllBody {
  before?: string
  tour?: string
  kind?: InboxKind[]
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const INBOX_PAGE_SIZE = 20

const BASE = '/notifications/inbox/'

const tr = (key: string) => i18n.global.t(key)

function listInbox(params: InboxListParams = {}): Promise<Paginated<InboxItem>> {
  const query = buildQuery({
    unread: params.unread === undefined ? undefined : String(params.unread),
    tour: params.tour,
    kind: params.kind?.length ? params.kind.join(',') : undefined,
    page: params.page,
    page_size: params.pageSize ?? INBOX_PAGE_SIZE,
  })
  return apiClient.get<Paginated<InboxItem>>(`${BASE}?${query}`, {
    fallback: tr('inbox.errors.load'),
  })
}

/** Página siguiente: `next` absoluto de DRF, tal cual. */
function listInboxPage(nextUrl: string): Promise<Paginated<InboxItem>> {
  return apiClient.get<Paginated<InboxItem>>(nextUrl, { fallback: tr('inbox.errors.load') })
}

function getUnreadCount(tour?: string): Promise<InboxUnreadCount> {
  const query = buildQuery({ tour })
  return apiClient.get<InboxUnreadCount>(`${BASE}unread-count/${query ? `?${query}` : ''}`, {
    fallback: tr('inbox.errors.load'),
  })
}

function markInboxRead(uuid: string): Promise<InboxReadResponse> {
  return apiClient.post<InboxReadResponse>(`${BASE}${uuid}/read/`, undefined, {
    fallback: tr('inbox.errors.action'),
  })
}

function markAllInboxRead(body: InboxReadAllBody = {}): Promise<InboxReadAllResponse> {
  const payload: Record<string, unknown> = {}
  if (body.before) payload.before = body.before
  if (body.tour) payload.tour = body.tour
  if (body.kind?.length) payload.kind = body.kind
  return apiClient.post<InboxReadAllResponse>(`${BASE}read-all/`, payload, {
    fallback: tr('inbox.errors.action'),
  })
}

function dismissInboxItem(uuid: string): Promise<void> {
  return apiClient.delete<void>(`${BASE}${uuid}/`, { fallback: tr('inbox.errors.action') })
}

export const inboxApi = {
  listInbox,
  listInboxPage,
  getUnreadCount,
  markInboxRead,
  markAllInboxRead,
  dismissInboxItem,
}

export function useInbox() {
  return inboxApi
}
