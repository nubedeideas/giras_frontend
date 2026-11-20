import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { useCrewLinks } from './useCrewLinks'
import { useTourDocuments } from './useTourDocuments'

const row = {
  contact: { uuid: 'c1', display_name: 'Ana', has_phone: true, has_email: false },
  sources: ['default_group'],
  state: 'active',
  link: null,
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

describe('useCrewLinks', () => {
  it('URLs y métodos de las 4 llamadas, con auth', async () => {
    const fn = mockFetch(
      jsonResponse({ count: 1, next: null, previous: null, results: [row] }),
      jsonResponse(row, 201),
      jsonResponse(row),
      jsonResponse(row)
    )
    const api = useCrewLinks()
    const page = await api.listCrewLinks('T1', 2)
    expect(page.results).toHaveLength(1)
    await api.ensureCrewLink('T1', 'c1')
    await api.rotateCrewLink('T1', 'c1')
    await api.revokeCrewLink('T1', 'c1')

    const calls = [0, 1, 2, 3].map((n) => callAt(fn, n))
    expect(calls[0].url).toBe('http://api.test/api/tours/T1/crew-links/?page=2&page_size=100')
    expect(calls[0].init.method).toBe('GET')
    expect(calls[1].url).toBe('http://api.test/api/tours/T1/crew-links/c1/')
    expect(calls[2].url).toBe('http://api.test/api/tours/T1/crew-links/c1/rotate/')
    expect(calls[3].url).toBe('http://api.test/api/tours/T1/crew-links/c1/revoke/')
    for (const c of calls.slice(1)) expect(c.init.method).toBe('POST')
    for (const c of calls) expect(c.headers.Authorization).toBe('Bearer access')
  })

  it('el error {code, detail} llega como mensaje', async () => {
    mockFetch(jsonResponse({ code: 'link_revoked', detail: 'Este enlace está revocado.' }, 400))
    await expect(useCrewLinks().ensureCrewLink('T1', 'c1')).rejects.toThrow(
      'Este enlace está revocado.'
    )
  })
})

describe('useTourDocuments (crew)', () => {
  it('updateDocument hace PATCH con visible_to_crew', async () => {
    const fn = mockFetch(jsonResponse({ uuid: 'd1', visible_to_crew: true }))
    await useTourDocuments().updateDocument('T1', 'd1', { visible_to_crew: true })
    const { url, init } = callAt(fn, 0)
    expect(url).toBe('http://api.test/api/tours/T1/documents/d1/')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ visible_to_crew: true })
  })

  it('la subida manda visible_to_crew como "true"/"false"', async () => {
    const fn = mockFetch(jsonResponse({ uuid: 'd1' }, 201))
    const file = new File(['x'], 'rider.pdf', { type: 'application/pdf' })
    await useTourDocuments().uploadDocument('T1', { file, visible_to_crew: false })
    const body = callAt(fn, 0).init.body as FormData
    expect(body.get('visible_to_crew')).toBe('false')
  })
})
