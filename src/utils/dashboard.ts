/**
 * Funciones puras del dashboard "Hoy" (spec Paleta B §6). Sin i18n ni API: los componentes
 * traducen las claves y piden los datos.
 */
import { DateTime } from 'luxon'
import type { RouteLocationRaw } from 'vue-router'
import type { ActivityListItem } from '@/composables/useActivities'
import type { ReminderTypeSetting } from '@/composables/useReminderSettings'
import type { SubscriptionUsage } from '@/composables/useSubscription'
import type { ReportsSeriesPoint, ReportsSummary } from '@/composables/useNotificationReports'
import { browserZone } from '@/utils/datetime'

// ─── Fechas ───────────────────────────────────────────────────────────────────

function toMillis(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = DateTime.fromISO(iso).toMillis()
  return Number.isFinite(ms) ? ms : null
}

function validZone(zone: string | null | undefined): string | null {
  if (!zone) return null
  return DateTime.now().setZone(zone).isValid ? zone : null
}

/** Duración supuesta de una actividad sin `end_at` (un show que acaba de empezar sigue "en curso"). */
export const DEFAULT_DURATION_HOURS = 2

/** Actividades no canceladas con inicio válido, por hora de inicio. */
function chronological(activities: ActivityListItem[]): ActivityListItem[] {
  return activities
    .filter((a) => a.status !== 'cancelled' && toMillis(a.scheduled_at) !== null)
    .sort((a, b) => (toMillis(a.scheduled_at) ?? 0) - (toMillis(b.scheduled_at) ?? 0))
}

/** Inicio de la actividad siguiente (posterior a la suya), por uuid. */
function nextStarts(activities: ActivityListItem[]): Map<string, number | null> {
  const sorted = chronological(activities)
  const map = new Map<string, number | null>()
  sorted.forEach((a, i) => {
    const start = toMillis(a.scheduled_at)!
    const next = sorted.slice(i + 1).find((b) => (toMillis(b.scheduled_at) ?? 0) > start)
    map.set(a.uuid, next ? toMillis(next.scheduled_at) : null)
  })
  return map
}

/**
 * En curso: empezó y aún no ha terminado. Sin `end_at` se supone que dura
 * `DEFAULT_DURATION_HOURS` o hasta que empieza la siguiente (`nextStart`), lo que llegue antes.
 */
export function isOngoing(
  a: ActivityListItem,
  now: DateTime,
  nextStart: number | null = null
): boolean {
  const start = toMillis(a.scheduled_at)
  if (start === null) return false
  let end = toMillis(a.end_at)
  if (end === null) {
    end = start + DEFAULT_DURATION_HOURS * 3_600_000
    if (nextStart !== null && nextStart > start) end = Math.min(end, nextStart)
  }
  const t = now.toMillis()
  return start < t && t < end
}

/** Uuids de las actividades (no canceladas) en curso en `now`. */
export function ongoingUuids(activities: ActivityListItem[], now: DateTime): Set<string> {
  const next = nextStarts(activities)
  return new Set(
    chronological(activities)
      .filter((a) => isOngoing(a, now, next.get(a.uuid) ?? null))
      .map((a) => a.uuid)
  )
}

/**
 * Actividades no canceladas que empiezan en `[now, now + hours)` o están en curso, por hora de
 * inicio. La ventana es de instantes (UTC), así que no depende de la zona del navegador.
 */
export function upcomingWithin(
  activities: ActivityListItem[],
  now: DateTime,
  hours = 24
): ActivityListItem[] {
  const from = now.toMillis()
  const to = now.plus({ hours }).toMillis()
  const ongoing = ongoingUuids(activities, now)
  return chronological(activities).filter((a) => {
    const start = toMillis(a.scheduled_at)!
    return (start >= from && start < to) || ongoing.has(a.uuid)
  })
}

/** Zona de la actividad (la del backend) o, si no vale, la del navegador. */
export function activityZone(a: ActivityListItem): string {
  return validZone(a.timezone) ?? browserZone()
}

