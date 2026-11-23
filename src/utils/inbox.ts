import type { RouteLocationRaw, Router } from 'vue-router'
import { DateTime } from 'luxon'
import type { InboxItem } from '@/composables/useInbox'
import { calendarCountsText, icalErrorKey } from '@/utils/icalSubscriptions'

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

/** `params.reason` de `plan_limit` sin porcentaje → sufijo de sus claves `title*`/`body*`. */
const PLAN_LIMIT_REASON_KEYS: Record<string, string> = {
  plan_limit_unavailable: 'Unavailable',
  notice_blocked: 'NoticeBlocked',
  notice_quota_unavailable: 'NoticeQuotaUnavailable',
}

function truthy(v: unknown): boolean {
  return v === true || v === 'true' || v === 1
}

/** Fecha y hora cortas de un ISO (en `zone` si es válida; si no, la del navegador). */
function shortDateTime(iso: string, locale: string, zone?: string): string {
  let d = DateTime.fromISO(iso)
  if (!d.isValid) return ''
  if (zone) {
    const z = d.setZone(zone)
    if (z.isValid) d = z
  }
  return d
    .setLocale(locale === 'en' ? 'en-GB' : 'es-ES')
    .toLocaleString({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * Título y cuerpo de un ítem en el idioma de la UI, a partir de `kind` + `params`.
 * `message` y los kinds desconocidos usan `title`/`body` del backend tal cual (texto plano,
 * nunca HTML). Si faltan los `params` necesarios, también se cae a la copia del backend.
 * `tourTimezone` es la zona de la gira del ítem si está en el store (para fechas que el backend
 * no acompaña de zona, como el primer envío de `import_done`).
 */
export function formatInboxItem(
  item: InboxItem,
  t: InboxTranslate,
  locale: string = 'es',
  tourTimezone?: string | null
): InboxText {
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

    case 'flight_early': {
      const flight = str(p.flight_number)
      const minutes = num(p.minutes ?? p.departure_shift_minutes)
      if (!flight || Number.isNaN(minutes)) return raw
      const route = str(p.route)
      let body = t('inbox.kinds.flight_early.body', { route })
      if (!route) body = body.replace(/^\s*\.\s*/, '')
      return {
        title: t('inbox.kinds.flight_early.title', { flight, minutes: Math.abs(minutes) }),
        body,
      }
    }

    case 'plan_limit': {
      // Sin porcentaje: el limitador no responde, o un aviso bajo demanda se cerró por cupo.
      // Los ítems de aviso llevan `notice_uuid` y el backend los enlaza al aviso (target notice).
      const special = PLAN_LIMIT_REASON_KEYS[str(p.reason)]
      if (special) {
        return {
          title: t(`inbox.kinds.plan_limit.title${special}`, { tour }),
          body: t(`inbox.kinds.plan_limit.body${special}`, { tour }),
        }
      }
      // Suscripción no activa (p. ej. pendiente de pago): sin porcentaje.
      if (p.reason === 'subscription_inactive') {
        const named = { plan: str(p.plan_name), tour }
        return {
          title: t('inbox.kinds.plan_limit.titleInactive', named),
          body: t('inbox.kinds.plan_limit.bodyInactive', named),
        }
      }
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

    case 'import_done': {
      // F2 §3.9: `params = {job_uuid, created, replaced, reminders, first_send_at, paused}`, sin
      // zona: la hora del primer envío va en la de la gira (store) o, sin ella, el cuerpo del
      // backend (que ya la formatea en la zona de la gira).
      const created = num(p.created)
      if (Number.isNaN(created)) return raw
      const replacedRaw = num(p.replaced)
      const replaced = Number.isNaN(replacedRaw) ? 0 : replacedRaw
      // F3: actividades canceladas desde un borrador de calendario (`params.cancelled`, 0 en F2).
      const cancelledRaw = num(p.cancelled)
      const cancelled = Number.isNaN(cancelledRaw) ? 0 : cancelledRaw
      // Solo sustituciones (o solo cancelaciones): el título las cuenta a ellas (no "0 creadas").
      let title: string
      if (created === 0 && replaced === 0 && cancelled > 0) {
        title = t('inbox.kinds.import_done.titleCancelled', { cancelled }, cancelled)
      } else {
        title =
          created === 0 && replaced > 0
            ? t('inbox.kinds.import_done.titleReplaced', { replaced }, replaced)
            : t('inbox.kinds.import_done.title', { created }, created)
        if (cancelled > 0) {
          title = `${title} ${t('inbox.kinds.import_done.cancelled', { k: cancelled }, cancelled)}`
        }
      }
      const also =
        created > 0 && replaced > 0
          ? `${t('inbox.kinds.import_done.alsoReplaced', { replaced }, replaced)} `
          : ''
      if (truthy(p.paused)) return { title, body: also + t('inbox.kinds.import_done.bodyPaused') }
      const reminders = num(p.reminders)
      if (Number.isNaN(reminders)) return { title, body: item.body }
      const first = str(p.first_send_at)
      if (reminders <= 0 || !first) {
        return { title, body: also + t('inbox.kinds.import_done.bodyNone') }
      }
      const zone = str(p.timezone) || str(tourTimezone)
      const date = zone ? shortDateTime(first, locale, zone) : ''
      if (!date) return { title, body: item.body }
      return {
        title,
        body: also + t('inbox.kinds.import_done.body', { reminders, date }, reminders),
      }
    }

    case 'import_pending': {
      // F3 §3.10: `params = {job_uuid, calendar, new, changed, cancelled, source,
      // subscription_uuid?}`. `calendar` puede venir vacío: "tu calendario".
      const calendar = str(p.calendar) || t('inbox.kinds.import_pending.fallbackCalendar')
      const counts = { new: num(p.new), changed: num(p.changed), cancelled: num(p.cancelled) }
      if (Object.values(counts).some((n) => Number.isNaN(n))) return raw
      const n = counts.new + counts.changed + counts.cancelled
      // Solo los recuentos mayores que 0, con plural (como el cuerpo del backend).
      return {
        title: t('inbox.kinds.import_pending.title', { calendar, n }),
        body: calendarCountsText(t, counts) || item.body,
      }
    }

    case 'ical_sync_failed': {
      // F3 §3.10: `params = {subscription_uuid, calendar, error_code}`; el motivo, traducido con la
      // tabla de §3.8.1 (cualquier `http_5xx` → conexión). Sin nombre: "tu calendario".
      if (!str(p.subscription_uuid) && !str(p.error_code) && !str(p.calendar)) return raw
      const calendar = str(p.calendar)
      const reason = t(icalErrorKey(str(p.error_code)))
      return {
        title: calendar
          ? t('inbox.kinds.ical_sync_failed.title', { calendar })
          : t('inbox.kinds.ical_sync_failed.titleUnnamed'),
        body: t('inbox.kinds.ical_sync_failed.body', { reason }),
      }
    }

    default:
      return raw
  }
}

/** Ruta donde se resuelve el aviso, o `null` si no lleva a ningún sitio. */
export function inboxTargetLocation(item: InboxItem): RouteLocationRaw | null {
  // F2: `import_done` lleva a la revisión del job (el backend no le da un `target` propio); F3:
  // `import_pending` (cambios de un calendario iCal) también.
  if (item.kind === 'import_done' || item.kind === 'import_pending') {
    const job = str(item.params?.job_uuid)
    return job ? { name: 'tour-import', params: { jobUuid: job } } : null
  }
  // F3: un calendario que no se puede leer se arregla en Ajustes › Calendarios.
  if (item.kind === 'ical_sync_failed') return { path: '/settings', query: { tab: 'calendars' } }
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
    case 'notice': {
      const notice = target.notice_uuid ?? item.params?.notice_uuid
      return notice
        ? { path: '/tour', query: { tab: 'notices', notice: String(notice) } }
        : { path: '/tour', query: { tab: 'notices' } }
    }
    default:
      return null
  }
}

/** El ítem lleva a un borrador de aviso que hay que revisar y enviar (R2). */
export function isNoticeTarget(item: InboxItem): boolean {
  // Un aviso cerrado por cupo (`plan_limit` con `notice_uuid`) lleva al aviso, pero ya no se
  // puede enviar: no se ofrece "Revisar y enviar".
  return item.target?.type === 'notice' && item.kind !== 'plan_limit'
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
  // `import_done`/`import_pending` llegan con `target.type="none"`: su gira es la del ítem.
  const isImport = item.kind === 'import_done' || item.kind === 'import_pending'
  const tourUuid = item.target?.tour_uuid || (isImport ? item.tour?.uuid : undefined)
  if (tourUuid) toursStore.setActiveTourByUuid(tourUuid)
  await router.push(location)
  return true
}
