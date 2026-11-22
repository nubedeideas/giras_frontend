import { ApiError } from '@/utils/apiClient'

/**
 * Utilidades puras de los recordatorios por tipo (spec 2026-11-21-recordatorios-por-tipo-y-bajo-
 * demanda.md, C1.1). `validateSteps` es el espejo en cliente de `validate_steps` del backend
 * (B1.3): el backend sigue siendo la fuente de verdad y devuelve 400 con `code`.
 */

export type ReminderChannel = 'whatsapp' | 'email' | 'in_app'

export interface ReminderStep {
  minutes: number
  channel: ReminderChannel
}

export interface ReminderLimits {
  max_steps: number
  min_minutes: number
  max_minutes: number
}

export type Translate = (key: string, named?: Record<string, unknown>) => string

export const REMINDER_CHANNELS: ReminderChannel[] = ['whatsapp', 'email', 'in_app']

/** Los de `config/settings/base.py` (A1.8), por si el catálogo aún no ha llegado. */
export const DEFAULT_REMINDER_LIMITS: ReminderLimits = {
  max_steps: 5,
  min_minutes: 5,
  max_minutes: 20160,
}

// ─── Antelación ───────────────────────────────────────────────────────────────

/** "30 min", "3 h", "24 h", "2 días". Hasta 24 h se habla en horas (así se piensa en gira). */
export function formatOffset(minutes: number, t: Translate): string {
  const m = Math.max(0, Math.round(minutes || 0))
  if (m > 1440 && m % 1440 === 0) {
    const n = m / 1440
    return t(n === 1 ? 'reminders.offset.day' : 'reminders.offset.days', { n })
  }
  if (m >= 60 && m % 60 === 0) return t('reminders.offset.hours', { n: m / 60 })
  if (m > 60) {
    return t('reminders.offset.hoursMinutes', { h: Math.floor(m / 60), m: m % 60 })
  }
  return t('reminders.offset.minutes', { n: m })
}

/** "24 h por email · 3 h por WhatsApp · 1 h en la app", o "Sin recordatorios". */
export function stepsSummary(steps: ReminderStep[] | null | undefined, t: Translate): string {
  if (!steps || steps.length === 0) return t('reminders.summary.none')
  return sortSteps(steps)
    .map((s) => {
      const offset = formatOffset(s.minutes, t)
      if (REMINDER_CHANNELS.includes(s.channel)) {
        return t(`reminders.summary.byChannel.${s.channel}`, { offset })
      }
      return t('reminders.summary.step', { offset, channel: s.channel })
    })
    .join(' · ')
}

/** Pasos de mayor a menor antelación (el orden en que los guarda el backend). */
export function sortSteps(steps: ReminderStep[]): ReminderStep[] {
  return [...steps].sort((a, b) => b.minutes - a.minutes)
}

/**
 * Pasos de un tipo: `reminder_steps` o, si es `null` (filas legadas), los minutos de
 * `default_reminder_minutes` por WhatsApp (D2).
 */
export function stepsOfType(type: {
  reminder_steps?: ReminderStep[] | null
  default_reminder_minutes?: number[] | null
}): ReminderStep[] {
  if (Array.isArray(type.reminder_steps)) return sortSteps(type.reminder_steps)
  return sortSteps(
    (type.default_reminder_minutes ?? []).map((minutes) => ({ minutes, channel: 'whatsapp' }))
  )
}

export function sameSteps(a: ReminderStep[] | null, b: ReminderStep[] | null): boolean {
  if (a === null || b === null) return a === b
  if (a.length !== b.length) return false
  const sa = sortSteps(a)
  const sb = sortSteps(b)
  return sa.every((s, i) => s.minutes === sb[i].minutes && s.channel === sb[i].channel)
}

// ─── Validación (espejo de B1.3) ──────────────────────────────────────────────

export type StepErrorCode =
  | 'steps_invalid'
  | 'step_minutes_out_of_range'
  | 'step_channel_invalid'
  | 'step_minutes_duplicated'
  | 'too_many_steps'

export interface StepsValidation {
  valid: boolean
  /** Primer error, de la lista o de un paso. */
  code: StepErrorCode | null
  /** Error de cada paso, en el mismo orden que la entrada. */
  stepErrors: (StepErrorCode | null)[]
}

export function validateSteps(
  steps: unknown,
  limits: ReminderLimits = DEFAULT_REMINDER_LIMITS
): StepsValidation {
  if (!Array.isArray(steps)) return { valid: false, code: 'steps_invalid', stepErrors: [] }
  const stepErrors: (StepErrorCode | null)[] = []
  const seen = new Map<number, number>()
  steps.forEach((raw, i) => {
    const s = raw as Partial<ReminderStep> | null
    if (!s || typeof s !== 'object' || !Number.isInteger(s.minutes)) {
      stepErrors.push('steps_invalid')
      return
    }
    const minutes = s.minutes as number
    if (minutes < limits.min_minutes || minutes > limits.max_minutes) {
      stepErrors.push('step_minutes_out_of_range')
    } else if (!REMINDER_CHANNELS.includes(s.channel as ReminderChannel)) {
      stepErrors.push('step_channel_invalid')
    } else if (seen.has(minutes)) {
      stepErrors.push('step_minutes_duplicated')
    } else {
      stepErrors.push(null)
    }
    if (!seen.has(minutes)) seen.set(minutes, i)
  })
  const tooMany = steps.length > limits.max_steps
  const code: StepErrorCode | null = tooMany
    ? 'too_many_steps'
    : (stepErrors.find((e) => e !== null) ?? null)
  return { valid: code === null, code, stepErrors }
}

