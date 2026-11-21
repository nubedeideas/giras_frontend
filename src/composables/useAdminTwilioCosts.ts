import i18n from '@/i18n'
import { apiClient } from '@/utils/apiClient'
import type { Paginated } from '@/types'
import type {
  Amount,
  DiscrepancyKind,
  DiscrepancyStatus,
  SyncStatus,
} from '@/composables/useTwilioCosts'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato §5.2 de specs/2026-11-21-bloque3-5-auditoria-twilio.md:
// `apps/notifications/cost_views.py` y `cost_serializers.py` (montados en `/api/admin/`).

export interface TwilioCostsLastSync {
  status: SyncStatus
  trigger: 'beat' | 'admin' | 'command'
  started_at: string
  finished_at: string | null
  window_start: string
  window_end: string
  error: string
}

export interface TwilioCostsTourRow {
  tour_uuid: string
  tour_name: string
  artist_name: string
  tour_status: string
  is_deleted: boolean
  owner_email: string | null
  plan_code: string | null
  plan_name: string | null
  plan_price: Amount | null
  plan_currency: string | null
  subscription_status: 'pending' | 'active' | 'cancelled' | null
  /** "0.00000" sin pagos. */
  paid_amount: Amount
  /** "MIXED" si hay varias monedas. */
  paid_currency: string | null
  notifications_used: number | null
  /** 0 = ilimitado. */
  notification_limit: number | null
  messages_month: number
  amount_month: Amount
  messages_total: number
  amount_total: Amount
  margin_total: Amount | null
  margin_pct: number | null
}

// GET /api/admin/twilio-costs/summary/
export interface AdminTwilioCostsSummary {
  /** `AAAA-MM` (UTC). */
  month: string
  currency: string
  last_sync: TwilioCostsLastSync | null
  totals: {
    /** Salientes del mes. */
    messages: number
    amount: Amount
    attributed_amount: Amount
    unattributed_messages: number
    unattributed_amount: Amount
    inbound_messages: number
    inbound_amount: Amount
    pending_price_messages: number
  }
  previous_month_amount: Amount
  open_discrepancies: { total: number; by_kind: Partial<Record<DiscrepancyKind, number>> }
  tours: TwilioCostsTourRow[]
  tours_truncated: boolean
}

// GET /api/admin/twilio-costs/discrepancies/ (results) y POST .../{uuid}/acknowledge/
export interface TwilioDiscrepancy {
  uuid: string
  kind: DiscrepancyKind
  status: DiscrepancyStatus
  /** `''` en `recipient_without_sid`. */
  sid: string
  tour: { uuid: string; name: string } | null
  notification_uuid: string | null
  /** Claves por `kind` (§5.3). */
  details: Record<string, string | number | null>
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  acknowledged_at: string | null
  acknowledged_by_email: string | null
}

// POST /api/admin/twilio-costs/sync/ (202)
export interface TwilioCostsSyncResponse {
  queued: boolean
  lookback_hours: number
}

export type DiscrepancyStatusFilter = DiscrepancyStatus | 'all'

export interface DiscrepancyFilters {
  /** `open` por defecto en el backend. */
  status?: DiscrepancyStatusFilter
  kind?: DiscrepancyKind[]
  tour?: string
  pageSize?: number
}

export const DISCREPANCIES_PAGE_SIZE = 20

// ─── Composable ───────────────────────────────────────────────────────────────

const BASE = '/admin/twilio-costs'

const tr = (key: string) => i18n.global.t(key)

function getSummary(month?: string): Promise<AdminTwilioCostsSummary> {
  const qs = month ? `?${new URLSearchParams({ month }).toString()}` : ''
  return apiClient.get<AdminTwilioCostsSummary>(`${BASE}/summary/${qs}`, {
    fallback: tr('admin.costs.error'),
  })
}

/** Acepta filtros o la URL `next` de DRF tal cual. `kind` se repite en la query. */
function listDiscrepancies(
  query: string | DiscrepancyFilters = {}
): Promise<Paginated<TwilioDiscrepancy>> {
  let url: string
  if (typeof query === 'string') {
    url = query
  } else {
    const q = new URLSearchParams()
    if (query.status) q.set('status', query.status)
    for (const k of query.kind ?? []) q.append('kind', k)
    if (query.tour) q.set('tour', query.tour)
    q.set('page_size', String(query.pageSize ?? DISCREPANCIES_PAGE_SIZE))
    url = `${BASE}/discrepancies/?${q.toString()}`
  }
  return apiClient.get<Paginated<TwilioDiscrepancy>>(url, { fallback: tr('admin.costs.error') })
}

function acknowledge(uuid: string): Promise<TwilioDiscrepancy> {
  return apiClient.post<TwilioDiscrepancy>(
    `${BASE}/discrepancies/${uuid}/acknowledge/`,
    undefined,
    { fallback: tr('admin.costs.error') }
  )
}

/** 409 (corrida en curso) y 503 (sin credenciales) llegan como `ApiError` con mensaje propio. */
function triggerSync(lookbackHours?: number): Promise<TwilioCostsSyncResponse> {
  const body = lookbackHours === undefined ? {} : { lookback_hours: lookbackHours }
  return apiClient.post<TwilioCostsSyncResponse>(`${BASE}/sync/`, body, {
    fallback: tr('admin.costs.error'),
    statusMessages: {
      409: tr('admin.costs.syncRunning'),
      503: tr('admin.costs.notConfigured'),
    },
  })
}

export function useAdminTwilioCosts() {
  return { getSummary, listDiscrepancies, acknowledge, triggerSync }
}
