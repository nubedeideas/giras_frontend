import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useToursStore } from '@/stores/tours'
import { jsonResponse } from '@/test/http'
import { adminTour } from '@/test/icalSubscriptions'
import { sheetSub } from '@/test/sheetSubscriptions'
import SheetSubscriptionsManager from './SheetSubscriptionsManager.vue'

const cfg = vi.hoisted(() => ({ configured: true }))
vi.mock('@/composables/useGooglePicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useGooglePicker')>()
  return { ...actual, isPickerConfigured: () => cfg.configured }
})

const stubs = {
  SheetSubscriptionCard: {
    name: 'SheetSubscriptionCard',
    props: ['sub'],
    template: '<div data-test="card-stub">{{ sub.uuid }}</div>',
  },
  SheetLinkModal: {
    name: 'SheetLinkModal',
    props: ['show', 'tourUuid'],
    template: '<div data-test="modal-stub" :data-show="String(show)" />',
  },
}

function list(results: unknown[] | 'error') {
  const fn = vi.fn<typeof fetch>(async () =>
    results === 'error'
      ? jsonResponse({ detail: 'x' }, 500)
      : jsonResponse({ count: results.length, next: null, previous: null, results })
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

function mountManager(props: Record<string, unknown> = {}) {
  return mount(SheetSubscriptionsManager, { props, global: { plugins: [i18n], stubs } })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  useToursStore().tours = [adminTour()]
  i18n.global.locale.value = 'es'
  cfg.configured = true
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SheetSubscriptionsManager', () => {
  it('carga con esqueleto y pinta la lista', async () => {
    list([sheetSub(), sheetSub({ uuid: 'G2' })])
    const w = mountManager()
    expect(w.find('[data-test="sheet-manager-loading"]').exists()).toBe(true)
    await flushPromises()
    expect(w.findAll('[data-test="card-stub"]').map((c) => c.text())).toEqual(['G1', 'G2'])
    expect(w.get('[data-test="sheet-manager-add"]').text()).toBe('Vincular Google Sheets')
  })

  it('vacío con "Vincular Google Sheets", que abre el modal', async () => {
    list([])
    const w = mountManager()
    await flushPromises()
    expect(w.get('[data-test="sheet-manager-empty"]').text()).toContain(
      'Vincula la hoja de cálculo donde llevas el itinerario o el equipo de una gira.'
    )
    expect(w.get('[data-test="modal-stub"]').attributes('data-show')).toBe('false')
    await w.get('[data-test="sheet-manager-empty-add"]').trigger('click')
    expect(w.get('[data-test="modal-stub"]').attributes('data-show')).toBe('true')
  })

  it('error con reintento', async () => {
    const fn = list('error')
    const w = mountManager()
    await flushPromises()
    expect(w.get('[data-test="sheet-manager-error"]').text()).toContain('No hemos podido leer la hoja.')
    fn.mockImplementation(async () => jsonResponse({ count: 0, next: null, previous: null, results: [] }))
    await w.get('[data-test="sheet-manager-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sheet-manager-empty"]').exists()).toBe(true)
  })

  it('openNew abre el modal al montar', async () => {
    list([])
    const w = mountManager({ openNew: true })
    await flushPromises()
    expect(w.get('[data-test="modal-stub"]').attributes('data-show')).toBe('true')
  })

  it('sin el selector configurado: oculto si no hay hojas; con hojas, sin "Vincular"', async () => {
    cfg.configured = false
    list([])
    const empty = mountManager()
    await flushPromises()
    expect(empty.find('[data-test="sheet-manager"]').exists()).toBe(false)

    list([sheetSub()])
    const w = mountManager()
    await flushPromises()
    expect(w.find('[data-test="card-stub"]').exists()).toBe(true)
    expect(w.find('[data-test="sheet-manager-add"]').exists()).toBe(false)
  })
})
