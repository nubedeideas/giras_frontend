import i18n from '@/i18n'
import { apiClient, buildQuery } from '@/utils/apiClient'
import { browserZone } from '@/utils/datetime'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato §5.2 de specs/2026-11-21-bloque3-5-auditoria-twilio.md:
// `apps/notifications/services/cost_reports.py` (`build_tour_costs`).

export type CostChannel = 'whatsapp' | 'sms' | 'email'
export type SyncStatus = 'running' | 'success' | 'partial' | 'failed'
export type DiscrepancyKind =
  | 'billed_without_recipient'
  | 'missing_in_twilio'
  | 'recipient_without_sid'
  | 'status_mismatch'
  | 'price_missing'
  | 'currency_mismatch'
export type DiscrepancyStatus = 'open' | 'acknowledged' | 'resolved'

export const DISCREPANCY_KINDS: DiscrepancyKind[] = [
  'billed_without_recipient',
  'missing_in_twilio',
  'recipient_without_sid',
  'status_mismatch',
  'price_missing',
  'currency_mismatch',
]

/** Importes: cadena decimal con 5 decimales ("0.00500"), siempre en `currency`. */
export type Amount = string

// GET /api/notifications/reports/costs/ (solo superusuarios)
export interface TourCostsReport {
  filters: { tour: string; from: string; to: string; tz: string }
  tour: { uuid: string; name: string; artist_name: string }
  /** `TWILIO_BILLING_CURRENCY`, p. ej. "USD". */
  currency: string
  /** `finished_at` de la última corrida success/partial (ISO). */
  synced_at: string | null
  last_sync_status: SyncStatus | null
  totals: {
    /** Salientes atribuidos a la gira en el rango (whatsapp + sms). */
    whatsapp_messages: number
    priced_messages: number
    pending_price_messages: number
    segments: number
    /** Suma de los que tienen precio, en `currency`. */
    amount: Amount
    avg_amount: Amount | null
    /** Emails enviados (`sent_at`) en el rango; sin coste por mensaje. */
    email_messages: number
  }
  /** whatsapp siempre; sms solo si > 0; email siempre. */
  by_channel: Array<{
    channel: CostChannel
    messages: number
    /** `null` en email. */
    amount: Amount | null
    cost_model: 'per_message' | 'flat'
  }>
  /** `month`: `AAAA-MM` local en `tz`; un elemento por mes del rango, con ceros. */
  by_month: Array<{ month: string; messages: number; amount: Amount }>
  /** Orden `amount` desc; `notification_type` es `null` en la atribución por teléfono. */
  by_type: Array<{ notification_type: string | null; messages: number; amount: Amount }>
  /** Siempre presente: el endpoint es solo de superusuarios. */
  open_discrepancies: number
}

export interface TourCostsQuery {
  /** uuid de la gira (obligatorio). */
  tour: string
  /** `YYYY-MM-DD` */
  from?: string
  /** `YYYY-MM-DD` */
  to?: string
  /** IANA; por defecto, la zona del navegador. */
  tz?: string
}

// ─── Composable ───────────────────────────────────────────────────────────────

const tr = (key: string) => i18n.global.t(key)

function getTourCosts(query: TourCostsQuery): Promise<TourCostsReport> {
  const qs = buildQuery({
    tour: query.tour,
    from: query.from,
    to: query.to,
    tz: query.tz ?? browserZone(),
  })
  return apiClient.get<TourCostsReport>(`/notifications/reports/costs/?${qs}`, {
    fallback: tr('reports.costs.error'),
  })
}

export function useTwilioCosts() {
  return { getTourCosts }
}
