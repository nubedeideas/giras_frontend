import { vi } from 'vitest'
import { jsonResponse } from '@/test/http'
import type {
  GroupSummary,
  ReminderCatalog,
  ReminderTypeSetting,
} from '@/composables/useReminderSettings'
import type { ActivityAudience } from '@/composables/useRecipientOverrides'

/** Fixtures de recordatorios por tipo (contrato de la spec 2026-11-21, §5.2). */

export const TOUR = 'T1'

export function group(overrides: Partial<GroupSummary> = {}): GroupSummary {
  return {
    uuid: 'g-team',
    name: 'Equipo de la gira',
    contact_count: 12,
    system_key: 'tour_team',
    is_default: true,
    ...overrides,
  }
}

export function typeSetting(overrides: Partial<ReminderTypeSetting> = {}): ReminderTypeSetting {
  const template = [
    { minutes: 1440, channel: 'email' as const },
    { minutes: 180, channel: 'whatsapp' as const },
    { minutes: 60, channel: 'in_app' as const },
  ]
  return {
    activity_type_code: 'flight',
    name: 'Vuelo',
    category: 'logistics',
    icon: 'plane',
    color: '#1a8fff',
    template_steps: template,
    tour_steps: null,
    effective_steps: template,
    steps_source: 'user',
    groups: [],
    base_source: 'default_group',
    replaced_by_legacy_rule: false,
    warnings: [],
    ...overrides,
  }
}

export function catalog(overrides: Partial<ReminderCatalog> = {}): ReminderCatalog {
  return {
    tour: { uuid: TOUR, name: 'Gira 2026' },
    default_group: group(),
    groups: [
      group(),
      group({
        uuid: 'g-tech',
        name: 'Técnicos',
        contact_count: 4,
        system_key: null,
        is_default: false,
      }),
    ],
    types: [typeSetting()],
    limits: { max_steps: 5, min_minutes: 5, max_minutes: 20160 },
    plan: { limit: 500, used: 100, remaining: 400, percentage: 20, is_unlimited: false },
    estimate: {
      activities: 80,
      whatsapp: 840,
      email: 240,
      in_app: 18,
      cost_usd: 21,
      first_send_at: '2026-12-01T08:00:00Z',
      approximate: true,
    },
    ...overrides,
  }
}

export function audience(overrides: Partial<ActivityAudience> = {}): ActivityAudience {
  return {
    activity: {
      uuid: 'A1',
      title: 'Vuelo MAD-BCN',
      activity_type_code: 'flight',
      scheduled_at: '2026-12-01T10:00:00Z',
    },
    effective_steps: [
      { minutes: 1440, channel: 'email' },
      { minutes: 180, channel: 'whatsapp' },
    ],
    steps_source: 'user',
    base_source: 'default_group',
    base_groups: [group()],
    people: [
      {
        contact_uuid: 'c-1',
        name: 'Ana Pérez',
        has_phone: true,
        has_email: true,
        has_account: false,
        sources: ['default_group'],
      },
      {
        contact_uuid: 'c-2',
        name: 'Luis Gil',
        has_phone: false,
        has_email: true,
        has_account: true,
        sources: ['group:g-team', 'added'],
      },
    ],
    overrides: [],
    suggestions: [],
    warnings: [],
    ...overrides,
  }
}

/** Error envuelto del backend con `details.code`. */
export function wrappedError(status: number, code: string, field = 'steps', message = 'Error') {
  return jsonResponse(
    {
      success: false,
      error: { message, status_code: status, details: { [field]: [message], code: [code] } },
    },
    status
  )
}

export type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>

export function stubFetch(handler: Handler) {
  const fn = vi.fn<typeof fetch>(async (input, init) => handler(new URL(String(input)), init))
  vi.stubGlobal('fetch', fn)
  return fn
}

/** jsdom no trae `matchMedia` (lo usa `useIsMobile`). */
export function stubMatchMedia(matches = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
}
