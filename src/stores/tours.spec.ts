import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { jsonResponse, mockFetch } from '@/test/http'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from './tours'
import type { AuthUser } from '@/stores/auth'

function listItem(uuid: string, extra: Record<string, unknown> = {}) {
  return {
    uuid,
    name: uuid,
    artist_name: 'A',
    start_date: '2026-11-01',
    end_date: '2026-12-01',
    status: 'active',
    status_display: 'Activa',
    spotify_image_url: null,
    members_count: 1,
    events_count: 0,
    duration_days: 30,
    owner_email: 'owner@giras.pro',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...extra,
  }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

describe('tours store: current_user_is_admin (C1)', () => {
  it('lo toma del listado y, si no viene, usa el owner como respaldo', async () => {
    useAuthStore().user = { email: 'owner@giras.pro' } as AuthUser
    mockFetch(
      jsonResponse({
        count: 3,
        next: null,
        previous: null,
        results: [
          listItem('T1', { current_user_is_admin: true, owner_email: 'otro@giras.pro' }),
          listItem('T2', { current_user_is_admin: false }),
          listItem('T3'),
        ],
      })
    )
    const store = useToursStore()
    await store.loadTours()
    expect(store.tours.map((t) => [t.uuid, t.current_user_is_admin])).toEqual([
      ['T1', true],
      ['T2', false],
      ['T3', true],
    ])
  })

  it('conserva el valor anterior tras un PATCH que no lo trae', async () => {
    useAuthStore().user = { email: 'yo@giras.pro' } as AuthUser
    mockFetch(
      jsonResponse({
        count: 1,
        next: null,
        previous: null,
        results: [listItem('T1', { current_user_is_admin: true })],
      }),
      jsonResponse(listItem('T1', { name: 'Nuevo' }))
    )
    const store = useToursStore()
    await store.loadTours()
    await store.updateTour('T1', { name: 'Nuevo' })
    expect(store.tours[0].name).toBe('Nuevo')
    expect(store.tours[0].current_user_is_admin).toBe(true)
  })
})

describe('tours store: pausar avisos (F0 A1)', () => {
  function page(results: unknown[]) {
    return jsonResponse({ count: results.length, next: null, previous: null, results })
  }

  it('mapTour toma timezone y el estado de la pausa del listado, con respaldos', async () => {
    mockFetch(
      page([
        listItem('T1', {
          timezone: 'America/Bogota',
          enable_notifications: false,
          notifications_paused_at: '2026-11-22T10:00:00Z',
        }),
        listItem('T2'),
      ])
    )
    const store = useToursStore()
    await store.loadTours()
    expect(store.tours[0]).toMatchObject({
      timezone: 'America/Bogota',
      enable_notifications: false,
      notifications_paused_at: '2026-11-22T10:00:00Z',
    })
    expect(store.tours[1]).toMatchObject({
      timezone: 'Europe/Madrid',
      enable_notifications: true,
      notifications_paused_at: null,
    })
  })

  it('pauseNotifications y resumeNotifications actualizan la gira en tours y activeTour', async () => {
    const fn = mockFetch(
      page([listItem('T1', { enable_notifications: true, notifications_paused_at: null })]),
      jsonResponse({
        enable_notifications: false,
        notifications_paused_at: '2026-11-22T10:00:00Z',
        changed: true,
        held: 4,
      }),
      jsonResponse({
        enable_notifications: true,
        notifications_paused_at: null,
        changed: true,
        cancelled: 1,
        released: 3,
      })
    )
    const store = useToursStore()
    await store.loadTours()
    store.setActiveTourByUuid('T1')

    const paused = await store.pauseNotifications('T1')
    expect(paused.held).toBe(4)
    expect(String(fn.mock.calls[1][0])).toContain('/tours/T1/pause-notifications/')
    expect(fn.mock.calls[1][1]?.method).toBe('POST')
    expect(store.activeTour?.enable_notifications).toBe(false)
    expect(store.tours[0].notifications_paused_at).toBe('2026-11-22T10:00:00Z')

    const resumed = await store.resumeNotifications('T1')
    expect(resumed.cancelled).toBe(1)
    expect(String(fn.mock.calls[2][0])).toContain('/tours/T1/resume-notifications/')
    expect(store.activeTour?.enable_notifications).toBe(true)
    expect(store.activeTour?.notifications_paused_at).toBeNull()
  })

  it('mapTour conserva enable_notifications tras un PATCH que no lo trae', async () => {
    mockFetch(
      page([
        listItem('T1', {
          timezone: 'Europe/Lisbon',
          enable_notifications: false,
          notifications_paused_at: '2026-11-22T10:00:00Z',
        }),
      ]),
      jsonResponse(listItem('T1', { name: 'Nuevo' }))
    )
    const store = useToursStore()
    await store.loadTours()
    await store.updateTour('T1', { name: 'Nuevo' })
    expect(store.tours[0]).toMatchObject({
      name: 'Nuevo',
      timezone: 'Europe/Lisbon',
      enable_notifications: false,
      notifications_paused_at: '2026-11-22T10:00:00Z',
    })
  })
})