/** Inicio de la actividad en su zona: `local_start_time` (ISO con offset) o `scheduled_at`. */
export function activityLocalStart(a: ActivityListItem): DateTime {
  if (a.local_start_time) {
    const local = DateTime.fromISO(a.local_start_time, { setZone: true })
    if (local.isValid) return local
  }
  return DateTime.fromISO(a.scheduled_at).setZone(activityZone(a))
}

/** `HH:mm` en la zona de la actividad (la hora que ve el equipo allí). */
export function activityLocalTime(a: ActivityListItem): string {
  return activityLocalStart(a).toFormat('HH:mm')
}

/** "Hoy" / "Mañana" comparando días naturales en la zona de la actividad; `null` si otro día. */
export function relativeDay(a: ActivityListItem, now: DateTime): 'today' | 'tomorrow' | null {
  const start = activityLocalStart(a)
  const today = now.setZone(start.zone).startOf('day')
  const day = start.startOf('day')
  const diff = Math.round(day.diff(today, 'days').days)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return null
}

/**
 * Zona con la que se rotula "hoy" en la cabecera: la de la próxima actividad (o en curso) de la
 * gira; si no hay, la de la última; si la gira está vacía, la del navegador.
 */
export function dashboardZone(activities: ActivityListItem[], now: DateTime): string {
  const t = now.toMillis()
  const sorted = chronological(activities)
  const ongoing = ongoingUuids(activities, now)
  const next = sorted.find((a) => ongoing.has(a.uuid) || (toMillis(a.scheduled_at) ?? 0) >= t)
  const pick = next ?? sorted[sorted.length - 1]
  return pick ? activityZone(pick) : browserZone()
}

// ─── Cupo ─────────────────────────────────────────────────────────────────────

export const PLAN_WARNING = 80
export const PLAN_REACHED = 100

export type PlanLevel = 'unlimited' | 'ok' | 'warning' | 'reached'

export function planLevel(usage: SubscriptionUsage | null): PlanLevel | null {
  if (!usage) return null
  if (usage.is_unlimited) return 'unlimited'
  if (usage.usage_percentage >= PLAN_REACHED) return 'reached'
  if (usage.usage_percentage >= PLAN_WARNING) return 'warning'
  return 'ok'
}

/** Ancho de la barra (0-100), acotado. */
export function planBarWidth(usage: SubscriptionUsage): number {
  const pct = Number.isFinite(usage.usage_percentage) ? usage.usage_percentage : 0
  return Math.max(0, Math.min(100, pct))
}

// ─── Por resolver ─────────────────────────────────────────────────────────────

export type PendingSeverity = 'critical' | 'warning' | 'info'

export type PendingKind =
  | 'notifications-paused'
  | 'plan-reached'
  | 'plan-warning'
  | 'notices'
  | 'ai-types'
  | 'ai-suggestions'
  | 'audience'

export interface PendingItem {
  key: string
  kind: PendingKind
  severity: PendingSeverity
  /** Recuento para los plurales (avisos, IA). */
  count?: number
  /** Código de aviso de audiencia (`recipients.warnings.<code>`). */
  code?: string
  /** Tipos afectados (audiencia), en orden de aparición. */
  typeNames?: string[]
  /** Cupo. */
  percentage?: number
  plan?: string
  /** Clave i18n del botón; sin ella la fila no tiene botón. */
  ctaKey?: string
  /** Destino del botón (enlace). */
  to?: RouteLocationRaw
  /** Acción del botón en vez de enlace (p. ej. reanudar avisos desde el propio bloque). */
  action?: PendingAction
}

export type PendingAction = 'resume-notifications'

export interface PendingInput {
  isAdmin: boolean
  /** La gira tiene los avisos en pausa (`enable_notifications: false`). */
  notificationsPaused?: boolean
  usage: SubscriptionUsage | null
  /** `null` = sin dato (no admin, 403 o error). */
  pendingNotices: { uuid: string }[] | null
  aiPending: number | null
  aiSuggestions: number | null
  catalogTypes: ReminderTypeSetting[] | null
  activities: ActivityListItem[]
  now: DateTime
  /**
   * El usuario (admin de la gira) no tiene `phone_number`: en `admins_without_phone` es él quien
   * tiene que completar su perfil. Si no, es otro admin y su teléfono sale de su contacto.
   */
  selfMissingPhone?: boolean
}

