import type { RouteLocationRaw, Router } from 'vue-router'
import type { InboxItem } from '@/composables/useInbox'

/** Subconjunto de `t` de vue-i18n que usan estas funciones (puras, testeables sin montar). */
export type InboxTranslate = (
  key: string,
  named?: Record<string, string | number>,
  plural?: number
) => string

export interface InboxText {
  title: string
  body: string
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim()
}

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '') return Number(v)
  return Number.NaN
}

/**
 * Título y cuerpo de un ítem en el idioma de la UI, a partir de `kind` + `params`.
 * `message` y los kinds desconocidos usan `title`/`body` del backend tal cual (texto plano,
 * nunca HTML). Si faltan los `params` necesarios, también se cae a la copia del backend.
 */
export function formatInboxItem(item: InboxItem, t: InboxTranslate): InboxText {
  const p = item.params ?? {}
  const tour = item.tour?.name ?? ''
  const raw: InboxText = { title: item.title, body: item.body }

  switch (item.kind) {
    case 'schedule_conflict': {
      const title = t('inbox.kinds.schedule_conflict.title')
      const a = str(p.activity_a_title)
      const b = str(p.activity_b_title)
      const type = p.conflict_type
      if (!a || !b || (type !== 'overlap' && type !== 'travel_time')) {
        return { title, body: item.body }
      }
      return { title, body: t(`inbox.kinds.schedule_conflict.${type}`, { a, b }) }
    }

    case 'flight_delay': {
      const flight = str(p.flight_number)
      const delay = num(p.delay_minutes)
      if (!flight || Number.isNaN(delay)) return raw
      const prevNum = num(p.prev_delay_minutes)
      const prev = Number.isNaN(prevNum) ? 0 : prevNum
      const route = str(p.route)
      let body = t('inbox.kinds.flight_delay.body', { route, prev })
      // Sin ruta, la plantilla empezaría por ". ": se quita el "{route}. " inicial.
      if (!route) body = body.replace(/^\s*\.\s*/, '')
      const gate = str(p.gate)
      if (gate) body = `${body} ${t('inbox.kinds.flight_delay.gate', { gate })}`
      return { title: t('inbox.kinds.flight_delay.title', { flight, delay }), body }
    }

    case 'flight_cancelled':
    case 'flight_diverted': {
      const flight = str(p.flight_number)
      if (!flight) return raw
      return {
        title: t(`inbox.kinds.${item.kind}.title`, { flight }),
        body: t(`inbox.kinds.${item.kind}.body`),
      }
    }

    case 'plan_limit': {
      const percentage = num(p.percentage)
      if (Number.isNaN(percentage)) return raw
      const named = {
        percentage,
        used: str(p.used),
        limit: str(p.limit),
        plan: str(p.plan_name),
        tour,
      }
      if (percentage >= 100) {
        let body = t('inbox.kinds.plan_limit.bodyReached', named)
        // Recordatorios por tipo (D7): al 100 % los automáticos pasan a email y aviso en la app.
        const degraded = p.automatic_degraded
        if (degraded === true || degraded === 'true' || degraded === 1) {
          body = `${body} ${t('plan.automaticDegraded')}`
        }
        return { title: t('inbox.kinds.plan_limit.titleReached', named), body }
      }
      return {
        title: t('inbox.kinds.plan_limit.titleWarning', named),
        body: t('inbox.kinds.plan_limit.bodyWarning', named),
      }
    }

    case 'delivery_failed': {
      const title = t('inbox.kinds.delivery_failed.title')
      const count = num(p.failed_count)
      if (Number.isNaN(count)) return { title, body: item.body }
      return { title, body: t('inbox.kinds.delivery_failed.body', { count, tour }, count) }
    }

    case 'billing_discrepancy': {
      const title = t('inbox.kinds.billing_discrepancy.title')
      const count = num(p.new_count)
      if (Number.isNaN(count)) return { title, body: item.body }
      return { title, body: t('inbox.kinds.billing_discrepancy.body', { count }, count) }
    }

    default:
      return raw
  }
}

/** Ruta donde se resuelve el aviso, o `null` si no lleva a ningún sitio. */
export function inboxTargetLocation(item: InboxItem): RouteLocationRaw | null {
  const target = item.target
  switch (target?.type) {
    case 'activity':
      return target.activity_uuid
        ? { path: '/events', query: { activity: target.activity_uuid } }
        : null
    case 'conflict':
      return { path: '/tour', query: { tab: 'conflicts' } }
    case 'plan':
      return { path: '/settings', query: { tab: 'subscription' } }
    case 'reports':
      return { path: '/reports' }
    case 'admin_costs':
      return { path: '/admin', query: { tab: 'costs' } }
    default:
      return null
  }
}

export interface InboxToursStore {
  setActiveTourByUuid(uuid: string): boolean
}

/**
 * Si el aviso tiene destino, activa su gira (si está en la lista del usuario) y navega.
 * Sin destino no toca nada. Devuelve si hubo navegación.
 */
export async function goToInboxTarget(
  item: InboxItem,
  router: Pick<Router, 'push'>,
  toursStore: InboxToursStore
): Promise<boolean> {
  const location = inboxTargetLocation(item)
  if (!location) return false
  const tourUuid = item.target?.tour_uuid
  if (tourUuid) toursStore.setActiveTourByUuid(tourUuid)
  await router.push(location)
  return true
}
