import { DateTime } from 'luxon'
import { apiClient, buildQuery } from '@/utils/apiClient'
import { browserZone } from '@/utils/datetime'
import type { Paginated } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
// Forma exacta de `apps/notifications/services/reports.py` (contrato §5.2 de
// specs/2026-11-20-bloque3-1-reports-confirmaciones.md).

export type ReportChannel = 'whatsapp' | 'email'
export type ReportRecipientStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'confirmed'
  | 'failed'
  | 'bounced'
// `pending` es un valor heredado que aparece en datos reales aunque no esté en STATUS_CHOICES.
export type ReportNotificationStatus =
  | 'draft'
  | 'pending'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'

export interface RecipientMetrics {
  /** Destinatarios en el periodo. */
  recipients: number
  /** Sin enviar. */
  pending: number
  /** Salieron (`sent_at`). */
  sent: number
  /** Entregados (incluye leídos y confirmados). Email: siempre 0, no se mide. */
  delivered: number
  /** Leídos (incluye confirmados). Email: siempre 0. */
  read: number
  /** Pulsaron "Confirmar" (solo WhatsApp con botón). */
  confirmed: number
  /** `failed` + `bounced`. */
  failed: number
}

export interface ReportsFilters {
  tour: string | null
  /** `YYYY-MM-DD` */
  from: string
  /** `YYYY-MM-DD` */
  to: string
  tz: string
  channel: ReportChannel | null
}

export interface ReportsChannelRow extends RecipientMetrics {
  channel: ReportChannel
  /** `false` en email: entregados y leídos no se miden. */
  tracks_delivery: boolean
}

export interface ReportsTypeRow extends RecipientMetrics {
  notification_type: string
  notifications: number
  /** Enviados de WhatsApp con template con SID y botón de confirmar (denominador de la tasa). */
  confirmable_sent: number
}

export interface ReportsTourRow extends RecipientMetrics {
  tour_uuid: string
  tour_name: string
  artist_name: string
  notifications: number
}

export interface ReportsSeriesPoint {
  /** Día local `YYYY-MM-DD`. */
  date: string
  sent: number
  delivered: number
  read: number
  confirmed: number
  failed: number
}

export interface ReportsFailedContact {
  /** `null` = destinatario directo sin contacto. */
  contact_uuid: string | null
  /** Nombre del contacto; si no hay, empresa, teléfono o email; si nada, "Sin destinatario". */
  name: string
  /** Override del recipient; `null` si usa el del contacto. */
  phone: string | null
  email: string | null
  failed_count: number
  /** Puede ser `''`. */
  last_error: string
  /** ISO UTC */
  last_failed_at: string
}

export interface ReportsFailureReason {
  /** `''` = sin mensaje. */
  error_message: string
  count: number
}

export interface ReportsRecentNotification {
  uuid: string
  title: string
  notification_type: string
  channel: ReportChannel
  status: ReportNotificationStatus
  confirmable: boolean
  tour_uuid: string
  tour_name: string
  activity_uuid: string | null
  /** ISO UTC: `sent_at`, si no `scheduled_for`, si no `created_at`. */
  reference_at: string
  recipient_count: number
  sent_count: number
  delivered_count: number
  read_count: number
  confirmed_count: number
  failed_count: number
}

/** GET /api/notifications/reports/summary/ */
export interface ReportsSummary {
  filters: ReportsFilters
  /** `confirmable_sent`: enviados de WhatsApp con template con SID y botón de confirmar. */
  totals: RecipientMetrics & { confirmable_sent: number }
  /**
   * Porcentaje 0-100 con 1 decimal; `null` si el denominador es 0. Entrega y lectura se calculan
   * solo sobre canales que las miden (WhatsApp): `null` si no hubo envíos de WhatsApp.
   */
  rates: {
    delivery_rate: number | null
    read_rate: number | null
    confirmation_rate: number | null
  }
  /** Nivel notificación; `total` es la suma de las 6 claves de `by_status`. */
  notifications: {
    total: number
    /** Las 6 claves de STATUS_CHOICES; el `pending` heredado se ignora aquí. */
    by_status: Record<Exclude<ReportNotificationStatus, 'pending'>, number>
  }
  /** Orden whatsapp, email (o solo una fila si se filtra canal). */
  by_channel: ReportsChannelRow[]
  /** Solo tipos con datos, orden por `recipients` desc. */
  by_type: ReportsTypeRow[]
  /** Orden por `sent` desc. */
  by_tour: ReportsTourRow[]
  /** Un elemento por día local de `from` a `to`, con ceros. */
  series: ReportsSeriesPoint[]
  /** Máximo 10. */
  top_failed_contacts: ReportsFailedContact[]
  /** Máximo 10. */
  failure_reasons: ReportsFailureReason[]
  /** Máximo 10, orden `reference_at` desc. */
  recent_notifications: ReportsRecentNotification[]
}