const SEVERITY_ORDER: Record<PendingSeverity, number> = { critical: 0, warning: 1, info: 2 }

/** Avisos que no son un problema a resolver (solo informan del canal). */
const IGNORED_WARNINGS = new Set(['in_app_users_only'])

/**
 * Avisos de la gira, no del tipo: salen de la base por defecto (Equipo de la gira o, si falta, los
 * administradores) y se arreglan en un solo sitio. Se muestran aunque el tipo no tenga
 * actividades por delante y sin lista de tipos (con 22 tipos afectados sería ruido), pero solo
 * si viene de un tipo que de verdad avisa (mismo criterio que `notifiableCodes`).
 */
const TOUR_LEVEL_WARNINGS = new Set([
  'default_group_empty',
  'no_base_groups',
  'admins_without_phone',
])

/** El tipo tiene recordatorios efectivos (o los sustituye una regla legada). */
function isNotifiable(type: ReminderTypeSetting): boolean {
  return (type.effective_steps?.length ?? 0) > 0 || !!type.replaced_by_legacy_rule
}

/** Botón y destino de cada aviso de audiencia del catálogo. */
const AUDIENCE_CTA: Record<string, { ctaKey: string; to: RouteLocationRaw }> = {
  // Sin equipo: Mi Gira › Recordatorios con el importador abierto (`TourView` atiende
  // `?import=team` y lo ignora si no eres admin o estás en la demo).
  default_group_empty: {
    ctaKey: 'dashboard.pending.addTeam',
    to: { path: '/tour', query: { tab: 'reminders', import: 'team' } },
  },
  no_base_groups: {
    ctaKey: 'dashboard.pending.addTeam',
    to: { path: '/tour', query: { tab: 'reminders', import: 'team' } },
  },
  type_groups_empty: {
    ctaKey: 'dashboard.pending.review',
    to: { path: '/tour', query: { tab: 'reminders' } },
  },
  // Otro admin sin teléfono: el backend lo toma del contacto vinculado (o de su perfil, que no
  // podemos editar). No hay pestaña de miembros en el front: se va a Contactos.
  admins_without_phone: {
    ctaKey: 'dashboard.pending.complete',
    to: { path: '/contacts' },
  },
}
/** El que no tiene teléfono eres tú: tu perfil. */
const SELF_PHONE_TO: RouteLocationRaw = { path: '/settings', query: { tab: 'general' } }
const AUDIENCE_FALLBACK = {
  ctaKey: 'dashboard.pending.review',
  to: { path: '/tour', query: { tab: 'reminders' } },
}

const PLAN_TO: RouteLocationRaw = { path: '/settings', query: { tab: 'subscription' } }

/** Códigos de tipo con actividades futuras (o en curso) no canceladas. */
function upcomingTypeCodes(activities: ActivityListItem[], now: DateTime): Set<string> {
  const t = now.toMillis()
  const ongoing = ongoingUuids(activities, now)
  return new Set(
    chronological(activities)
      .filter((a) => (toMillis(a.scheduled_at) ?? 0) >= t || ongoing.has(a.uuid))
      .map((a) => a.activity_type_code)
  )
}

/**
 * Lista de "Por resolver", ordenada por severidad. Un no admin solo ve la pausa y el cupo. Los avisos de
 * audiencia se agrupan por código (una fila aunque afecten a varios tipos); los de la gira
 * (`TOUR_LEVEL_WARNINGS`) salen si algún tipo que avisa los trae, y los del tipo solo si avisa y
 * tiene actividades por delante.
 */
