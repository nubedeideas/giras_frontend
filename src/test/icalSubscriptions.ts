import type { IcalSubscription } from '@/composables/useIcalSubscriptions'
import type { Tour } from '@/types'

/** Gira del store con lo que miran las entradas de iCal (admin, estado y color). */
export function adminTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 1,
    uuid: 'T1',
    name: 'Gira 2027',
    artist_name: 'Rosalía',
    start_date: '2027-03-01',
    end_date: '2027-04-30',
    status: 'active',
    currency: 'EUR',
    color: 'rgb(255, 0, 0)',
    owner_email: 'a@b.es',
    timezone: 'Europe/Madrid',
    enable_notifications: true,
    notifications_paused_at: null,
    current_user_is_admin: true,
    ...overrides,
  }
}

/** Suscripción iCal (contrato de la spec 2026-11-23-importacion-f3-ics-ical.md, §3.9). */
export function icalSub(overrides: Partial<IcalSubscription> = {}): IcalSubscription {
  return {
    uuid: 'S1',
    provider: 'ical',
    tour: 'T1',
    tour_name: 'Gira 2027',
    name: 'Gira 2027 (iCloud)',
    url_display: 'p52-caldav.icloud.com/…/K7f2',
    sync_enabled: true,
    last_status: 'ok',
    last_error_code: '',
    error_count: 0,
    last_attempt_at: '2026-11-23T10:00:00Z',
    last_synced_at: '2026-11-23T10:00:00Z',
    next_sync_at: '2026-11-23T16:03:00Z',
    stats: {
      events_in_window: 46,
      last_new: 3,
      last_changed: 1,
      last_cancelled: 0,
      removal_guard: false,
      pending_review: false,
    },
    pending_job: null,
    created_by_name: 'Oscar',
    created_at: '2026-11-23T09:59:00Z',
    ...overrides,
  }
}

/** Error de negocio con el envoltorio de `ImportJobError` (`details.code` + extras). */
export function icalApiError(code: string, status = 400, extra: Record<string, unknown> = {}) {
  return {
    success: false,
    error: {
      message: 'Mensaje del backend',
      status_code: status,
      details: { non_field_errors: ['Mensaje del backend'], code: [code], ...extra },
    },
  }
}