/** Elemento de GET /api/notifications/reports/contact-history/ */
export interface ContactHistoryItem {
  notification_uuid: string
  title: string
  notification_type: string
  channel: ReportChannel
  notification_status: ReportNotificationStatus
  confirmable: boolean
  tour_uuid: string
  tour_name: string
  activity_uuid: string | null
  activity_title: string | null
  /** ISO UTC */
  reference_at: string
  /** Estado de ESTE destinatario. */
  status: ReportRecipientStatus
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  confirmed_at: string | null
  /** `''` si no hay. */
  error_message: string
  reminder_count: number
}

export interface ReportsSummaryQuery {
  tour?: string
  /** `YYYY-MM-DD` */
  from?: string
  /** `YYYY-MM-DD` */
  to?: string
  /** IANA; por defecto, la zona del navegador. */
  tz?: string
  channel?: ReportChannel
}

export interface ContactHistoryQuery {
  tour?: string
  page?: number
  /** ≤ 100; por defecto 20. */
  pageSize?: number
}

/** Tope de días del rango de `summary` (`REPORTS_MAX_RANGE_DAYS`). */
export const REPORTS_MAX_RANGE_DAYS = 366

export type ReportRangePreset = 'last7' | 'last30' | 'last90' | 'fullTour'

/**
 * Rango `from`/`to` (`YYYY-MM-DD`, inclusivo) de un preset en la zona `zone`.
 * `fullTour` necesita las fechas de la gira y devuelve `null` si faltan o si el tramo supera
 * `REPORTS_MAX_RANGE_DAYS` (el backend respondería 400 `range_too_long`).
 */
export function rangeForPreset(
  preset: ReportRangePreset,
  zone: string,
  tour?: { start_date?: string | null; end_date?: string | null } | null,
  now: DateTime = DateTime.now()
): { from: string; to: string } | null {
  if (preset === 'fullTour') {
    if (!tour?.start_date || !tour.end_date) return null
    const start = DateTime.fromISO(tour.start_date)
    const end = DateTime.fromISO(tour.end_date)
    if (!start.isValid || !end.isValid || start > end) return null
    const days = Math.round(end.diff(start, 'days').days) + 1
    if (days > REPORTS_MAX_RANGE_DAYS) return null
    return { from: start.toISODate()!, to: end.toISODate()! }
  }
  const span = preset === 'last7' ? 7 : preset === 'last90' ? 90 : 30
  const today = now.setZone(zone).startOf('day')
  return { from: today.minus({ days: span - 1 }).toISODate()!, to: today.toISODate()! }
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useNotificationReports() {
  function getSummary(filters: ReportsSummaryQuery = {}): Promise<ReportsSummary> {
    const qs = buildQuery({
      tour: filters.tour,
      from: filters.from,
      to: filters.to,
      tz: filters.tz ?? browserZone(),
      channel: filters.channel,
    })
    return apiClient.get<ReportsSummary>(`/notifications/reports/summary/?${qs}`, {
      fallback: 'No se han podido cargar los informes',
    })
  }

  function getContactHistory(
    contactUuid: string,
    opts: ContactHistoryQuery = {}
  ): Promise<Paginated<ContactHistoryItem>> {
    const qs = buildQuery({
      contact: contactUuid,
      tour: opts.tour,
      page: opts.page,
      page_size: opts.pageSize,
    })
    return apiClient.get<Paginated<ContactHistoryItem>>(
      `/notifications/reports/contact-history/?${qs}`,
      { fallback: 'No se ha podido cargar el historial de notificaciones' }
    )
  }

  return { getSummary, getContactHistory }
}
