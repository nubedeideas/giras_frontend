import { ApiError } from '@/utils/apiClient'
import type {
  Rule,
  RuleChannel,
  RuleOffsetLimits,
  RuleOptions,
  RuleRecipientsType,
  RuleTemplateOption,
  RuleTrigger,
} from '@/composables/useNotificationRules'

/**
 * Utilidades puras del editor de reglas (spec 3.6, C3). Espejo en cliente de la validación del
 * backend (tabla de B5): el backend sigue siendo la fuente de verdad y devuelve 400 con `code`.
 */

export type Translate = (key: string, named?: Record<string, unknown>) => string

// ─── Antelación ───────────────────────────────────────────────────────────────

export type OffsetUnit = 'minutes' | 'hours' | 'days'

export interface OffsetParts {
  value: number
  unit: OffsetUnit
}

const UNIT_MINUTES: Record<OffsetUnit, number> = { minutes: 1, hours: 60, days: 1440 }

/** La unidad más grande que representa los minutos sin decimales. */
export function offsetToParts(minutes: number): OffsetParts {
  const m = Math.max(0, Math.round(minutes || 0))
  if (m > 0 && m % 1440 === 0) return { value: m / 1440, unit: 'days' }
  if (m > 0 && m % 60 === 0) return { value: m / 60, unit: 'hours' }
  return { value: m, unit: 'minutes' }
}

export function partsToOffset(parts: OffsetParts): number {
  const value = Number.isFinite(parts.value) ? parts.value : 0
  return Math.round(value * UNIT_MINUTES[parts.unit])
}

/** Límites por defecto (los del backend, B5) si el catálogo aún no ha llegado. */
const DEFAULT_OFFSET_LIMITS: Record<RuleTrigger, RuleOffsetLimits> = {
  activity_created: { min: 0, max: 0, direction: 'none' },
  activity_updated: { min: 0, max: 0, direction: 'none' },
  activity_upcoming: { min: 15, max: 20160, direction: 'before' },
  notification_unconfirmed: { min: 60, max: 4320, direction: 'after' },
}

export function offsetLimits(
  trigger: RuleTrigger | string,
  options: Pick<RuleOptions, 'triggers'> | null | undefined
): RuleOffsetLimits {
  const fromOptions = options?.triggers.find((tr) => tr.code === trigger)?.offset
  if (fromOptions) return fromOptions
  return DEFAULT_OFFSET_LIMITS[trigger as RuleTrigger] ?? { min: 0, max: 0, direction: 'none' }
}

/** Antelación por defecto al elegir un disparador en el editor. */
export function defaultOffset(trigger: RuleTrigger | string): number {
  if (trigger === 'activity_upcoming') return 1440
  if (trigger === 'notification_unconfirmed') return 180
  return 0
}

/** "3 horas", "1 día", "45 minutos". */
export function formatOffset(minutes: number, t: Translate): string {
  const { value, unit } = offsetToParts(minutes)
  const singular = { minutes: 'minute', hours: 'hour', days: 'day' }[unit]
  return t(`rules.offsetFmt.${value === 1 ? singular : unit}`, { n: value })
}

// ─── Canales y destinatarios (tabla de B5) ────────────────────────────────────

const MEMBER_RECIPIENTS: RuleRecipientsType[] = ['tour_admins', 'tour_members']
const ACTIVITY_RECIPIENTS: RuleRecipientsType[] = [
  'group',
  'default_group',
  'tour_admins',
  'tour_members',
]

/**
 * Canales permitidos. `activity_updated` sin WhatsApp (no hay plantilla aprobada de cambios),
 * `notification_unconfirmed` solo WhatsApp e `in_app` solo para miembros de la gira.
 */
export function allowedChannels(
  trigger: RuleTrigger | string,
  recipientsType?: RuleRecipientsType | string | null
): RuleChannel[] {
  let channels: RuleChannel[]
  if (trigger === 'notification_unconfirmed') return ['whatsapp']
  if (trigger === 'activity_updated') channels = ['email', 'in_app']
  else if (trigger === 'activity_created' || trigger === 'activity_upcoming') {
    channels = ['whatsapp', 'email', 'in_app']
  } else return []
  if (recipientsType && !MEMBER_RECIPIENTS.includes(recipientsType as RuleRecipientsType)) {
    channels = channels.filter((c) => c !== 'in_app')
  }
  return channels
}

/** Destinatarios permitidos. Con `in_app`, solo administradores o todo el equipo. */
export function allowedRecipientTypes(
  trigger: RuleTrigger | string,
  channel?: RuleChannel | string | null
): RuleRecipientsType[] {
  if (trigger === 'notification_unconfirmed') return ['original_recipients']
  if (!(['activity_created', 'activity_updated', 'activity_upcoming'] as string[]).includes(trigger)) {
    return []
  }
  if (channel === 'in_app') return [...MEMBER_RECIPIENTS]
  return [...ACTIVITY_RECIPIENTS]
}

// ─── Plantillas ───────────────────────────────────────────────────────────────

export function isRecommendedTemplate(template: RuleTemplateOption, codes: string[]): boolean {
  if (!template.recommended_for.length) return false
  // "Todos los tipos": cualquier recomendación cuenta.
  if (!codes.length) return false
  return codes.some((c) => template.recommended_for.includes(c))
}

/**
 * Plantillas del canal compatibles con el disparador. Orden: recomendadas para los tipos
 * elegidos, después aprobadas, después del sistema, y por nombre.
 */
