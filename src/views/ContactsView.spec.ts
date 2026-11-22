import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubMatchMedia } from '@/test/reminders'
import { useAuthStore } from '@/stores/auth'
import { useContactsStore } from '@/stores/contacts'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import ContactsView from './ContactsView.vue'

const stubs = {
  ContactCard: { props: ['contact'], template: '<div data-testid="contact-card" />' },
  ContactDetail: true,
  ContactForm: true,
  TourSelectPrompt: true,
  ImportContactsModal: {
    props: ['show'],
    template: '<div data-testid="add-modal" :data-show="String(show)" />',
  },
  ImportDropModal: {
    props: ['show', 'entryPoint', 'tourUuid'],
    template:
      '<div data-testid="import-modal" :data-show="String(show)" :data-entry="entryPoint" :data-tour="tourUuid" />',
  },
}

const ROLE = { uuid: 'R1', name: 'Técnico', color: '#888888' }

function contact(uuid: string) {
  return {
    uuid,
    full_name: `Persona ${uuid}`,
    primary_email: `${uuid}@x.es`,
    company_name: '',
    job_title: '',
    role: ROLE,
  }
}

function stubContacts(results: unknown[] | (() => Response | Promise<Response>)) {
  const fn = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/contacts/')) {
      if (typeof results === 'function') return results()
      return jsonResponse({ count: results.length, next: null, previous: null, results })
    }
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function setTour(isAdmin: boolean) {
  const tours = useToursStore()
  tours.tours = [{ id: 1, uuid: 'T1', name: 'Gira', current_user_is_admin: isAdmin } as Tour]
  tours.setActiveTour(1)
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/contacts')
  await router.isReady()
  const w = mount(ContactsView, { global: { plugins: [router, i18n], stubs } })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ContactsView: estado vacío de la gira (F1, lote 3)', () => {
  it('admin: título, texto y "Importar equipo" que abre ImportDropModal con entry-point="contacts"', async () => {
    stubContacts([])
    setTour(true)
    const w = await mountView()
    const empty = w.get('[data-testid="contacts-empty-tour"]')
    expect(empty.text()).toContain('Esta gira todavía no tiene contactos')
    expect(empty.text()).toContain('Sube la hoja del equipo, un PDF o una foto de la lista')
    const modal = w.get('[data-testid="import-modal"]')
    expect(modal.attributes('data-show')).toBe('false')
    expect(modal.attributes('data-entry')).toBe('contacts')
    expect(modal.attributes('data-tour')).toBe('T1')

    await w.get('[data-testid="contacts-empty-import"]').trigger('click')
    expect(w.get('[data-testid="import-modal"]').attributes('data-show')).toBe('true')
    expect(w.text()).not.toContain('Sin contactos')
  })

  it('"Añadir a mano" abre ImportContactsModal', async () => {
    stubContacts([])
    setTour(true)
    const w = await mountView()
    expect(w.get('[data-testid="add-modal"]').attributes('data-show')).toBe('false')
    await w.get('[data-testid="contacts-empty-manual"]').trigger('click')
    expect(w.get('[data-testid="add-modal"]').attributes('data-show')).toBe('true')
  })

  it('con búsqueda o filtro de rol: "Sin contactos" sin CTA', async () => {
    stubContacts([])
    setTour(true)
    const w = await mountView()
    useContactsStore().searchQuery = 'ana'
    await flushPromises()
    expect(w.find('[data-testid="contacts-empty-tour"]').exists()).toBe(false)
    expect(w.get('[data-testid="contacts-no-results"]').text()).toBe('Sin contactos')
    expect(w.find('[data-testid="contacts-empty-import"]').exists()).toBe(false)

    // Con contactos y un filtro que no casa con ninguno.
    stubContacts([contact('c1')])
    setActivePinia(createPinia())
    setTour(true)
    const w2 = await mountView()
    useContactsStore().selectedRoles.push('otro-rol')
    await flushPromises()
    expect(w2.find('[data-testid="contacts-empty-tour"]').exists()).toBe(false)
    expect(w2.get('[data-testid="contacts-no-results"]').text()).toBe('Sin contactos')
  })

  it('miembro no admin: bodyMember sin botones', async () => {
    stubContacts([])
    setTour(false)
    const w = await mountView()
    const empty = w.get('[data-testid="contacts-empty-tour"]')
    expect(empty.text()).toContain('Cuando un administrador de la gira añada al equipo')
    expect(w.find('[data-testid="contacts-empty-import"]').exists()).toBe(false)
    expect(w.find('[data-testid="contacts-empty-manual"]').exists()).toBe(false)
    expect(w.find('[data-testid="import-modal"]').exists()).toBe(false)
  })

  it('demo: sin botón de importar', async () => {
    stubContacts([])
    setTour(true)
    useAuthStore().isDemoMode = true
    const w = await mountView()
    expect(w.find('[data-testid="contacts-empty-tour"]').exists()).toBe(true)
    expect(w.find('[data-testid="contacts-empty-import"]').exists()).toBe(false)
    expect(w.find('[data-testid="import-modal"]').exists()).toBe(false)
  })

  it('cargando: sin estado vacío', async () => {
    stubContacts(() => new Promise<Response>(() => {}))
    setTour(true)
    const w = await mountView()
    expect(useContactsStore().loading).toBe(true)
    expect(w.find('[data-testid="contacts-empty-tour"]').exists()).toBe(false)
    expect(w.find('[data-testid="contacts-no-results"]').exists()).toBe(false)
  })

  it('error de carga: mensaje con reintentar y sin estado vacío', async () => {
    const fn = stubContacts(() => jsonResponse({ detail: 'x' }, 500))
    setTour(true)
    const w = await mountView()
    expect(w.find('[data-testid="contacts-empty-tour"]').exists()).toBe(false)
    const error = w.get('[data-testid="contacts-error"]')
    expect(error.text()).toContain('No se han podido cargar los contactos.')
    const before = fn.mock.calls.length
    await error.get('button').trigger('click')
    await flushPromises()
    expect(fn.mock.calls.length).toBeGreaterThan(before)
  })

  it('con contactos no hay estado vacío', async () => {
    stubContacts([contact('c1')])
    setTour(true)
    const w = await mountView()
    expect(w.findAll('[data-testid="contact-card"]')).toHaveLength(1)
    expect(w.find('[data-testid="contacts-empty-tour"]').exists()).toBe(false)
  })
})
