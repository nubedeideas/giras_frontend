import type { InboxItem } from '@/composables/useInbox'

/** Ítem de inbox para tests, con valores por defecto razonables. */
export function inboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    uuid: 'i1',
    kind: 'message',
    severity: 'info',
    title: 'Título',
    body: 'Cuerpo',
    params: {},
    is_read: false,
    read_at: null,
    occurred_at: '2026-11-21T10:00:00Z',
    created_at: '2026-11-21T10:00:00Z',
    tour: { uuid: 'T1', name: 'Gira Norte' },
    target: { type: 'none', tour_uuid: 'T1', activity_uuid: null, conflict_uuid: null },
    ...overrides,
  }
}
