import type {
  Rule,
  RuleOptions,
  RulePreset,
  RulePreview,
} from '@/composables/useNotificationRules'

/** Fixtures del editor de reglas (contrato de la spec 3.6, §5.2). */

export const TOUR = 'tour-1'

export function ruleOptions(overrides: Partial<RuleOptions> = {}): RuleOptions {
  return {
    tour: {
      uuid: TOUR,
      name: 'Gira 2026',
      default_group: { uuid: 'g-default', name: 'Equipo', contact_count: 4 },
    },
    triggers: [
      {
        code: 'activity_created',
        recipients_types: ['group', 'default_group', 'tour_admins', 'tour_members'],
        channels: ['whatsapp', 'email', 'in_app'],
        offset: { min: 0, max: 0, direction: 'none' },
      },
      {
        code: 'activity_updated',
        recipients_types: ['group', 'default_group', 'tour_admins', 'tour_members'],
        channels: ['email', 'in_app'],
        offset: { min: 0, max: 0, direction: 'none' },
      },
      {
        code: 'activity_upcoming',
        recipients_types: ['group', 'default_group', 'tour_admins', 'tour_members'],
        channels: ['whatsapp', 'email', 'in_app'],
        offset: { min: 15, max: 20160, direction: 'before' },
      },
      {
        code: 'notification_unconfirmed',
        recipients_types: ['original_recipients'],
        channels: ['whatsapp'],
        offset: { min: 60, max: 4320, direction: 'after' },
      },
    ],
    activity_types: [
      {
        code: 'flight',
        name: 'Vuelo',
        category: 'travel',
        icon: '✈',
        color: '#1a8fff',
        has_default_reminders: true,
      },
      {
        code: 'day_off',
        name: 'Día libre',
        category: 'other',
        icon: '',
        color: '#888888',
        has_default_reminders: false,
      },
    ],
    groups: [
      { uuid: 'g-1', name: 'Técnicos', tour: TOUR, contact_count: 3 },
      { uuid: 'g-empty', name: 'Vacío', tour: null, contact_count: 0 },
    ],
    templates: [
      {
        uuid: 'tpl-wa-generic',
        name: 'Recordatorio genérico',
        slug: 'whatsapp_event_reminder',
        channel: 'whatsapp',
        notification_type: 'event_reminder',
        is_system: true,
        approved: true,
        compatible_triggers: ['activity_created', 'activity_upcoming'],
        recommended_for: [],
      },
      {
        uuid: 'tpl-wa-flight',
        name: 'Vuelo',
        slug: 'whatsapp_flight_reminder',
        channel: 'whatsapp',
        notification_type: 'flight_reminder',
        is_system: true,
        approved: true,
        compatible_triggers: ['activity_created', 'activity_upcoming'],
        recommended_for: ['flight'],
      },
      {
        uuid: 'tpl-wa-nosid',
        name: 'Sin aprobar',
        slug: 'whatsapp_draft',
        channel: 'whatsapp',
        notification_type: 'event_reminder',
        is_system: false,
        approved: false,
        compatible_triggers: ['activity_created', 'activity_upcoming'],
        recommended_for: [],
      },
      {
        uuid: 'tpl-email',
        name: 'Actividad (email)',
        slug: 'rule_activity_email',
        channel: 'email',
        notification_type: 'event_reminder',
        is_system: true,
        approved: true,
        compatible_triggers: ['activity_created', 'activity_upcoming'],
        recommended_for: [],
      },
      {
        uuid: 'tpl-email-changed',
        name: 'Cambio (email)',
        slug: 'rule_activity_changed_email',
        channel: 'email',
        notification_type: 'event_updated',
        is_system: true,
        approved: true,
        compatible_triggers: ['activity_updated'],
        recommended_for: [],
      },
      {
        uuid: 'tpl-in-app',
        name: 'Actividad (app)',
        slug: 'rule_activity_in_app',
        channel: 'in_app',
        notification_type: 'event_reminder',
        is_system: true,
        approved: true,
        compatible_triggers: ['activity_created', 'activity_upcoming'],
        recommended_for: [],
      },
    ],
    limits: {
      horizon_hours: 48,
      max_rules_per_tour: 50,
      rules_in_tour: 1,
      max_reminders_per_recipient: 2,
      min_interval_minutes: 60,
    },
    plan: { whatsapp_counts_for_unconfirmed: true, remaining: 120 },
    ...overrides,
  }
}

