import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { CrewPortalError, getPortal, useCrewPortal } from './useCrewPortal'

const TOKEN = `${'a'.repeat(32)}-1.${'b'.repeat(43)}`

const portal = {
  tour: {
    name: 'Gira',
    artist_name: 'Artista',
    status: 'active',
    start_date: '2026-11-20',
    end_date: '2026-11-30',
    start_city: '',
    end_city: '',
    poster_url: null,
    contacts_text: '',
  },
  contact: { first_name: 'Ana', display_name: 'Ana López' },
  timezone: 'Europe/Madrid',
  today: '2026-11-24',
  mode: 'live',
  range: { from: '2026-11-24', to: '2026-11-30' },
  days: [],
  next_activity_date: null,
  documents: [],
  expires_on: '2026-12-07',
  generated_at: '2026-11-24T10:00:00Z',
}

async function codeOf(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(CrewPortalError)
    return (e as CrewPortalError).code
  }
  throw new Error('no lanzó')
}

beforeEach(() => {
  localStorage.clear()
  // Aunque haya sesión en el navegador, el portal no manda Authorization.
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

describe('useCrewPortal', () => {
  it('llama sin Authorization a /crew/{token}/', async () => {
    const fn = mockFetch(jsonResponse(portal))
    const data = await getPortal(TOKEN)
    expect(data.contact.first_name).toBe('Ana')
    const { url, headers } = callAt(fn, 0)
    expect(url).toBe(`http://api.test/api/crew/${TOKEN}/`)
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('authorization')
  })

  it('404 da invalid (JSON o el 404 HTML de Django)', async () => {
    mockFetch(jsonResponse({ code: 'invalid', detail: 'x' }, 404))
    expect(await codeOf(getPortal(TOKEN))).toBe('invalid')
    mockFetch(new Response('<h1>Not Found</h1>', { status: 404 }))
    expect(await codeOf(getPortal('basura'))).toBe('invalid')
  })

  it.each(['revoked', 'expired', 'disabled', 'tour_cancelled', 'unavailable'])(
    '410 con code %s',
    async (code) => {
      mockFetch(jsonResponse({ code, detail: 'x' }, 410))
      expect(await codeOf(getPortal(TOKEN))).toBe(code)
    }
  )

  it('410 sin code (o desconocido) da revoked', async () => {
    mockFetch(jsonResponse({ detail: 'x' }, 410))
    expect(await codeOf(getPortal(TOKEN))).toBe('revoked')
    mockFetch(jsonResponse({ code: 'raro' }, 410))
    expect(await codeOf(getPortal(TOKEN))).toBe('revoked')
  })

  it('429 en formato envuelto da rate_limited', async () => {
    mockFetch(
      jsonResponse(
        { success: false, error: { message: 'Throttled', status_code: 429 } },
        429
      )
    )
    expect(await codeOf(getPortal(TOKEN))).toBe('rate_limited')
  })

  it('fallo de red y 5xx dan network', async () => {
    const fn = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fn)
    expect(await codeOf(getPortal(TOKEN))).toBe('network')
    mockFetch(new Response('boom', { status: 502 }))
    expect(await codeOf(getPortal(TOKEN))).toBe('network')
  })

  it('load expone loading/error y conserva la agenda si falla la red en una recarga', async () => {
    mockFetch(jsonResponse(portal), new Response('x', { status: 503 }), jsonResponse({ code: 'revoked' }, 410))
    const c = useCrewPortal()
    await c.load(TOKEN)
    expect(c.portal.value?.tour.name).toBe('Gira')
    expect(c.loading.value).toBe(false)
    await c.load(TOKEN)
    expect(c.error.value).toBe('network')
    expect(c.portal.value).not.toBeNull()
    await c.load(TOKEN)
    expect(c.error.value).toBe('revoked')
    expect(c.portal.value).toBeNull()
  })
})
