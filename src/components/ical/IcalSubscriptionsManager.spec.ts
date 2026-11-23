import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { adminTour, icalSub } from '@/test/icalSubscriptions'
import IcalSubscriptionsManager from './IcalSubscriptionsManager.vue'

const stubs = {
  IcalSubscriptionCard: {
    name: 'IcalSubscriptionCard',
    props: ['sub'],
    emits: ['changed', 'deleted', 'stale'],
    template: '<div data-test="card-stub">{{ sub.name }}</div>',
  },
  IcalSubscribeModal: {
    name: 'IcalSubscribeModal',
    props: ['show', 'tourUuid'],
    emits: ['close', 'created'],
    template: '<div v-if="show" data-test="modal-stub" :data-tour="String(tourUuid)" />',
  },
}

function page(results: unknown[]) {
  return jsonResponse({ count: results.length, next: null, previous: null, results })
}

function mountManager() {
  return mount(IcalSubscriptionsManager, { global: { plugins: [i18n], stubs } })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  useToursStore().tours = [adminTour()]
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IcalSubscriptionsManager', () => {
  it('carga sin gira y pinta las tarjetas', async () => {
    const fn = mockFetch(page([icalSub(), icalSub({ uuid: 'S2', name: 'Otra' })]))
    const w = mountManager()
    expect(w.find('[data-test="ical-manager-loading"]').exists()).toBe(true)
    await flushPromises()
    expect(callAt(fn, 0).url).toMatch(/\/integrations\/ical-subscriptions\/$/)
    expect(w.findAll('[data-test="card-stub"]').map((c) => c.text())).toEqual([
      'Gira 2027 (iCloud)',
      'Otra',
    ])
    expect(w.text()).toContain('Calendarios iCal')

    w.findAllComponents({ name: 'IcalSubscriptionCard' })[1].vm.$emit('deleted', 'S2')
    await flushPromises()
    expect(w.findAll('[data-test="card-stub"]')).toHaveLength(1)
  })

  it('vacío: texto y el botón abre el modal sin gira fija', async () => {
    mockFetch(page([]))
    const w = mountManager()
    await flushPromises()
    expect(w.get('[data-test="ical-manager-empty"]').text()).toContain(
      'Suscribe el calendario de Apple, Outlook'
    )
    expect(w.find('[data-test="modal-stub"]').exists()).toBe(false)
    await w.get('[data-test="ical-manager-empty-add"]').trigger('click')
    expect(w.get('[data-test="modal-stub"]').attributes('data-tour')).toBe('null')
  })

  it('error con "Reintentar" que vuelve a cargar', async () => {
    const fn = mockFetch(jsonResponse({ detail: 'x' }, 500), page([icalSub()]))
    const w = mountManager()
    await flushPromises()
    expect(w.get('[data-test="ical-manager-error"]').text()).toContain('No se ha podido completar')
    await w.get('[data-test="ical-manager-retry"]').trigger('click')
    await flushPromises()
    expect(fn).toHaveBeenCalledTimes(2)
    expect(w.findAll('[data-test="card-stub"]')).toHaveLength(1)
  })

  it('sin giras que administre o en la demo: sin botón de suscribir', async () => {
    useToursStore().tours = [adminTour({ current_user_is_admin: false })]
    mockFetch(page([]))
    const w = mountManager()
    await flushPromises()
    expect(w.find('[data-test="ical-manager-empty-add"]').exists()).toBe(false)

    useToursStore().tours = [adminTour()]
    useAuthStore().isDemoMode = true
    mockFetch(page([]))
    const d = mountManager()
    await flushPromises()
    expect(d.find('[data-test="ical-manager-empty-add"]').exists()).toBe(false)
  })
})