export function compatibleTemplates(
  options: Pick<RuleOptions, 'templates'> | null | undefined,
  trigger: RuleTrigger | string,
  channel: RuleChannel | string,
  codes: string[]
): RuleTemplateOption[] {
  if (!options) return []
  const rank = (tpl: RuleTemplateOption) =>
    (isRecommendedTemplate(tpl, codes) ? 0 : 4) + (tpl.approved ? 0 : 2) + (tpl.is_system ? 0 : 1)
  return options.templates
    .filter((tpl) => tpl.channel === channel && tpl.compatible_triggers.includes(trigger as RuleTrigger))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

export function hasApprovedTemplate(
  options: Pick<RuleOptions, 'templates'> | null | undefined,
  trigger: RuleTrigger | string,
  channel: RuleChannel | string,
  codes: string[]
): boolean {
  return compatibleTemplates(options, trigger, channel, codes).some((tpl) => tpl.approved)
}

// ─── Textos ───────────────────────────────────────────────────────────────────

/** `t()` devuelve la clave si no existe: entonces se usa el valor crudo. */
function tOr(t: Translate, key: string, fallback: string, named?: Record<string, unknown>) {
  const s = t(key, named)
  return s === key ? fallback : s
}

/** Hueco de la frase mientras el editor aún no tiene ese paso. */
const PENDING = '…'

export type RuleSummarySource = Pick<
  Rule,
  | 'trigger'
  | 'activity_type_codes'
  | 'recipients_type'
  | 'group_name'
  | 'channel'
  | 'template_name'
  | 'offset_minutes'
>

function typesLabel(codes: string[], options: RuleOptions | null | undefined, t: Translate) {
  if (!codes.length) return t('rules.summary.anyActivity')
  return codes
    .map((c) => options?.activity_types.find((at) => at.code === c)?.name ?? c)
    .join(', ')
}

function recipientsLabel(rule: RuleSummarySource, options: RuleOptions | null | undefined, t: Translate) {
  if (rule.recipients_type === 'group') {
    return rule.group_name
      ? t('rules.summary.recipients.groupNamed', { name: rule.group_name })
      : t('rules.summary.recipients.group')
  }
  if (rule.recipients_type === 'default_group' && options?.tour.default_group) {
    return t('rules.summary.recipients.groupNamed', { name: options.tour.default_group.name })
  }
  if (!rule.recipients_type) return PENDING
  return tOr(t, `rules.summary.recipients.${rule.recipients_type}`, rule.recipients_type)
}

/** La frase de la lista: "24 horas antes de Vuelo → avisar a … por WhatsApp con «…»". */
export function ruleSummary(
  rule: RuleSummarySource,
  options: RuleOptions | null | undefined,
  t: Translate
): string {
  const named = {
    types: typesLabel(rule.activity_type_codes ?? [], options, t),
    recipients: recipientsLabel(rule, options, t),
    channel: rule.channel
      ? tOr(t, `rules.summary.channels.${rule.channel}`, rule.channel)
      : PENDING,
    template: rule.template_name || PENDING,
    offset: formatOffset(rule.offset_minutes, t),
  }
  switch (rule.trigger) {
    case 'activity_created':
      return t('rules.summary.created', named)
    case 'activity_updated':
      return t('rules.summary.updated', named)
    case 'activity_upcoming':
      return t('rules.summary.upcoming', named)
    case 'notification_unconfirmed':
      return t('rules.summary.unconfirmed', named)
    default:
      return t('rules.summary.legacy', {
        ...named,
        trigger: rule.trigger
          ? tOr(t, `rules.summary.legacyTriggers.${rule.trigger}`, t('rules.summary.legacyTriggers.unknown'))
          : t('rules.summary.legacyTriggers.unknown'),
      })
  }
}

export function ruleWarningsLabel(code: string, t: Translate): string {
  return tOr(t, `rules.warnings.${code}`, code)
}

export function skipReasonLabel(reason: string, t: Translate): string {
  if (!reason) return ''
  return tOr(t, `rules.skip.${reason}`, reason)
}

/** Texto del último disparo: `''`, un `RuleOutcome` o `skipped:<reason>`. */
export function outcomeLabel(lastOutcome: string, t: Translate): string {
  if (!lastOutcome) return t('rules.list.neverFired')
  if (lastOutcome.startsWith('skipped')) {
    const reason = lastOutcome.split(':')[1] ?? ''
    if (!reason) return t('rules.outcomes.skippedPlain')
    return t('rules.outcomes.skipped', { reason: skipReasonLabel(reason, t) })
  }
  return tOr(t, `rules.outcomes.${lastOutcome}`, lastOutcome)
}

/** Mensaje de un código de error del backend (`rules.errors.<code>`), o `null` si no se conoce. */
export function ruleErrorLabel(code: string | null | undefined, t: Translate): string | null {
  if (!code) return null
  const key = `rules.errors.${code}`
  const s = t(key)
  return s === key ? null : s
}

// ─── 409 "en uso" (plantillas y grupos, B8) ───────────────────────────────────

/**
 * Mensaje del backend para un 409 `template_in_use` / `group_in_use`
 * (`details = {"template"|"group": [msg], "code": [...], "rules": [...]}`), sin depender del
 * orden de las claves. Para cualquier otro error, `e.message`.
 */
export function inUseErrorMessage(e: unknown, field: 'template' | 'group', fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 409 && e.fieldErrors) {
      const v = e.fieldErrors[field]
      const msg = Array.isArray(v) ? v.find((x) => typeof x === 'string' && x) : v
      if (typeof msg === 'string' && msg) return msg
    }
    return e.message
  }
  return e instanceof Error ? e.message : fallback
}
