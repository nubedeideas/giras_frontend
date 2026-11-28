import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { useToursStore } from '@/stores/tours'
import { useContactsStore } from '@/stores/contacts'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import { importJob, teamRow } from '@/test/importJobs'
import type { ImportJob } from '@/composables/useImportJobs'
import type { Tour } from '@/types'
import OnbCrewStep from './OnbCrewStep.vue'

const CONNECTED = {
  connected: true,
  account_email: 'me@x.es',
  granted_scopes: [],
  features: { calendar: true, contacts: true },
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
    const link = path.match(/^\/contacts\/([^/]+)\/add_to_tour\/$/)
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
  it('manual: POST /contacts/ y después add_to_tour con tour_uuid y role_uuid', async () => {
    const log = setupFetch()
    const w = await mountStep()
    await w.findAll('div').find((d) => d.text() === `Manual${i18n.global.t('onboarding.crew.manualSub')}`)!.trigger('click')
    await flushPromises()
    await w.get(`input[placeholder="${i18n.global.t('onboarding.crew.firstNamePlaceholder')}"]`).setValue('Ana')
    await w.get('[data-testid="crew-manual-role"]').setValue('R1')
    await w.get('[data-testid="crew-manual-create"]').trigger('click')
    await flushPromises()

    const create = log.findIndex((c) => c.method === 'POST' && c.path === '/contacts/')
    const link = log.findIndex((c) => c.path === '/contacts/NEW/add_to_tour/')
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

  it('Google: por contacto, el PATCH que lo confirma va antes que add_to_tour; un fallo no para al resto', async () => {
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
      const link = log.findIndex((c) => c.path === `/contacts/${uuid}/add_to_tour/`)
      expect(patch, uuid).toBeGreaterThan(-1)
      expect(link, uuid).toBeGreaterThan(patch)
      expect(log[patch].body).toMatchObject({ is_confirmed: true })
      expect(log[link].body).toEqual({ tour_uuid: 'T1' })
    }
    // Lotes de 4: el quinto contacto no se confirma hasta que acaba el primer lote.
    const lastLinkOfFirstBatch = Math.max(
      ...['C1', 'C2', 'C3', 'C4'].map((u) =>
        log.findIndex((c) => c.path === `/contacts/${u}/add_to_tour/`)
      )
    )
    const patchC5 = log.findIndex((c) => c.method === 'PATCH' && c.path === '/contacts/C5/')
    expect(patchC5).toBeGreaterThan(lastLinkOfFirstBatch)

    expect(w.get('[data-testid="crew-link-error"]').text()).toBe(
      '1 contacto no se ha podido añadir a la gira.'
    )
    // El recuento de importados no incluye el fallido.
    expect(w.text()).toContain('5 contactos añadidos')
  })

  it('sin gira no llama a add_to_tour', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    useToursStore().tours = []
    const log = setupFetch()
    const w = await mountStep()
    await w.findAll('div').find((d) => d.text() === `Manual${i18n.global.t('onboarding.crew.manualSub')}`)!.trigger('click')
    await flushPromises()
    await w.get(`input[placeholder="${i18n.global.t('onboarding.crew.firstNamePlaceholder')}"]`).setValue('Ana')
    await w.get('[data-testid="crew-manual-create"]').trigger('click')
    await flushPromises()
    expect(log.some((c) => c.path.includes('add_to_tour'))).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('OnbCrewStep: fuente Hoja o foto (F1)', () => {
  const suggestion = teamRow({
    client_id: 't1',
    display_name: 'Juan',
    match: {
      status: 'name_suggestion',
      by: null,
      contact_uuid: null,
      contact_name: null,
      contact_phone: null,
      candidates: [{ contact_uuid: 'C9', contact_name: 'Juan Pérez', contact_phone: '+34600111222' }],
    },
    needs_action: true,
    confidence: 0.8,
  })
  const ok = teamRow({ client_id: 't2', display_name: 'Lucía Martín' })
  const resolved = { ...suggestion, action: 'create' as const, reviewed: true, needs_action: false }

  function setupImportFetch(
    opts: {
      team?: ReturnType<typeof teamRow>[]
      ready?: Partial<ImportJob>
      result?: Partial<NonNullable<ImportJob['result']>>
      patchGate?: Promise<void>
    } = {}
  ) {
    const log: Call[] = []
    const team = opts.team ?? [suggestion, ok]
    const fn = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      const path = url.pathname.replace(/^\/api/, '')
      const method = init?.method ?? 'GET'
      log.push({ method, path, body: init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : null })
      if (path === '/integrations/google/status/') return jsonResponse(CONNECTED)
      if (path === '/integrations/import-jobs/J1/') {
        return jsonResponse(importJob({ status: 'ready', draft: { team }, ...opts.ready }))
      }
      if (path === '/integrations/import-jobs/J1/draft/') {
        if (opts.patchGate) await opts.patchGate
        return jsonResponse(importJob({ status: 'ready', draft: { team: [resolved, ok] }, ...opts.ready }))
      }
      if (path === '/integrations/import-jobs/J1/confirm/') {
        const done: Partial<ImportJob> = {
          status: 'done',
          draft: { team: [resolved, ok] },
          result: {
            contacts_created: 2,
            contacts_linked: 0,
            linked_late: 0,
            already_in_tour: 0,
            added_to_group: 2,
            skipped: 0,
            team_group_uuid: 'G1',
            team_group_is_default: true,
            contact_uuids: ['N1', 'N2'],
            ...opts.result,
          },
        }
        return jsonResponse(importJob(done))
      }
      if (path === '/contacts/') return jsonResponse(page([]))
      return jsonResponse({}, 404)
    })
    vi.stubGlobal('fetch', fn)
    return log
  }

  const zoneStub = {
    name: 'ImportDropZone',
    props: ['tourUuid', 'entryPoint', 'compact'],
    emits: ['created'],
    template: '<div data-test="zone-stub" :data-entry="entryPoint" :data-tour="tourUuid" />',
  }

  it('crear → progreso → revisión compacta → confirm → importDone → next', async () => {
    const log = setupImportFetch()
    const fetchContacts = vi.spyOn(useContactsStore(), 'fetchContacts').mockResolvedValue()
    const invalidate = vi.spyOn(useReminderCatalogStore(), 'invalidate').mockResolvedValue()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/home')
    await router.isReady()
    const w = mount(OnbCrewStep, {
      props: { tourId: 1 },
      global: { plugins: [router, i18n], stubs: { ImportDropZone: zoneStub } },
    })
    await flushPromises()

    await w.get('[data-test="crew-source-file"]').trigger('click')
    const zone = w.get('[data-test="zone-stub"]')
    expect(zone.attributes('data-entry')).toBe('onboarding')
    expect(zone.attributes('data-tour')).toBe('T1')

    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()

    // Revisión compacta en el propio paso: primero la fila por resolver.
    const review = w.get('[data-test="crew-import-review"]')
    expect(review.findAll('[data-row]')[0].attributes('data-row')).toBe('t1')
    expect(w.get('[data-test="crew-import-confirm"]').attributes('disabled')).toBeDefined()
    expect(review.get('[data-test="import-row-link"]').text()).toContain('Es Juan Pérez')

    await review.get('[data-test="import-row-other"]').trigger('click')
    await flushPromises()
    const patch = log.find((c) => c.path === '/integrations/import-jobs/J1/draft/')
    expect(patch?.method).toBe('PATCH')
    expect(patch?.body).toEqual({ rows: [{ client_id: 't1', action: 'create', reviewed: true }] })
    expect(w.get('[data-test="crew-import-confirm"]').attributes('disabled')).toBeUndefined()

    await w.get('[data-test="crew-import-confirm"]').trigger('click')
    await flushPromises()
    expect(log.some((c) => c.method === 'POST' && c.path === '/integrations/import-jobs/J1/confirm/')).toBe(true)
    expect(fetchContacts).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith('T1')
    expect(w.get('[data-test="crew-import-done"]').text()).toContain(
      '2 personas añadidas al Equipo de la gira'
    )

    await w.get('[data-test="crew-import-next"]').trigger('click')
    expect(w.emitted('next')).toHaveLength(1)
  })

  async function mountWithZone() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/home')
    await router.isReady()
    const w = mount(OnbCrewStep, {
      props: { tourId: 1 },
      global: { plugins: [router, i18n], stubs: { ImportDropZone: zoneStub } },
    })
    await flushPromises()
    await w.get('[data-test="crew-source-file"]').trigger('click')
    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    return w
  }

  it('Confirmar desactivado con un PATCH en cola y un doble clic lanza un solo confirm', async () => {
    let open = () => {}
    const patchGate = new Promise<void>((r) => (open = r))
    const log = setupImportFetch({ team: [ok], patchGate })
    vi.spyOn(useContactsStore(), 'fetchContacts').mockResolvedValue()
    vi.spyOn(useReminderCatalogStore(), 'invalidate').mockResolvedValue()
    const w = await mountWithZone()
    const btn = () => w.get('[data-test="crew-import-confirm"]')
    expect(btn().attributes('disabled')).toBeUndefined()

    const box = w.get('[data-row="t2"] [data-test="import-row-ingroup"]')
    ;(box.element as HTMLInputElement).checked = false
    await box.trigger('change')
    expect(btn().attributes('disabled')).toBeDefined()

    open()
    await flushPromises()
    expect(btn().attributes('disabled')).toBeUndefined()

    // Dos clics en el mismo tick (antes de que el DOM se desactive): un solo confirm.
    void btn().trigger('click')
    void btn().trigger('click')
    await flushPromises()
    const confirms = log.filter((c) => c.method === 'POST' && c.path === '/integrations/import-jobs/J1/confirm/')
    expect(confirms).toHaveLength(1)
  })

  it('D11 y D10: estimación de WhatsApp en la revisión y aviso si quien confirma no está en el equipo', async () => {
    setupImportFetch({
      team: [ok],
      ready: {
        whatsapp_estimate: { per_person: 5, people: 2, total: 10, remaining: 4, plan_limit: 50, exceeds: true },
      },
      result: { confirmer_in_team: false },
    })
    vi.spyOn(useContactsStore(), 'fetchContacts').mockResolvedValue()
    vi.spyOn(useReminderCatalogStore(), 'invalidate').mockResolvedValue()
    const w = await mountWithZone()
    const review = w.get('[data-test="crew-import-review"]')
    expect(review.get('[data-test="import-wa-estimate-line"]').text()).toBe(
      'Unos 10 WhatsApp durante la gira · te quedan 4 en tu plan'
    )
    expect(review.find('[data-test="import-wa-estimate-exceeds"]').exists()).toBe(true)

    await w.get('[data-test="crew-import-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="crew-import-confirmer-outside"]').text()).toBe(
      'Tú no estás en el Equipo de la gira: los avisos solo te llegarán en la app.'
    )
  })

  it('en Manual, la pista pasa a la fuente "Hoja o foto" (lote 3)', async () => {
    setupFetch()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/home')
    await router.isReady()
    const w = mount(OnbCrewStep, {
      props: { tourId: 1 },
      global: { plugins: [router, i18n], stubs: { ImportDropZone: zoneStub } },
    })
    await flushPromises()
    await w
      .findAll('div')
      .find((d) => d.text() === `Manual${i18n.global.t('onboarding.crew.manualSub')}`)!
      .trigger('click')
    await flushPromises()
    expect(w.get('[data-test="manual-import-hint"]').text()).toContain(
      i18n.global.t('importer.contactsTab.manualHintCta')
    )
    await w.get('[data-test="manual-import-hint-cta"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="manual-import-hint"]').exists()).toBe(false)
    expect(w.get('[data-test="zone-stub"]').attributes('data-entry')).toBe('onboarding')
  })
})
