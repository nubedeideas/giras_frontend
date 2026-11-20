import { DateTime } from 'luxon'
import { ApiError } from '@/utils/apiClient'
import type {
  NotificationListItem,
  NotificationRecipient,
  RemindUnconfirmedExcluded,
} from '@/composables/useNotifications'

/**
 * Estado visible de un destinatario:
 * - Con botón "Confirmar": confirmed, failed, pending (enviado sin confirmar), notSent.
 * - Sin botón: failed, read, delivered, sent, notSent.
 */
export type RecipientChipKind =
  | 'confirmed'
  | 'failed'
  | 'pending'
  | 'notSent'
  | 'sent'
  | 'delivered'
  | 'read'

type ChipInput = Pick<
  NotificationRecipient,
  'status' | 'confirmed_at' | 'delivered_at' | 'read_at'
>

export function recipientChipKind(r: ChipInput, confirmable: boolean): RecipientChipKind {
  if (r.status === 'failed' || r.status === 'bounced') return 'failed'
  if (r.status === 'pending') return 'notSent'
  const read = r.status === 'read' || r.status === 'confirmed' || !!r.read_at || !!r.confirmed_at
  const delivered = read || r.status === 'delivered' || !!r.delivered_at
  if (confirmable) {
    return r.confirmed_at || r.status === 'confirmed' ? 'confirmed' : 'pending'
  }
  if (read) return 'read'
  if (delivered) return 'delivered'
  return 'sent'
}

/** Subestado de un pendiente de confirmar: leído, entregado o nada. */
export function pendingDetail(r: ChipInput): 'read' | 'delivered' | null {
  if (r.status === 'read' || r.read_at) return 'read'
  if (r.status === 'delivered' || r.delivered_at) return 'delivered'
  return null
}

const ORDER: Record<RecipientChipKind, number> = {
  pending: 0,
  notSent: 1,
  sent: 1,
  delivered: 1,
  read: 1,
  failed: 2,
  confirmed: 3,
}

/** Pendientes primero, luego fallidos y confirmados al final (orden estable). */
export function sortRecipientsForConfirmation<T extends ChipInput>(
  recipients: T[],
  confirmable: boolean
): T[] {
  return recipients
    .map((r, i) => ({ r, i, k: ORDER[recipientChipKind(r, confirmable)] }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r)
}

/** ¿La actividad ya empezó? (el backend rechaza el recordatorio con `activity_past`). */
export function isActivityPast(
  scheduledAt: string | null | undefined,
  now: DateTime = DateTime.now()
): boolean {
  if (!scheduledAt) return false
  const at = DateTime.fromISO(scheduledAt, { zone: 'utc' })
  return at.isValid && at < now
}

/** ¿Se puede ofrecer "Recordar a los que faltan"? */
export function canRemindUnconfirmed(
  n: Pick<NotificationListItem, 'confirmable' | 'status' | 'confirmed_count' | 'recipient_count'>,
  activityPast = false
): boolean {
  return (
    !activityPast && n.confirmable && n.status === 'sent' && n.confirmed_count < n.recipient_count
  )
}

/** Códigos 400 de remind-unconfirmed que no cambian reintentando: el botón se desactiva. */
export const BLOCKING_REMIND_CODES = [
  'activity_past',
  'tour_notifications_blocked',
  'not_confirmable',
  'not_whatsapp',
] as const

/** ¿El error de remind-unconfirmed es definitivo para esta notificación? */
export function isBlockingRemindError(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.status !== 400) return false
  const code = (e.data as Record<string, unknown> | null)?.code
  return typeof code === 'string' && (BLOCKING_REMIND_CODES as readonly string[]).includes(code)
}

/** Suma de confirmaciones de las notificaciones confirmables ya enviadas de una actividad. */
export function activityConfirmationSummary(
  items: Pick<
    NotificationListItem,
    'confirmable' | 'status' | 'confirmed_count' | 'recipient_count'
  >[]
): { confirmed: number; total: number } | null {
  const relevant = items.filter((n) => n.confirmable && n.status === 'sent')
  if (!relevant.length) return null
  return relevant.reduce(
    (acc, n) => ({
      confirmed: acc.confirmed + n.confirmed_count,
      total: acc.total + n.recipient_count,
    }),
    { confirmed: 0, total: 0 }
  )
}

/** Motivos de exclusión que tiene sentido explicar en el modal (los demás no aportan). */
export const EXPLAINED_EXCLUSIONS: (keyof RemindUnconfirmedExcluded)[] = [
  'too_soon',
  'max_reminders',
  'no_phone',
  'not_delivered',
]

/**
 * Mensaje para un error de `remind-unconfirmed`.
 * - 429 → texto propio de throttle.
 * - 403 por cupo (`{error, detail, usage}`) → `error: detail`.
 * - El resto, `ApiError.message` (400 trae `error`; 403 sin permiso o "Gira sin suscripción",
 *   `detail`).
 */
export function remindErrorMessage(e: unknown, throttled: string, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return throttled
    const data = e.data as Record<string, unknown> | null
    if (
      e.status === 403 &&
      data &&
      typeof data.error === 'string' &&
      typeof data.detail === 'string' &&
      data.detail
    ) {
      return `${data.error}: ${data.detail}`
    }
    return e.message || fallback
  }
  return e instanceof Error && e.message ? e.message : fallback
}
