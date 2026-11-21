import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { discrepancy, normSpaces as norm } from '@/test/twilioCosts'
import TwilioDiscrepanciesPanel from './TwilioDiscrepanciesPanel.vue'


const page = (results: unknown[], next: string | null = null) => ({
  count: results.length,
  next,
  previous: null,
  results,
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

function mountPanel(
  fn: ReturnType<typeof vi.fn<typeof fetch>>,
  props: { tour?: string | null; tourName?: string | null } = {}
) {
  vi.stubGlobal('fetch', fn)
  return mount(TwilioDiscrepanciesPanel, {
    props: { currency: 'USD', ...props },
    global: { plugins: [i18n] },
  })
}

const listUrls = (fn: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fn.mock.calls.map((c) => new URL(String(c[0])))

describe('TwilioDiscrepanciesPanel', () => {
  it('filters by status and kind', async () => {
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(page([])))
    const w = mountPanel(fn)
    await flushPromises()
    expect(listUrls(fn)[0].searchParams.get('status')).toBe('open')
    expect(listUrls(fn)[0].searchParams.getAll('kind')).toEqual([])
    expect(w.get('[data-testid="discrepancies-empty"]').text()).toBe(
      'No hay discrepancias con estos filtros'
    )

    await w.get('[data-testid="filter-status"]').setValue('all')
    await flushPromises()
    expect(listUrls(fn)[1].searchParams.get('status')).toBe('all')

    await w.get('[data-testid="filter-kind"]').setValue('status_mismatch')
    await flushPromises()
    expect(listUrls(fn)[2].searchParams.get('status')).toBe('all')
    expect(listUrls(fn)[2].searchParams.getAll('kind')).toEqual(['status_mismatch'])
  })

  it('load more appends', async () => {
    const nextUrl = 'http://api.test/api/admin/twilio-costs/discrepancies/?page=2&status=open'
    const fn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(page([discrepancy({ uuid: 'D1' })], nextUrl)))
      .mockResolvedValueOnce(jsonResponse(page([discrepancy({ uuid: 'D2' })])))
    const w = mountPanel(fn)
    await flushPromises()
    expect(w.findAll('[data-testid="discrepancy-row"]')).toHaveLength(1)

    await w.get('[data-testid="load-more"]').trigger('click')
    await flushPromises()
    expect(String(fn.mock.calls[1][0])).toBe(nextUrl)
    expect(w.findAll('[data-testid="discrepancy-row"]')).toHaveLength(2)
    expect(w.find('[data-testid="load-more"]').exists()).toBe(false)
  })

  it('acknowledge is optimistic and rolls back', async () => {
    let resolveAck: (r: Response) => void = () => {}
    const fn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(page([discrepancy({ uuid: 'D1' }), discrepancy({ uuid: 'D2' })]))
      )
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolveAck = r)))
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: { message: 'boom', status_code: 500 } }, 500)
      )
    const w = mountPanel(fn)
    await flushPromises()
    const rows = () => w.findAll('[data-testid="discrepancy-row"]')
    const statusOf = (i: number) => rows()[i].get('[data-testid="discrepancy-status"]').text()

    // Éxito: cambia antes de que responda el backend.
    await rows()[0].get('[data-testid="acknowledge"]').trigger('click')
    expect(statusOf(0)).toBe('Revisada')
    expect(rows()[0].find('[data-testid="acknowledge"]').exists()).toBe(false)
    const ackCall = fn.mock.calls[1]
    expect(String(ackCall[0])).toBe(
      'http://api.test/api/admin/twilio-costs/discrepancies/D1/acknowledge/'
    )
    expect(ackCall[1]?.method).toBe('POST')
    resolveAck(
      jsonResponse(
        discrepancy({ uuid: 'D1', status: 'acknowledged', acknowledged_by_email: 'a@x.es' })
      )
    )
    await flushPromises()
    expect(statusOf(0)).toBe('Revisada')
    expect(w.emitted('acknowledged')).toHaveLength(1)

    // Fallo: vuelve a "Abierta" y enseña el error.
    await rows()[1].get('[data-testid="acknowledge"]').trigger('click')
    expect(statusOf(1)).toBe('Revisada')
    await flushPromises()
    expect(statusOf(1)).toBe('Abierta')
    expect(rows()[1].find('[data-testid="acknowledge"]').exists()).toBe(true)
    expect(w.get('[data-testid="action-error"]').text()).toContain(
      'No se ha podido marcar como revisada'
    )
    expect(w.emitted('acknowledged')).toHaveLength(1)
  })

  it('renders details per kind and short sid', async () => {
    const fn = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        page([
          discrepancy({ uuid: 'D1' }),
          discrepancy({
            uuid: 'D2',
            kind: 'status_mismatch',
            tour: { uuid: 'T1', name: 'Gira Norte' },
            details: { twilio_status: 'undelivered', error_code: 63016, recipient_status: 'sent' },
          }),
          discrepancy({
            uuid: 'D3',
            kind: 'recipient_without_sid',
            sid: '',
            details: {
              sent_at: '2026-11-20T10:00:00Z',
              recipient_status: 'delivered',
              notification_type: 'day_sheet',
            },
          }),
          discrepancy({
            uuid: 'D4',
            kind: 'currency_mismatch',
            details: { price_unit: 'EUR', amount: '0.04000' },
          }),
        ])
      )
    )
    const w = mountPanel(fn)
    await flushPromises()
    const rows = w.findAll('[data-testid="discrepancy-row"]')

    expect(rows[0].text()).toContain('Facturado sin destinatario')
    expect(rows[0].text()).toContain('Sin gira')
    const sid = rows[0].get('[data-testid="discrepancy-sid"]')
    expect(sid.text()).toBe('SM…ab12')
    expect(sid.attributes('title')).toBe('SM0123456789abcdef0123456789abab12')
    const d0 = norm(rows[0].get('[data-testid="discrepancy-details"]').text())
    expect(d0).toContain('Número: ***1234')
    expect(d0).toContain('Importe: 0,0050 US$')
    expect(d0).toContain('Estado en Twilio: delivered')

    expect(rows[1].text()).toContain('Estado distinto en Twilio')
    expect(rows[1].text()).toContain('Gira Norte')
    const d1 = rows[1].get('[data-testid="discrepancy-details"]').text()
    expect(d1).toContain('Estado en Twilio: undelivered')
    expect(d1).toContain('Código de error: 63016')
    expect(d1).toContain('Estado en Giras: sent')

    expect(rows[2].text()).toContain('Enviado sin SID de Twilio')
    expect(rows[2].find('[data-testid="discrepancy-sid"]').exists()).toBe(false)
    expect(rows[2].get('[data-testid="discrepancy-details"]').text()).toContain('Tipo: Day sheet')

    expect(norm(rows[3].get('[data-testid="discrepancy-details"]').text())).toContain(
      'Importe: 0,04 €'
    )
  })

  it('shows error with retry', async () => {
    const fn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: { message: 'x', status_code: 500 } }, 500)
      )
      .mockResolvedValueOnce(jsonResponse(page([discrepancy()])))
    const w = mountPanel(fn)
    await flushPromises()
    expect(w.text()).toContain('No se han podido cargar los costes')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="discrepancy-row"]')).toHaveLength(1)
  })

  it('load more after acknowledging with open filter restarts from page 1', async () => {
    const d = (n: number) => discrepancy({ uuid: `D${n}` })
    const base = 'http://api.test/api/admin/twilio-costs/discrepancies/'
    const p2 = `${base}?page=2&page_size=20&status=open`
    const p3 = `${base}?page=3&page_size=20&status=open`
    const first = Array.from({ length: 20 }, (_, i) => d(i + 1))
    const fn = vi
      .fn<typeof fetch>()
      // Carga inicial: D1..D20, hay más.
      .mockResolvedValueOnce(jsonResponse({ count: 45, next: p2, previous: null, results: first }))
      // Revisar D1.
      .mockResolvedValueOnce(jsonResponse(discrepancy({ uuid: 'D1', status: 'acknowledged' })))
      // Recorrido desde la página 1: D1 ya no está, así que D21 sube a la página 1.
      .mockResolvedValueOnce(
        jsonResponse({
          count: 44,
          next: p2,
          previous: null,
          results: Array.from({ length: 20 }, (_, i) => d(i + 2)),
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          count: 44,
          next: p3,
          previous: null,
          results: Array.from({ length: 20 }, (_, i) => d(i + 22)),
        })
      )
    const w = mountPanel(fn)
    await flushPromises()
    await w.findAll('[data-testid="acknowledge"]')[0].trigger('click')
    await flushPromises()

    await w.get('[data-testid="load-more"]').trigger('click')
    await flushPromises()

    const resync = new URL(String(fn.mock.calls[2][0]))
    expect(resync.searchParams.get('status')).toBe('open')
    expect(resync.searchParams.get('page')).toBeNull()
    expect(String(fn.mock.calls[3][0])).toBe(p2)
    const uuids = w.findAll('[data-testid="discrepancy-row"]').map((r) => r.attributes('data-uuid'))
    // Ninguna fila perdida (D21 incluida), sin duplicados, y D1 se conserva como revisada.
    expect(uuids).toEqual(Array.from({ length: 41 }, (_, i) => `D${i + 1}`))
    expect(w.findAll('[data-testid="discrepancy-status"]')[0].text()).toBe('Revisada')
    expect(w.find('[data-testid="load-more"]').exists()).toBe(true)

    // Ya no está desplazada: el siguiente "Cargar más" sigue el `next` normal.
    fn.mockResolvedValueOnce(
      jsonResponse({ count: 44, next: null, previous: null, results: [d(42)] })
    )
    await w.get('[data-testid="load-more"]').trigger('click')
    await flushPromises()
    expect(String(fn.mock.calls[4][0])).toBe(p3)
  })

  it('uses price_unit from details for any kind', async () => {
    const fn = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        page([
          discrepancy({
            details: { counterpart_masked: '***1', amount: '0.05000', price_unit: 'EUR' },
          }),
        ])
      )
    )
    const w = mountPanel(fn)
    await flushPromises()
    expect(norm(w.get('[data-testid="discrepancy-details"]').text())).toContain(
      'Importe: 0,05 €'
    )
  })

  it('filters by tour from props and emits clearTour', async () => {
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(page([])))
    const w = mountPanel(fn, { tour: 'T1', tourName: 'Artista — Gira Norte' })
    await flushPromises()
    expect(listUrls(fn)[0].searchParams.get('tour')).toBe('T1')
    expect(w.get('[data-testid="tour-filter"]').text()).toContain('Gira: Artista — Gira Norte')
    await w.get('[data-testid="clear-tour"]').trigger('click')
    expect(w.emitted('clearTour')).toHaveLength(1)

    await w.setProps({ tour: null })
    await flushPromises()
    expect(listUrls(fn)[1].searchParams.get('tour')).toBeNull()
    expect(w.find('[data-testid="tour-filter"]').exists()).toBe(false)
  })
})
