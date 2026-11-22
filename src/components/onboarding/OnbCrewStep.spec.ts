import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import OnbCrewStep from './OnbCrewStep.vue'

const CONNECTED = {
  connected: true,
  account_email: 'me@x.es',
  granted_scopes: [],
  features: { calendar: true, calendar_write: true, contacts: true },
  connected_at: '2026-11-01T00:00:00Z',
}

const ROLE = { uuid: 'R1', name: 'Técnico', slug: 'tech', color: '#000', is_system: true }

function gContact(uuid: string) {
  return {
    uuid,
    full_name: `Persona ${uuid}`,
    first_name: 'Persona',
    last_name: uuid,
    primary_email: `${uuid}@x.es`,
    primary_phone: '',
    source: 'google',
    is_favorite: false,
    is_emergency: false,
    is_confirmed: false,
  }
}

const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results })

type Call = { method: string; path: string; body: Record<string, unknown> | null }

function setupFetch(opts: { googleContacts?: string[]; failLink?: string[] } = {}) {
  const log: Call[] = []
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/api/, '')
    const method = init?.method ?? 'GET'
    log.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : null })
    if (path === '/integrations/google/status/') return jsonResponse(CONNECTED)
    if (path === '/contacts/roles/') return jsonResponse(page([ROLE]))
    if (path === '/integrations/contacts/' && method === 'GET') {
      return jsonResponse(page([{ id: 7, sync_enabled: true, last_synced_at: null, error_count: 0, last_error: '' }]))
    }
    if (path === '/integrations/contacts/7/sync_now/') {
      return jsonResponse({ created: 2, updated: 0, deleted: 0, skipped: 0, errors: [] })
    }
    if (path === '/contacts/google-contacts/') {
      return jsonResponse((opts.googleContacts ?? []).map(gContact))
    }
    const link = path.match(/^\/contacts\/([^/]+)\/add-to-tour\/$/)
    if (link) {
      if (opts.failLink?.includes(link[1])) return jsonResponse({ error: 'x' }, 500)
      return jsonResponse({ message: 'ok', created: true, added_to_team: true })
    }
    if (path === '/contacts/' && method === 'POST') {
      return jsonResponse({ ...gContact('NEW'), full_name: 'Ana López', is_confirmed: true }, 201)
    }
    if (/^\/contacts\/[^/]+\/$/.test(path) && method === 'PATCH') return jsonResponse({})
    if (path === '/contacts/') return jsonResponse(page([]))
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return log
}

async function mountStep() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/home')
  await router.isReady()
  const w = mount(OnbCrewStep, {
    props: { tourId: 1 },
    global: { plugins: [router, i18n] },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  useToursStore().tours = [{ id: 1, uuid: 'T1', name: 'Gira' } as Tour]
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('OnbCrewStep: vincular contactos a la gira (F0 A4)', () => {
  it('manual: POST /contacts/ y después add-to-tour con tour_uuid y role_uuid', async () => {
    const log = setupFetch()
    const w = await mountStep()
    await w.findAll('div').find((d) => d.text() === `Manual${i18n.global.t('onboarding.crew.manualSub')}`)!.trigger('click')
    await flushPromises()
    await w.get(`input[placeholder="${i18n.global.t('onboarding.crew.firstNamePlaceholder')}"]`).setValue('Ana')
    await w.get('[data-testid="crew-manual-role"]').setValue('R1')
    await w.get('[data-testid="crew-manual-create"]').trigger('click')
    await flushPromises()

    const create = log.findIndex((c) => c.method === 'POST' && c.path === '/contacts/')
    const link = log.findIndex((c) => c.path === '/contacts/NEW/add-to-tour/')
    expect(create).toBeGreaterThan(-1)
    expect(link).toBeGreaterThan(create)
    expect(log[link].method).toBe('POST')
    expect(log[link].body).toEqual({ tour_uuid: 'T1', role_uuid: 'R1' })
    expect(w.find('[data-testid="crew-link-error"]').exists()).toBe(false)
    expect(w.text()).toContain(i18n.global.t('onboarding.crew.createdTitle'))
  })

  it('manual: si falla el vínculo, el contacto queda creado y se avisa sin volver al formulario', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setupFetch({ failLink: ['NEW'] })
    const w = await mountStep()
    await w.findAll('div').find((d) => d.text() === `Manual${i18n.global.t('onboarding.crew.manualSub')}`)!.trigger('click')
    await flushPromises()
    await w.get(`input[placeholder="${i18n.global.t('onboarding.crew.firstNamePlaceholder')}"]`).setValue('Ana')
    await w.get('[data-testid="crew-manual-create"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain(i18n.global.t('onboarding.crew.createdTitle'))
    expect(w.get('[data-testid="crew-link-error"]').text()).toBe(
      '1 contacto no se ha podido añadir a la gira.'
    )
  })

  it('Google: por contacto, el PATCH que lo confirma va antes que add-to-tour; un fallo no para al resto', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const uuids = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']
    const log = setupFetch({ googleContacts: uuids, failLink: ['C2'] })
    const w = await mountStep()
    await w.get('[data-testid="crew-sync"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="crew-select-all"]').trigger('click')
    await w.get('[data-testid="crew-import"]').trigger('click')
    await flushPromises()

    for (const uuid of uuids) {
      const patch = log.findIndex((c) => c.method === 'PATCH' && c.path === `/contacts/${uuid}/`)
      const link = log.findIndex((c) => c.path === `/contacts/${uuid}/add-to-tour/`)
      expect(patch, uuid).toBeGreaterThan(-1)
      expect(link, uuid).toBeGreaterThan(patch)
      expect(log[patch].body).toMatchObject({ is_confirmed: true })
      expect(log[link].body).toEqual({ tour_uuid: 'T1' })
    }
    // Lotes de 4: el quinto contacto no se confirma hasta que acaba el primer lote.
    const lastLinkOfFirstBatch = Math.max(
      ...['C1', 'C2', 'C3', 'C4'].map((u) =>
        log.findIndex((c) => c.path === `/contacts/${u}/add-to-tour/`)
      )
    )
    const patchC5 = log.findIndex((c) => c.method === 'PATCH' && c.path === '/contacts/C5/')
    expect(patchC5).toBeGreaterThan(lastLinkOfFirstBatch)

    expect(w.get('[data-testid="crew-link-error"]').text()).toBe(
      '1 contacto no se ha podido añadir a la gira.'
    )
  })

  it('sin gira no llama a add-to-tour', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    useToursStore().tours = []
    const log = setupFetch()
    const w = await mountStep()
    await w.findAll('div').find((d) => d.text() === `Manual${i18n.global.t('onboarding.crew.manualSub')}`)!.trigger('click')
    await flushPromises()
    await w.get(`input[placeholder="${i18n.global.t('onboarding.crew.firstNamePlaceholder')}"]`).setValue('Ana')
    await w.get('[data-testid="crew-manual-create"]').trigger('click')
    await flushPromises()
    expect(log.some((c) => c.path.includes('add-to-tour'))).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })
})
