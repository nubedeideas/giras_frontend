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
