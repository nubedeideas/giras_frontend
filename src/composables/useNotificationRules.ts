import { ApiError, apiClient, buildQuery, type FieldErrors } from '@/utils/apiClient'
import type { Paginated } from '@/types'
import type { ActivityListItem } from '@/composables/useActivities'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/notifications/rules/ (spec 2026-11-21-bloque3-6-editor-reglas.md, §5.2).
// `tour`, `template` y `group` son uuid.

export type RuleTrigger =
  | 'activity_created'
  | 'activity_updated'
  | 'activity_upcoming'
  | 'notification_unconfirmed'
export type RuleRecipientsType =
  | 'group'
  | 'default_group'
  | 'tour_admins'
  | 'tour_members'
  | 'original_recipients'
export type RuleChannel = 'whatsapp' | 'email' | 'in_app'
export type RuleOutcome = 'scheduled' | 'queued' | 'reminded' | 'skipped' | 'cancelled'
export type RuleWarning =
  | 'group_unavailable'
  | 'group_empty'
  | 'template_unavailable'
  | 'template_not_approved'
  | 'activity_type_unknown'
  | 'default_group_missing'

export const RULE_TRIGGERS: RuleTrigger[] = [
  'activity_created',
  'activity_updated',
  'activity_upcoming',
  'notification_unconfirmed',
]

/** Shape de GET /api/notifications/rules/ (lista paginada) y GET /rules/{uuid}/ (detalle). */
export interface Rule {
  uuid: string
  name: string
  description: string
  /** `null` solo en reglas globales antiguas. */
  tour: string | null
  tour_name: string | null
  /** `string`: disparador antiguo (`is_editable=false`). */
  trigger: RuleTrigger | string
  activity_type_codes: string[]
  recipients_type: RuleRecipientsType | string
  group: string | null
  group_name: string | null
  group_contact_count: number | null
  /** Canal efectivo (el de la plantilla si la regla no tiene). */
  channel: RuleChannel | string
  template: string | null
  template_name: string | null
  template_is_system: boolean | null
  offset_minutes: number
  replaces_default_reminders: boolean
  is_active: boolean
  /** ISO UTC. */
  active_since: string | null
  preset_key: string | null
  is_editable: boolean
  warnings: (RuleWarning | string)[]
  last_fired_at: string | null
  /** `''` | RuleOutcome | `skipped:<reason>`. */
  last_outcome: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

/** Body de POST /rules/ y PATCH /rules/{uuid}/ (`tour` solo en el alta: es inmutable). */
export interface RuleWrite {
  name: string
  description?: string
  tour: string
  trigger: RuleTrigger
  activity_type_codes?: string[]
  recipients_type: RuleRecipientsType
  group?: string | null
  channel: RuleChannel
  template?: string | null
  offset_minutes?: number
  replaces_default_reminders?: boolean
  is_active?: boolean
}

export type RuleUpdate = Partial<Omit<RuleWrite, 'tour'>>

/**
 * Body de POST /rules/preview/: el borrador más, opcionalmente, la actividad y la regla que se
 * está editando (`rule`, para que sus propias notificaciones no cuenten como solape).
 */
export type RulePreviewDraft = RuleWrite & { activity?: string; rule?: string }

/** Estados de actividad que pueden disparar una regla (ELIGIBLE_ACTIVITY_STATUSES del backend). */
export const RULE_ELIGIBLE_ACTIVITY_STATUSES = ['scheduled', 'confirmed', 'delayed']

export interface RuleOffsetLimits {
  min: number
  max: number
  direction: 'none' | 'before' | 'after'
}

export interface RuleOptionsTrigger {
  code: RuleTrigger
  recipients_types: RuleRecipientsType[]
  channels: RuleChannel[]
  offset: RuleOffsetLimits
}

export interface RuleActivityTypeOption {
  code: string
  name: string
  category: string
  icon: string
  color: string
  has_default_reminders: boolean
}

export interface RuleGroupOption {
  uuid: string
  name: string
  tour: string | null
  contact_count: number
}

export interface RuleTemplateOption {
  uuid: string
  name: string
  slug: string
  channel: RuleChannel
  notification_type: string
  is_system: boolean
  approved: boolean
  compatible_triggers: RuleTrigger[]
  recommended_for: string[]
}

/** Shape de GET /rules/options/?tour=<uuid> (catálogo del editor). */
export interface RuleOptions {
  tour: {
    uuid: string
    name: string
    default_group: { uuid: string; name: string; contact_count: number } | null
  }
  triggers: RuleOptionsTrigger[]
  activity_types: RuleActivityTypeOption[]
  groups: RuleGroupOption[]
  templates: RuleTemplateOption[]
  limits: {
    horizon_hours: number
    max_rules_per_tour: number
    rules_in_tour: number
    max_reminders_per_recipient: number
    min_interval_minutes: number
  }
  /** `remaining = -1`: ilimitado. */
  plan: { whatsapp_counts_for_unconfirmed: boolean; remaining: number }
}

export type RulePreviewRecipientStatus = 'ok' | 'no_phone' | 'no_email' | 'no_account' | 'overlap'

export interface RulePreviewRecipient {
  name: string
  /** uuid del contacto, si lo hay. */
  contact: string | null
  /** Teléfono, email o nombre del usuario; `''` si no hay. */
  destination: string
  status: RulePreviewRecipientStatus
}

export interface RulePreviewCandidate {
  notification: string
  title: string
  sent_at: string
  eligible: number
  excluded: Record<string, number>
}

/** Shape de POST /rules/preview/ y POST /rules/{uuid}/preview/. */
export interface RulePreview {
  would_fire: boolean
  skip_reason: string | null
  activity: {
    uuid: string
    title: string
    activity_type_code: string
    scheduled_at: string
    timezone: string
  } | null
  /** ISO UTC. */
  scheduled_for: string | null
  channel: RuleChannel
  /** Email e in_app. */
  rendered: { title: string; message: string } | null
  /** WhatsApp: `{"1": "...", ...}`. */
  whatsapp_variables: Record<string, string> | null
  recipients: RulePreviewRecipient[]
  counts: { ok: number; excluded: number }
  overlaps: { rule: string; name: string; scheduled_for: string }[]
  default_reminders: { count: number; replaced: boolean }
  /** Solo `notification_unconfirmed`. */
  candidates?: RulePreviewCandidate[]
  plan?: { remaining: number; counts: boolean }
}

/** Shape de GET /rules/presets/?tour=<uuid> (sin paginar). */
export interface RulePreset {
  key: string
  trigger: RuleTrigger
  activity_type_codes: string[]
  recipients_type: RuleRecipientsType
  channel: RuleChannel
  /** uuid resuelto por slug, o `null`. */
  template: string | null
  offset_minutes: number
  available: boolean
  /** `'template_not_approved'` | `'template_unavailable'`. */
  unavailable_reason: string | null
  applied_rule: string | null
  applied_active: boolean
}

export interface ListRulesParams {
  trigger?: string
  is_active?: boolean
  channel?: string
  search?: string
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

/**
 * Error 400/409 de la API de reglas con `details = {"<campo>": [msg], "code": ["<code>"]}`.
 * `code` sale de `details.code[0]`; `fieldErrors` no incluye `code` ni `rules`.
 */
export class RuleApiError extends ApiError {
  readonly code: string | null
  readonly fieldErrors: FieldErrors

