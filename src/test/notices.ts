import type {
  Notice,
  NoticeDetail,
  NoticePreview,
} from '@/composables/useNotices'

/** Fixtures de avisos bajo demanda (contrato de la spec 2026-11-21, §5.2, R2). */

export function notice(overrides: Partial<Notice> = {}): Notice {
  return {
    uuid: 'N1',
    tour: 'T1',
    activity: {
      uuid: 'A1',
      title: 'Vuelo MAD-BCN',
      scheduled_at: '2099-12-01T10:00:00Z',
      activity_type_code: 'flight',
    },
    origin: 'cirium_delay',
    status: 'pending',
    channel: 'whatsapp',
    template_slug: 'whatsapp_flight_alert',
    params: {
      flight_number: 'IB3456',
      route: 'MAD → BCN',
      flight_status: 'delayed',
      delay_minutes: 45,
      prev_delay_minutes: 0,
    },
    text_overrides: { flight_status: 'Retrasado 45 min (sale a las 10:45)' },
    title: 'Vuelo IB3456 con 45 min de retraso',
    message: 'Sale a las 10:45',
    expires_at: '2099-12-01T10:45:00Z',
    recipients_count: 0,
    created_at: '2026-11-21T08:00:00Z',
    sent_at: null,
    sent_by_name: null,
    closed_at: null,
    closed_by_name: null,
    close_reason: '',
    notification_uuid: null,
    ...overrides,
  }
}

export function preview(overrides: Partial<NoticePreview> = {}): NoticePreview {
  return {
    channel: 'whatsapp',
    template_slug: 'whatsapp_flight_alert',
    editable_keys: [
      { key: 'flight_status', max_length: 120, value: 'Retrasado 45 min (sale a las 10:45)' },
    ],
    rendered: null,
    variables: {
      recipient_name: 'Ana',
      activity_flight_number: 'IB3456',
      flight_status: 'Retrasado 45 min (sale a las 10:45)',
    },
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
        sources: ['default_group'],
      },
    ],
    counts: { total: 2, reachable: 1, no_phone: 1, no_email: 0, no_account: 1 },
    cost: { whatsapp: 12, cost_usd: 0.3, remaining: 120, over_quota: false },
    allowed_channels: ['whatsapp', 'email', 'in_app'],
    allowed_templates: [{ slug: 'whatsapp_flight_alert', name: 'Alerta de vuelo', approved: true }],
    ...overrides,
  }
}

export function noticeDetail(overrides: Partial<NoticeDetail> = {}): NoticeDetail {
  return {
    ...notice(),
    selection: { use_activity_audience: true, groups: [], contacts: [], excluded_contacts: [] },
    preview: preview(),
    ...overrides,
  }
}