// ─── Canales ──────────────────────────────────────────────────────────────────

export interface ChannelMeta {
  /** Trazos SVG (viewBox 0 0 24 24, stroke). */
  iconPath: string
  colorClass: string
  bgClass: string
}

const CHANNEL_META: Record<ReminderChannel, ChannelMeta> = {
  whatsapp: {
    iconPath:
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    colorClass: 'text-wa-green',
    bgClass: 'bg-wa-green-dim',
  },
  email: {
    iconPath:
      '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    colorClass: 'text-brand-blue',
    bgClass: 'bg-brand-blue-dim',
  },
  in_app: {
    iconPath:
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    colorClass: 'text-olive',
    bgClass: 'bg-acid-dim',
  },
}

export function channelMeta(channel: ReminderChannel | string): ChannelMeta {
  return (
    CHANNEL_META[channel as ReminderChannel] ?? {
      iconPath: '<circle cx="12" cy="12" r="9"/>',
      colorClass: 'text-ink-3',
      bgClass: 'bg-glass-2',
    }
  )
}

// ─── Unidades del editor ──────────────────────────────────────────────────────

export type OffsetUnit = 'minutes' | 'hours' | 'days'

const UNIT_MINUTES: Record<OffsetUnit, number> = { minutes: 1, hours: 60, days: 1440 }

/** La unidad más grande que representa los minutos sin decimales. */
export function minutesToParts(minutes: number): { value: number; unit: OffsetUnit } {
  const m = Math.max(0, Math.round(minutes || 0))
  if (m > 0 && m % 1440 === 0 && m > 1440) return { value: m / 1440, unit: 'days' }
  if (m > 0 && m % 60 === 0) return { value: m / 60, unit: 'hours' }
  return { value: m, unit: 'minutes' }
}

export function partsToMinutes(value: number, unit: OffsetUnit): number {
  const v = Number.isFinite(value) ? value : 0
  return Math.round(v * UNIT_MINUTES[unit])
}

/** Antelación de un paso nuevo: la primera habitual que no esté ya en la lista. */
export function nextStepMinutes(steps: ReminderStep[]): number {
  const used = new Set(steps.map((s) => s.minutes))
  for (const m of [60, 1440, 180, 30, 120, 240, 15, 720, 2880]) {
    if (!used.has(m)) return m
  }
  let m = 5
  while (used.has(m)) m += 5
  return m
}

// ─── Errores ──────────────────────────────────────────────────────────────────

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v || null
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = firstString(item)
      if (s) return s
    }
  }
  return null
}

/** `code` de un error envuelto (`details = {"<campo>": [...], "code": ["<code>"]}`), o `null`. */
export function apiErrorCode(e: unknown): string | null {
  if (!(e instanceof ApiError) || !e.fieldErrors) return null
  return firstString(e.fieldErrors.code)
}

export interface ReminderErrorOptions {
  /**
   * Carga del catálogo de la gira o de `resolve`: un 404 significa que la gira o la actividad ya
   * no es visible y se trata como "no eres admin". En acciones (DELETE/PATCH) un 404 es que el
   * recurso ya no existe: se muestra el mensaje del backend y el llamador recarga.
   */
  load?: boolean
}

/**
 * Mensaje en el idioma de la UI para un error de las APIs de recordatorios: el del `code`
 * (`reminders.errors.<code>`), el de 403 (y 404 en cargas), el de 429 o el del backend.
 */
export function reminderErrorMessage(
  e: unknown,
  t: Translate,
  fallbackKey: string,
  { load = false }: ReminderErrorOptions = {}
): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return t('common.tooManyRequests')
    if (e.status === 403 || (load && e.status === 404)) return t('reminders.errors.notAdmin')
    const code = apiErrorCode(e)
    if (code) {
      const key = `reminders.errors.${code}`
      const s = t(key)
      if (s !== key) return s
    }
    return e.message || t(fallbackKey)
  }
  return e instanceof Error && e.message ? e.message : t(fallbackKey)
}

/** 403/404 de la gira: el usuario ya no la administra o ya no la ve. */
export function isForbidden(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 403 || e.status === 404)
}

/** Aviso de audiencia (`recipients.warnings.<code>`); el código tal cual si no se conoce. */
export function recipientWarningLabel(code: string, t: Translate): string {
  const key = `recipients.warnings.${code}`
  const s = t(key)
  return s === key ? code : s
}