  constructor(source: ApiError) {
    super(source.status, source.data, { fallback: 'Error de validación' })
    this.name = 'RuleApiError'
    const details: FieldErrors = source.fieldErrors ?? {}
    this.code = firstString(details.code)
    const fields: FieldErrors = {}
    for (const [k, v] of Object.entries(details)) {
      if (k !== 'code' && k !== 'rules') fields[k] = v
    }
    this.fieldErrors = fields
    // El mensaje es el del primer campo, nunca el `code` técnico.
    const fieldMessage = Object.values(fields).map(firstString).find(Boolean)
    if (fieldMessage) this.message = fieldMessage
  }

  /** Primer mensaje del campo, o `null`. */
  fieldMessage(field: string): string | null {
    return firstString(this.fieldErrors[field])
  }
}

function toRuleError(e: unknown): unknown {
  if (e instanceof ApiError && (e.status === 400 || e.status === 409) && e.fieldErrors) {
    return new RuleApiError(e)
  }
  return e
}

async function wrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p
  } catch (e) {
    throw toRuleError(e)
  }
}

// ─── Composable ───────────────────────────────────────────────────────────────

const BASE = '/notifications/rules/'

export function useNotificationRules() {
  function listRules(tourUuid: string, params: ListRulesParams = {}): Promise<Rule[]> {
    const qs = buildQuery({ tour: tourUuid, page_size: 100, ...params })
    return apiClient.getAll<Rule>(`${BASE}?${qs}`, { fallback: 'Error al cargar las reglas' })
  }

  function getRule(uuid: string): Promise<Rule> {
    return apiClient.get<Rule>(`${BASE}${uuid}/`, { fallback: 'Error al cargar la regla' })
  }

  function createRule(payload: RuleWrite): Promise<Rule> {
    return wrap(apiClient.post<Rule>(BASE, payload, { fallback: 'Error al crear la regla' }))
  }

  function updateRule(uuid: string, payload: RuleUpdate): Promise<Rule> {
    return wrap(
      apiClient.patch<Rule>(`${BASE}${uuid}/`, payload, {
        fallback: 'Error al guardar la regla',
      })
    )
  }

  function deleteRule(uuid: string): Promise<void> {
    return wrap(
      apiClient.delete(`${BASE}${uuid}/`, { fallback: 'Error al borrar la regla' })
    )
  }

  /** Sin `isActive`, el backend invierte el estado. */
  function toggleRule(uuid: string, isActive?: boolean): Promise<Rule> {
    const body = isActive === undefined ? {} : { is_active: isActive }
    return wrap(
      apiClient.post<Rule>(`${BASE}${uuid}/toggle/`, body, {
        fallback: 'Error al cambiar el estado de la regla',
      })
    )
  }

  function duplicateRule(uuid: string): Promise<Rule> {
    return wrap(
      apiClient.post<Rule>(`${BASE}${uuid}/duplicate/`, {}, {
        fallback: 'Error al duplicar la regla',
      })
    )
  }

  function getOptions(tourUuid: string): Promise<RuleOptions> {
    return apiClient.get<RuleOptions>(`${BASE}options/?${buildQuery({ tour: tourUuid })}`, {
      fallback: 'Error al cargar las opciones de reglas',
    })
  }

  function previewDraft(payload: RulePreviewDraft): Promise<RulePreview> {
    return wrap(
      apiClient.post<RulePreview>(`${BASE}preview/`, payload, {
        fallback: 'Error al generar la vista previa',
      })
    )
  }

  function previewRule(uuid: string, activityUuid?: string): Promise<RulePreview> {
    const body = activityUuid ? { activity: activityUuid } : {}
    return wrap(
      apiClient.post<RulePreview>(`${BASE}${uuid}/preview/`, body, {
        fallback: 'Error al generar la vista previa',
      })
    )
  }

  function listPresets(tourUuid: string): Promise<RulePreset[]> {
    return apiClient.get<RulePreset[]>(`${BASE}presets/?${buildQuery({ tour: tourUuid })}`, {
      fallback: 'Error al cargar las reglas sugeridas',
    })
  }

  function applyPreset(tourUuid: string, key: string): Promise<Rule> {
    return wrap(
      apiClient.post<Rule>(`${BASE}presets/apply/`, { tour: tourUuid, key }, {
        fallback: 'Error al activar la regla sugerida',
      })
    )
  }

  /**
   * Próximas actividades elegibles de la gira para el selector de la vista previa
   * (GET /events/activities/, filtrado en el backend por tipo y estado). Con varios tipos, una
   * petición por código (el filtro `activity_type_code` es de un solo valor).
   */
  async function listPreviewActivities(
    tourUuid: string,
    codes: string[] = [],
    limit = 20
  ): Promise<ActivityListItem[]> {
    const fetchPage = (code?: string) => {
      const q = new URLSearchParams({
        tour: tourUuid,
        upcoming: 'true',
        ordering: 'scheduled_at',
        page_size: String(limit),
      })
      if (code) q.set('activity_type_code', code)
      for (const st of RULE_ELIGIBLE_ACTIVITY_STATUSES) q.append('status', st)
      return apiClient
        .get<Paginated<ActivityListItem>>(`/events/activities/?${q}`, {
          fallback: 'Error al cargar actividades',
        })
        .then((page) => page?.results ?? [])
    }
    const pages = await Promise.all(codes.length ? codes.map((c) => fetchPage(c)) : [fetchPage()])
    const seen = new Set<string>()
    return pages
      .flat()
      .filter((a) => !seen.has(a.uuid) && seen.add(a.uuid))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0, limit)
  }

  return {
    listPreviewActivities,
    listRules,
    getRule,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    duplicateRule,
    getOptions,
    previewDraft,
    previewRule,
    listPresets,
    applyPreset,
  }
}
