import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { DateTime } from 'luxon'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { jsonResponse } from '@/test/http'
import { adminSummary, discrepancy, normSpaces as norm } from '@/test/twilioCosts'
import TwilioCostsTab from './TwilioCostsTab.vue'


const panelReload = vi.fn()
const DiscrepanciesStub = defineComponent({
  name: 'TwilioDiscrepanciesPanel',
  props: {
    currency: { type: String, default: '' },
    tour: { type: String, default: null },
    tourName: { type: String, default: null },
  },
  emits: ['acknowledged', 'clearTour'],
  setup(_, { expose }) {
    expose({ reload: panelReload })
    return {}
  },
  template: '<div data-testid="discrepancies-stub" :data-tour="tour" :data-tour-name="tourName" />',
})

const stubs = { TwilioCostsTourTable: true, TwilioDiscrepanciesPanel: DiscrepanciesStub }

type Handler = (url: string, init: RequestInit) => Response
function routeFetch(sync: Handler = () => jsonResponse({ queued: true, lookback_hours: 48 }, 202)) {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.includes('/sync/')) return sync(url, init ?? {})
    return jsonResponse(adminSummary())
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function summaryCalls(fn: ReturnType<typeof routeFetch>): string[] {
  return fn.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/summary/'))
}

async function mountTab(props: { tour?: string | null } = {}) {
  const w = mount(TwilioCostsTab, { props, global: { plugins: [i18n], stubs } })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  panelReload.mockClear()
  const auth = useAuthStore()
  auth.user = { email: 'me@x.es', is_superuser: true } as typeof auth.user
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TwilioCostsTab', () => {
  it('month navigation stops at current month', async () => {
    const fn = routeFetch()
    const w = await mountTab()
    const now = DateTime.utc().startOf('month')
    const prev = now.minus({ months: 1 })

    expect(summaryCalls(fn)[0]).toContain(`month=${now.toFormat('yyyy-MM')}`)
    expect(w.get('[data-testid="month-label"]').text()).toBe(
      now.setLocale('es').toFormat('LLLL yyyy')
    )
    expect(w.get('[data-testid="month-next"]').attributes('disabled')).toBeDefined()

    await w.get('[data-testid="month-prev"]').trigger('click')
    await flushPromises()
    expect(summaryCalls(fn)[1]).toContain(`month=${prev.toFormat('yyyy-MM')}`)
    expect(w.get('[data-testid="month-next"]').attributes('disabled')).toBeUndefined()

    await w.get('[data-testid="month-next"]').trigger('click')
    await flushPromises()
    expect(summaryCalls(fn)[2]).toContain(`month=${now.toFormat('yyyy-MM')}`)
    expect(w.get('[data-testid="month-next"]').attributes('disabled')).toBeDefined()

    // Deshabilitado: no navega ni pide más.
    await w.get('[data-testid="month-next"]').trigger('click')
    await flushPromises()
    expect(summaryCalls(fn)).toHaveLength(3)
  })

  it('renders cards and last sync', async () => {
    routeFetch()
    const w = await mountTab()
    const card = (k: string) => norm(w.get(`[data-testid="card-${k}"]`).text())
    expect(card('totalMonth')).toContain('Coste del mes')
    expect(card('totalMonth')).toContain('6,00 US$')
    expect(card('totalMonth')).toContain('+2,00 US$ frente al mes anterior')
    expect(card('messages')).toContain('12')
    expect(card('unattributed')).toContain('2')
    expect(card('unattributed')).toContain('1,00 US$')
    expect(card('inbound')).toContain('5')
    expect(card('pendingPrice')).toContain('1')
    expect(card('openDiscrepancies')).toContain('3')

    const sync = w.get('[data-testid="last-sync"]').text()
    expect(sync).toMatch(/^Última sincronización: correcta, /)
    expect(sync).toContain('Ventana:')
    expect(sync).toContain('UTC')
  })

  it('shows failed last sync with its error', async () => {
    const fn = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        adminSummary({
          last_sync: {
            status: 'failed',
            trigger: 'beat',
            started_at: '2026-11-21T09:40:00Z',
            finished_at: '2026-11-21T09:40:05Z',
            window_start: '2026-11-19T09:40:00Z',
            window_end: '2026-11-21T09:40:00Z',
            error: 'HTTP 503',
          },
        })
      )
    )
    vi.stubGlobal('fetch', fn)
    const w = await mountTab()
    const sync = w.get('[data-testid="last-sync"]').text()
    expect(sync).toContain('Última sincronización: fallida')
    expect(sync).toContain('Error: HTTP 503')
  })

  it('sync now 202 toast and reload', async () => {
    vi.useFakeTimers()
    const fn = routeFetch()
    const w = await mountTab()
    expect(summaryCalls(fn)).toHaveLength(1)

    await w.get('[data-testid="sync-now"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="sync-notice"]').text()).toBe('Sincronización encolada')
    const syncCall = fn.mock.calls.find((c) => String(c[0]).includes('/sync/'))!
    expect(syncCall[1]?.method).toBe('POST')

    await vi.advanceTimersByTimeAsync(29_000)
    expect(summaryCalls(fn)).toHaveLength(1)
    expect(panelReload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    await flushPromises()
    expect(summaryCalls(fn)).toHaveLength(2)
    expect(panelReload).toHaveBeenCalledTimes(1)
  })

  it('sync 409 and 503 messages', async () => {
    let status = 409
    routeFetch(() =>
      jsonResponse(
        status === 409
          ? { error: 'Ya hay una sincronización en curso', code: 'sync_running' }
          : { error: 'Twilio no está configurado', code: 'twilio_not_configured' },
        status
      )
    )
    const w = await mountTab()
    await w.get('[data-testid="sync-now"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="sync-notice"]').text()).toBe('Ya hay una sincronización en curso')

    status = 503
    i18n.global.locale.value = 'en'
    await w.get('[data-testid="sync-now"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="sync-notice"]').text()).toBe('Twilio is not configured')
  })

  it('shows error with retry when the summary fails', async () => {
    const fn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: { message: 'x', status_code: 500 } }, 500)
      )
      .mockResolvedValue(jsonResponse(adminSummary()))
    vi.stubGlobal('fetch', fn)
    const w = await mountTab()
    const err = w.get('[data-testid="summary-error"]')
    expect(err.text()).toContain('No se han podido cargar los costes')
    await err.get('button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="summary-error"]').exists()).toBe(false)
    expect(w.find('[data-testid="card-totalMonth"]').exists()).toBe(true)
  })

  it('acknowledged decrements only from open and reloads if reviewed by someone else', async () => {
    const fn = routeFetch()
    const w = await mountTab()
    const card = () => w.get('[data-testid="card-openDiscrepancies"]').text()
    const panel = w.getComponent(DiscrepanciesStub)
    expect(card()).toContain('3')

    const mine = discrepancy({ status: 'acknowledged', acknowledged_by_email: 'me@x.es' })
    panel.vm.$emit('acknowledged', mine, 'open')
    await flushPromises()
    expect(card()).toContain('2')

    // Ya no estaba abierta: no resta.
    panel.vm.$emit('acknowledged', discrepancy({ status: 'resolved' }), 'resolved')
    await flushPromises()
    expect(card()).toContain('2')
    expect(summaryCalls(fn)).toHaveLength(1)

    // La revisó otro superusuario: recarga el resumen en vez de restar.
    panel.vm.$emit(
      'acknowledged',
      discrepancy({ status: 'acknowledged', acknowledged_by_email: 'other@x.es' }),
      'open'
    )
    await flushPromises()
    expect(summaryCalls(fn)).toHaveLength(2)
    expect(card()).toContain('3')
  })

  it('passes the tour filter and its name to the discrepancies panel', async () => {
    routeFetch()
    const w = await mountTab({ tour: 'T1' })
    const stub = w.get('[data-testid="discrepancies-stub"]')
    expect(stub.attributes('data-tour')).toBe('T1')
    expect(stub.attributes('data-tour-name')).toBe('Artista — Gira Norte')
    w.getComponent(DiscrepanciesStub).vm.$emit('clearTour')
    expect(w.emitted('clearTour')).toHaveLength(1)
  })
})