export function buildPendingItems(input: PendingInput): PendingItem[] {
  const items: PendingItem[] = []
  // Avisos en pausa: lo ven todos; el primero de los `warning` y solo el admin puede reanudar.
  if (input.notificationsPaused) {
    items.push({
      key: 'notifications-paused',
      kind: 'notifications-paused',
      severity: 'warning',
      ...(input.isAdmin
        ? { ctaKey: 'dashboard.pending.resume', action: 'resume-notifications' as const }
        : {}),
    })
  }
  const level = planLevel(input.usage)
  if (input.usage && (level === 'reached' || level === 'warning')) {
    items.push({
      key: `plan-${level}`,
      kind: level === 'reached' ? 'plan-reached' : 'plan-warning',
      severity: level === 'reached' ? 'critical' : 'warning',
      percentage: Math.round(input.usage.usage_percentage),
      plan: input.usage.plan_name,
      ctaKey: 'dashboard.pending.viewPlan',
      to: PLAN_TO,
    })
  }

  if (input.isAdmin) {
    const notices = input.pendingNotices ?? []
    if (notices.length > 0) {
      items.push({
        key: 'notices',
        kind: 'notices',
        severity: 'warning',
        count: notices.length,
        ctaKey: 'dashboard.pending.reviewAndSend',
        to: {
          path: '/tour',
          query:
            notices.length === 1
              ? { tab: 'notices', notice: notices[0].uuid }
              : { tab: 'notices' },
        },
      })
    }

    if (input.catalogTypes?.length) {
      const codes = upcomingTypeCodes(input.activities, input.now)
      const byCode = new Map<string, string[]>()
      for (const type of input.catalogTypes) {
        // Un tipo sin recordatorios no avisa a nadie: sus avisos de audiencia no importan.
        if (!isNotifiable(type)) continue
        const hasUpcoming = codes.has(type.activity_type_code)
        for (const code of type.warnings ?? []) {
          if (IGNORED_WARNINGS.has(code)) continue
          const tourLevel = TOUR_LEVEL_WARNINGS.has(code)
          // Los del tipo, además, solo si tiene actividades por delante.
          if (!tourLevel && !hasUpcoming) continue
          const names = byCode.get(code) ?? []
          if (!tourLevel && !names.includes(type.name)) names.push(type.name)
          byCode.set(code, names)
        }
      }
      for (const [code, typeNames] of byCode) {
        const cta = AUDIENCE_CTA[code] ?? AUDIENCE_FALLBACK
        const to =
          code === 'admins_without_phone' && input.selfMissingPhone ? SELF_PHONE_TO : cta.to
        items.push({
          key: `audience:${code}`,
          kind: 'audience',
          severity: 'warning',
          code,
          typeNames: typeNames.length ? typeNames : undefined,
          ctaKey: cta.ctaKey,
          to,
        })
      }
    }

    if (input.aiPending && input.aiPending > 0) {
      items.push({
        key: 'ai-types',
        kind: 'ai-types',
        severity: 'info',
        count: input.aiPending,
        ctaKey: 'dashboard.pending.review',
        to: { path: '/tour', query: { tab: 'reminders' } },
      })
    }
    if (input.aiSuggestions && input.aiSuggestions > 0) {
      items.push({
        key: 'ai-suggestions',
        kind: 'ai-suggestions',
        severity: 'info',
        count: input.aiSuggestions,
        ctaKey: 'dashboard.pending.review',
        to: { path: '/tour', query: { tab: 'reminders' } },
      })
    }
  }

  // `sort` es estable: dentro de cada severidad se respeta el orden de arriba.
  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

/** "A, B, C +2": máximo `max` nombres. */
export function joinTypeNames(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(', ')
  const extra = names.length - max
  return extra > 0 ? `${shown} +${extra}` : shown
}

// ─── Envíos ───────────────────────────────────────────────────────────────────

export interface SendsFigures {
  sent: number
  delivered: number
  failed: number
}

/** Las 3 cifras de la tarjeta: enviados, entregados (solo WhatsApp lo mide) y fallidos. */
export function sendsFigures(summary: ReportsSummary): SendsFigures {
  const t = summary.totals
  return { sent: t.sent ?? 0, delivered: t.delivered ?? 0, failed: t.failed ?? 0 }
}

export interface SendsBar {
  date: string
  sent: number
  failed: number
  /** Altura relativa al día con más envíos (0-100). */
  height: number
}

/** Una barra por día de la serie (el backend la manda con ceros), altura relativa al máximo. */
export function sendsBars(series: ReportsSeriesPoint[]): SendsBar[] {
  const max = Math.max(0, ...series.map((p) => p.sent ?? 0))
  return series.map((p) => ({
    date: p.date,
    sent: p.sent ?? 0,
    failed: p.failed ?? 0,
    height: max > 0 ? Math.round(((p.sent ?? 0) / max) * 100) : 0,
  }))
}
