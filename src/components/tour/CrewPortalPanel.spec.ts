import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import CrewPortalPanel from './CrewPortalPanel.vue'

const URL_A = 'https://giras.pro/crew/aaa-1.sig'
const URL_B = 'https://giras.pro/crew/aaa-2.sig'

function link(url: string | null, version = 1) {
  return {
    uuid: 'l1',
    url,
    version,
    created_at: '2026-11-20T10:00:00Z',
    rotated_at: null,
    revoked_at: null,
    view_count: 3,
    first_viewed_at: '2026-11-21T10:00:00Z',
    last_viewed_at: '2026-11-22T10:00:00Z',
  }
}

function row(uuid: string, state: string, l: ReturnType<typeof link> | null) {
  return {
    contact: { uuid, display_name: `Persona ${uuid}`, has_phone: true, has_email: false },
    sources: ['default_group'],
    state,
    link: l,
  }
}

type Handler = (url: string, init?: RequestInit) => Response | undefined

function setupFetch(
  rows: unknown[],
  extra: Handler = () => undefined,
  tourOver: Record<string, unknown> = {}
) {
  const tour = {
    uuid: 'T1',
    status: 'active',
    crew_portal_enabled: true,
    crew_portal_days: 7,
    ...tourOver,
  }
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    const custom = extra(url, init)
    if (custom) return custom
    if (url.endsWith('/tours/T1/') && init?.method === 'PATCH') {
      Object.assign(tour, JSON.parse(String(init.body)))
      return jsonResponse(tour)
    }
    if (url.endsWith('/tours/T1/')) return jsonResponse(tour)
    if (url.includes('/crew-links/?')) {
      return jsonResponse({ count: rows.length, next: null, previous: null, results: rows })
    }
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function calls(fn: ReturnType<typeof setupFetch>) {
  return fn.mock.calls.map(([u, init]) => `${init?.method ?? 'GET'} ${String(u)}`)
}

const writeText = vi.fn<(s: string) => Promise<void>>()

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountPanel() {
  return mount(CrewPortalPanel, {
    props: { tourUuid: 'T1' },
    global: { plugins: [i18n], stubs: { teleport: true, transition: false } },
  })
}

describe('CrewPortalPanel', () => {
  it('lista el crew con procedencia, estado y visitas', async () => {
    setupFetch([row('c1', 'active', link(URL_A)), row('c2', 'none', null)])
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('[data-testid="crew-link-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Grupo por defecto')
    expect(rows[0].text()).toContain('Activo')
    expect(rows[0].text()).toContain('3 visitas')
    expect(rows[1].text()).toContain('Sin enlace')
    expect(rows[1].text()).toContain('Aún no lo ha abierto')
  })

  it('vacío', async () => {
    setupFetch([])
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="crew-links-empty"]').exists()).toBe(true)
  })

  it('copiar con url no llama a la API y copia', async () => {
    const fn = setupFetch([row('c1', 'active', link(URL_A))])
    const w = mountPanel()
    await flushPromises()
    const before = fn.mock.calls.length
    await w.get('[data-testid="crew-copy"]').trigger('click')
    await flushPromises()
    expect(fn.mock.calls.length).toBe(before)
    expect(writeText).toHaveBeenCalledWith(URL_A)
    expect(w.get('[data-testid="crew-feedback"]').text()).toBe('Enlace copiado')
  })

  it('copiar sin url llama a ensureCrewLink y copia el enlace nuevo', async () => {
    const fn = setupFetch([row('c2', 'none', null)], (url, init) =>
      init?.method === 'POST' && url.endsWith('/crew-links/c2/')
        ? jsonResponse(row('c2', 'active', link(URL_A)), 201)
        : undefined
    )
    const w = mountPanel()
    await flushPromises()
    await w.get('[data-testid="crew-copy"]').trigger('click')
    await flushPromises()
    expect(calls(fn)).toContain('POST http://api.test/api/tours/T1/crew-links/c2/')
    expect(writeText).toHaveBeenCalledWith(URL_A)
    expect(w.get('[data-testid="crew-link-row"]').text()).toContain('Activo')
  })

  it('regenerar pide confirmación antes de rotar y copia el enlace nuevo', async () => {
    const fn = setupFetch([row('c1', 'active', link(URL_A))], (url, init) =>
      init?.method === 'POST' && url.endsWith('/crew-links/c1/rotate/')
        ? jsonResponse(row('c1', 'active', link(URL_B, 2)))
        : undefined
    )
    const w = mountPanel()
    await flushPromises()
    await w.get('[data-testid="crew-rotate"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="crew-confirm-text"]').text()).toBe(
      'El enlace anterior dejará de funcionar. ¿Regenerarlo?'
    )
    expect(calls(fn).some((c) => c.includes('/rotate/'))).toBe(false)

    await w.get('[data-testid="crew-confirm"]').trigger('click')
    await flushPromises()
    expect(calls(fn)).toContain('POST http://api.test/api/tours/T1/crew-links/c1/rotate/')
    expect(writeText).toHaveBeenCalledWith(URL_B)
  })

  it('revocar pide confirmación y actualiza el estado', async () => {
    const fn = setupFetch([row('c1', 'active', link(URL_A))], (url, init) =>
      init?.method === 'POST' && url.endsWith('/crew-links/c1/revoke/')
        ? jsonResponse(row('c1', 'revoked', link(null)))
        : undefined
    )
    const w = mountPanel()
    await flushPromises()
    await w.get('[data-testid="crew-revoke"]').trigger('click')
    await flushPromises()
    expect(calls(fn).some((c) => c.includes('/revoke/'))).toBe(false)
    await w.get('[data-testid="crew-confirm"]').trigger('click')
    await flushPromises()
    expect(calls(fn)).toContain('POST http://api.test/api/tours/T1/crew-links/c1/revoke/')
    expect(w.get('[data-testid="crew-link-row"]').text()).toContain('Revocado')
    expect(w.find('[data-testid="crew-copy"]').exists()).toBe(false)
  })

  it('el interruptor y los días hacen PATCH de la gira', async () => {
    const fn = setupFetch([row('c1', 'active', link(URL_A))])
    const w = mountPanel()
    await flushPromises()
    await w.get('[data-testid="crew-enabled"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="crew-days"]').setValue('14')
    await flushPromises()
    const patches = fn.mock.calls
      .filter(([, init]) => init?.method === 'PATCH')
      .map(([, init]) => JSON.parse(String(init?.body)))
    expect(patches).toEqual([{ crew_portal_enabled: false }, { crew_portal_days: 14 }])
    expect(w.get('[data-testid="crew-enabled"]').attributes('aria-checked')).toBe('false')
  })

  it.each([
    ['cancelada', { status: 'cancelled' }, 'La gira está cancelada'],
    ['caducada', { crew_portal_expires_on: '2020-01-01' }, 'ha caducado'],
  ])('gira %s: sin Copiar ni Regenerar y con aviso', async (_name, over, notice) => {
    setupFetch([row('c1', 'active', link(URL_A)), row('c2', 'none', null)], undefined, over)
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="crew-copy"]').exists()).toBe(false)
    expect(w.find('[data-testid="crew-rotate"]').exists()).toBe(false)
    expect(w.find('[data-testid="crew-revoke"]').exists()).toBe(true)
    expect(w.get('[data-testid="crew-blocked"]').text()).toContain(notice)
  })

  it('filas disabled/expired no ofrecen Copiar ni Regenerar', async () => {
    setupFetch([row('c1', 'expired', link(null)), row('c2', 'disabled', link(null))])
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="crew-copy"]').exists()).toBe(false)
    expect(w.find('[data-testid="crew-rotate"]').exists()).toBe(false)
  })

  it('muestra el 400 portal_unavailable del backend al copiar', async () => {
    setupFetch([row('c2', 'none', null)], (url, init) =>
      init?.method === 'POST' && url.endsWith('/crew-links/c2/')
        ? jsonResponse({ code: 'portal_unavailable', detail: 'El portal no está disponible.' }, 400)
        : undefined
    )
    const w = mountPanel()
    await flushPromises()
    await w.get('[data-testid="crew-copy"]').trigger('click')
    await flushPromises()
    expect(writeText).not.toHaveBeenCalled()
    expect(w.get('[data-testid="crew-feedback"]').text()).toBe('El portal no está disponible.')
  })

  it('si la respuesta no trae url, explica el estado del enlace', async () => {
    setupFetch([row('c2', 'none', null)], (url, init) =>
      init?.method === 'POST' && url.endsWith('/crew-links/c2/')
        ? jsonResponse(row('c2', 'expired', link(null)), 200)
        : undefined
    )
    const w = mountPanel()
    await flushPromises()
    await w.get('[data-testid="crew-copy"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="crew-feedback"]').text()).toBe('Caducado')
  })

  it('al cambiar de gira vacía la lista y descarta la respuesta tardía de la anterior', async () => {
    let resolveT1: (r: Response) => void = () => {}
    const fn = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.includes('/tours/T1/crew-links/')) return new Promise<Response>((r) => (resolveT1 = r))
      if (url.includes('/tours/T2/crew-links/')) {
        return jsonResponse({ count: 1, next: null, previous: null, results: [row('x2', 'none', null)] })
      }
      return jsonResponse({ uuid: 'T?', status: 'active', crew_portal_enabled: true, crew_portal_days: 7 })
    })
    vi.stubGlobal('fetch', fn)
    const w = mountPanel()
    await flushPromises()
    await w.setProps({ tourUuid: 'T2' })
    await flushPromises()
    resolveT1(
      jsonResponse({ count: 1, next: null, previous: null, results: [row('x1', 'active', link(URL_A))] })
    )
    await flushPromises()
    const rows = w.findAll('[data-testid="crew-link-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Persona x2')
  })

  it('al cambiar de gira no se ven las filas anteriores mientras carga', async () => {
    const fn = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.includes('/tours/T2/crew-links/')) return new Promise<Response>(() => {})
      if (url.includes('/crew-links/')) {
        return jsonResponse({ count: 1, next: null, previous: null, results: [row('x1', 'active', link(URL_A))] })
      }
      return jsonResponse({ status: 'active', crew_portal_enabled: true, crew_portal_days: 7 })
    })
    vi.stubGlobal('fetch', fn)
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('[data-testid="crew-link-row"]')).toHaveLength(1)
    await w.setProps({ tourUuid: 'T2' })
    await flushPromises()
    expect(w.findAll('[data-testid="crew-link-row"]')).toHaveLength(0)
    expect(w.find('[data-testid="crew-links-loading"]').exists()).toBe(true)
  })
})
