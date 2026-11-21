import type { TourCostsReport } from '@/composables/useTwilioCosts'
import type {
  AdminTwilioCostsSummary,
  TwilioCostsTourRow,
  TwilioDiscrepancy,
} from '@/composables/useAdminTwilioCosts'

/** Respuesta de `reports/costs/` para tests (contrato §5.2 de la spec 3.5). */
export function tourCostsReport(overrides: Partial<TourCostsReport> = {}): TourCostsReport {
  return {
    filters: { tour: 'T1', from: '2026-10-23', to: '2026-11-21', tz: 'Europe/Madrid' },
    tour: { uuid: 'T1', name: 'Gira Norte', artist_name: 'Artista' },
    currency: 'USD',
    synced_at: '2026-11-21T09:40:00Z',
    last_sync_status: 'success',
    totals: {
      whatsapp_messages: 3,
      priced_messages: 3,
      pending_price_messages: 0,
      segments: 3,
      amount: '1.50000',
      avg_amount: '0.50000',
      email_messages: 2,
    },
    by_channel: [
      { channel: 'whatsapp', messages: 3, amount: '1.50000', cost_model: 'per_message' },
      { channel: 'email', messages: 2, amount: null, cost_model: 'flat' },
    ],
    by_month: [
      { month: '2026-10', messages: 1, amount: '0.50000' },
      { month: '2026-11', messages: 2, amount: '1.00000' },
    ],
    by_type: [
      { notification_type: 'event_reminder', messages: 2, amount: '1.00000' },
      { notification_type: null, messages: 1, amount: '0.50000' },
    ],
    open_discrepancies: 0,
    ...overrides,
  }
}

export function costsTourRow(overrides: Partial<TwilioCostsTourRow> = {}): TwilioCostsTourRow {
  return {
    tour_uuid: 'T1',
    tour_name: 'Gira Norte',
    artist_name: 'Artista',
    tour_status: 'active',
    is_deleted: false,
    owner_email: 'owner@x.es',
    plan_code: 'starter',
    plan_name: 'Starter',
    plan_price: '179.00000',
    plan_currency: 'USD',
    subscription_status: 'active',
    paid_amount: '179.00000',
    paid_currency: 'USD',
    notifications_used: 10,
    notification_limit: 500,
    messages_month: 4,
    amount_month: '2.00000',
    messages_total: 10,
    amount_total: '5.00000',
    margin_total: '174.00000',
    margin_pct: 97.2,
    ...overrides,
  }
}

export function adminSummary(
  overrides: Partial<AdminTwilioCostsSummary> = {}
): AdminTwilioCostsSummary {
  return {
    month: '2026-11',
    currency: 'USD',
    last_sync: {
      status: 'success',
      trigger: 'beat',
      started_at: '2026-11-21T09:40:00Z',
      finished_at: '2026-11-21T09:41:00Z',
      window_start: '2026-11-19T09:40:00Z',
      window_end: '2026-11-21T09:40:00Z',
      error: '',
    },
    totals: {
      messages: 12,
      amount: '6.00000',
      attributed_amount: '5.00000',
      unattributed_messages: 2,
      unattributed_amount: '1.00000',
      inbound_messages: 5,
      inbound_amount: '0.00000',
      pending_price_messages: 1,
    },
    previous_month_amount: '4.00000',
    open_discrepancies: { total: 3, by_kind: { billed_without_recipient: 2, price_missing: 1 } },
    tours: [costsTourRow()],
    tours_truncated: false,
    ...overrides,
  }
}

export function discrepancy(overrides: Partial<TwilioDiscrepancy> = {}): TwilioDiscrepancy {
  return {
    uuid: 'D1',
    kind: 'billed_without_recipient',
    status: 'open',
    sid: 'SM0123456789abcdef0123456789abab12',
    tour: null,
    notification_uuid: null,
    details: {
      billing_at: '2026-11-20T10:00:00Z',
      direction: 'outbound-api',
      twilio_status: 'delivered',
      counterpart_masked: '***1234',
      amount: '0.00500',
    },
    first_seen_at: '2026-11-20T10:40:00Z',
    last_seen_at: '2026-11-21T09:40:00Z',
    resolved_at: null,
    acknowledged_at: null,
    acknowledged_by_email: null,
    ...overrides,
  }
}

/** Intl separa número y símbolo con espacios duros (U+00A0 / U+202F) según el locale. */
const HARD_SPACES = new RegExp(`[${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}]`, 'g')
export const normSpaces = (s: string) => s.replace(HARD_SPACES, ' ')