export function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    uuid: 'rule-1',
    name: 'Vuelos 24 h',
    description: '',
    tour: TOUR,
    tour_name: 'Gira 2026',
    trigger: 'activity_upcoming',
    activity_type_codes: ['flight'],
    recipients_type: 'group',
    group: 'g-1',
    group_name: 'Técnicos',
    group_contact_count: 3,
    channel: 'whatsapp',
    template: 'tpl-wa-flight',
    template_name: 'Vuelo',
    template_is_system: true,
    offset_minutes: 1440,
    replaces_default_reminders: true,
    is_active: true,
    active_since: '2026-11-20T10:00:00Z',
    preset_key: null,
    is_editable: true,
    warnings: [],
    last_fired_at: null,
    last_outcome: '',
    created_by_name: 'Oscar',
    created_at: '2026-11-20T10:00:00Z',
    updated_at: '2026-11-20T10:00:00Z',
    ...overrides,
  }
}

export function preset(overrides: Partial<RulePreset> = {}): RulePreset {
  return {
    key: 'unconfirmed_3h',
    trigger: 'notification_unconfirmed',
    activity_type_codes: [],
    recipients_type: 'original_recipients',
    channel: 'whatsapp',
    template: null,
    offset_minutes: 180,
    available: true,
    unavailable_reason: null,
    applied_rule: null,
    applied_active: false,
    ...overrides,
  }
}

export function rulePreview(overrides: Partial<RulePreview> = {}): RulePreview {
  return {
    would_fire: true,
    skip_reason: null,
    activity: {
      uuid: 'act-1',
      title: 'Vuelo MAD-BCN',
      activity_type_code: 'flight',
      scheduled_at: '2026-12-01T09:00:00Z',
      timezone: 'Europe/Madrid',
    },
    scheduled_for: '2026-11-30T09:00:00Z',
    channel: 'whatsapp',
    rendered: null,
    whatsapp_variables: { '1': 'Ana', '2': 'Vuelo MAD-BCN' },
    recipients: [
      { name: 'Ana', contact: 'c-1', destination: '+34600000000', status: 'ok' },
      { name: 'Luis', contact: 'c-2', destination: '', status: 'no_phone' },
    ],
    counts: { ok: 1, excluded: 1 },
    overlaps: [],
    default_reminders: { count: 3, replaced: true },
    ...overrides,
  }
}

/** Vista previa de `notification_unconfirmed`: sin actividad ni `scheduled_for`. */
export function unconfirmedPreview(overrides: Partial<RulePreview> = {}): RulePreview {
  return rulePreview({
    would_fire: true,
    activity: null,
    scheduled_for: null,
    rendered: null,
    whatsapp_variables: null,
    recipients: [],
    counts: { ok: 0, excluded: 0 },
    default_reminders: { count: 0, replaced: false },
    candidates: [
      {
        notification: 'n-1',
        title: 'Vuelo MAD-BCN',
        sent_at: '2026-11-21T08:00:00Z',
        eligible: 3,
        excluded: { too_soon: 1, no_phone: 2, confirmed: 4 },
      },
    ],
    plan: { remaining: 40, counts: true },
    ...overrides,
  })
}

/** Error 400/409 envuelto del backend. */
export function wrappedError(status: number, details: Record<string, unknown>) {
  return {
    success: false,
    error: { message: 'Error en la solicitud', status_code: status, details },
  }
}
