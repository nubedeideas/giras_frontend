/**
 * Mapeo de estados del dominio a los 5 tonos de `StatusBadge` (Paleta B).
 * Las etiquetas siguen saliendo de STATUS_LABELS / notifStatusLabel / tours.status*.
 */
import type { ActivityStatus } from '@/composables/useActivities'
import type { TourStatus } from '@/types'

export type BadgeStatus = 'sent' | 'pending' | 'scheduled' | 'failed' | 'off'

const ACTIVITY: Record<ActivityStatus, BadgeStatus> = {
  draft: 'pending',
  scheduled: 'scheduled',
  confirmed: 'sent',
  in_progress: 'sent',
  delayed: 'pending',
  completed: 'off',
  cancelled: 'failed',
}

const NOTIFICATION: Record<string, BadgeStatus> = {
  sent: 'sent',
  scheduled: 'scheduled',
  sending: 'scheduled',
  draft: 'pending',
  pending: 'pending',
  failed: 'failed',
  cancelled: 'off',
}

const TOUR: Record<TourStatus, BadgeStatus> = {
  active: 'sent',
  draft: 'off',
  completed: 'scheduled',
  cancelled: 'failed',
}

export function activityBadge(status: ActivityStatus): BadgeStatus {
  return ACTIVITY[status] ?? 'off'
}

/** Acepta cualquier string: un estado desconocido (o futuro) cae en `off`. */
export function notificationBadge(status: string): BadgeStatus {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION, status) ? NOTIFICATION[status] : 'off'
}

export function tourBadge(status: TourStatus): BadgeStatus {
  return TOUR[status] ?? 'off'
}

/** Confianza de una fila del importador: verde ≥ 0,90, ámbar ≥ 0,70, rojo por debajo. */
export function importConfidenceBadge(confidence: number): BadgeStatus {
  if (confidence >= 0.9) return 'sent'
  if (confidence >= 0.7) return 'pending'
  return 'failed'
}

const IMPORT_JOB: Record<string, BadgeStatus> = {
  uploaded: 'scheduled',
  detecting: 'scheduled',
  extracting: 'scheduled',
  normalizing: 'scheduled',
  confirming: 'scheduled',
  ready: 'pending',
  done: 'sent',
  failed: 'failed',
  discarded: 'off',
}

/** Estado de un job de importación; uno desconocido cae en `off`. */
export function importJobBadge(status: string): BadgeStatus {
  return Object.prototype.hasOwnProperty.call(IMPORT_JOB, status) ? IMPORT_JOB[status] : 'off'
}
