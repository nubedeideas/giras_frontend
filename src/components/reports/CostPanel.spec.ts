import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse, mockFetch } from '@/test/http'
import { tourCostsReport, normSpaces as norm } from '@/test/twilioCosts'
import CostPanel from './CostPanel.vue'


beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

function mountPanel() {
  return mount(CostPanel, {
    props: { tour: 'T1', from: '2026-10-23', to: '2026-11-21', tz: 'Europe/Madrid' },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
  })
}

async function mountWith(...responses: Response[]) {
  const fetchMock = mockFetch(...responses)
  const w = mountPanel()
  await flushPromises()
  return Object.assign(w, { fetchMock })
}

describe('CostPanel', () => {
  it('shows skeleton while loading', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="cost-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-testid="cost-panel"]').exists()).toBe(false)
  })

  it('shows totals average email flat line and months', async () => {
    const w = await mountWith(jsonResponse(tourCostsReport()))
    expect(w.text()).toContain('Coste de WhatsApp')
    expect(norm(w.get('[data-testid="cost-total"]').text())).toBe('1,50 US$')
    expect(norm(w.get('[data-testid="cost-messages"]').text())).toBe(
      '3 mensajes · media 0,50 US$ por mensaje'
    )
    expect(w.get('[data-testid="cost-email"]').text()).toBe(
      '2 emails · tarifa fija, no se imputa por mensaje'
    )
    const months = w.findAll('[data-testid="cost-month"]')
    expect(months).toHaveLength(2)
    expect(norm(months[1].text())).toContain('1,00 US$')
    expect(months[1].find('[style]').attributes('style')).toContain('width: 100%')
    expect(months[0].find('[style]').attributes('style')).toContain('width: 50%')
    const types = w.findAll('[data-testid="cost-type"]').map((r) => norm(r.text()))
    expect(types[0]).toContain('Recordatorio de evento')
    expect(types[1]).toContain('Sin tipo (atribuido por teléfono)')
    expect(w.find('[data-testid="cost-pending"]').exists()).toBe(false)
  })

  it('shows totals in english with singular email', async () => {
    i18n.global.locale.value = 'en'
    const report = tourCostsReport()
    report.totals.email_messages = 1
    const w = await mountWith(jsonResponse(report))
    expect(norm(w.get('[data-testid="cost-messages"]').text())).toBe(
      '3 messages · $0.50 per message on average'
    )
    expect(w.get('[data-testid="cost-email"]').text()).toBe(
      '1 email · flat fee, not charged per message'
    )
  })

  it('shows pending price note', async () => {
    const report = tourCostsReport()
    report.totals.pending_price_messages = 1
    const w = await mountWith(jsonResponse(report))
    expect(w.get('[data-testid="cost-pending"]').text()).toBe(
      '1 mensaje aún sin precio de Twilio'
    )
  })

  it('shows never synced and sync failed', async () => {
    const w = await mountWith(
      jsonResponse(tourCostsReport({ synced_at: null, last_sync_status: 'failed' }))
    )
    expect(w.get('[data-testid="cost-updated"]').text()).toBe(
      'Aún no se ha sincronizado con Twilio'
    )
    expect(w.get('[data-testid="cost-sync-failed"]').text()).toBe(
      'La última sincronización con Twilio falló'
    )

    const ok = await mountWith(jsonResponse(tourCostsReport()))
    expect(ok.get('[data-testid="cost-updated"]').text()).toMatch(/^Actualizado /)
    expect(ok.find('[data-testid="cost-sync-failed"]').exists()).toBe(false)
  })

  it('shows discrepancies link only when count is number', async () => {
    const w = await mountWith(jsonResponse(tourCostsReport({ open_discrepancies: 2 })))
    const link = w.getComponent(RouterLinkStub)
    expect(link.text()).toBe('2 discrepancias abiertas')
    expect(link.props('to')).toEqual({ path: '/admin', query: { tab: 'costs', tour: 'T1' } })

    const zero = await mountWith(jsonResponse(tourCostsReport({ open_discrepancies: 0 })))
    expect(zero.find('[data-testid="cost-discrepancies"]').exists()).toBe(false)

    // Defensa ante un backend que no lo mande: sin número, no hay enlace.
    const missing = tourCostsReport()
    delete (missing as Partial<typeof missing>).open_discrepancies
    const none = await mountWith(jsonResponse(missing))
    expect(none.find('[data-testid="cost-discrepancies"]').exists()).toBe(false)
  })

  it('hides itself on 403 and 404', async () => {
    const forbidden = await mountWith(
      jsonResponse({ success: false, error: { message: 'x', status_code: 403 } }, 403)
    )
    expect(forbidden.html()).not.toContain('Coste de WhatsApp')
    expect(forbidden.find('[data-testid="cost-error"]').exists()).toBe(false)
    expect(forbidden.find('[data-testid="cost-skeleton"]').exists()).toBe(false)

    const notFound = await mountWith(
      jsonResponse({ success: false, error: { message: 'No encontrado.', status_code: 404 } }, 404)
    )
    expect(notFound.html()).not.toContain('Coste de WhatsApp')
    expect(notFound.find('[data-testid="cost-error"]').exists()).toBe(false)
  })

  it('shows error with retry', async () => {
    const w = await mountWith(
      jsonResponse({ success: false, error: { message: 'boom', status_code: 500 } }, 500),
      jsonResponse(tourCostsReport())
    )
    const error = w.get('[data-testid="cost-error"]')
    expect(error.text()).toContain('No se han podido cargar los costes')
    await error.get('button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="cost-error"]').exists()).toBe(false)
    expect(w.find('[data-testid="cost-total"]').exists()).toBe(true)
    expect(w.fetchMock).toHaveBeenCalledTimes(2)
  })

  it('empty state', async () => {
    const report = tourCostsReport()
    report.totals = { ...report.totals, whatsapp_messages: 0, email_messages: 0, amount: '0.00000' }
    const w = await mountWith(jsonResponse(report))
    expect(w.get('[data-testid="cost-empty"]').text()).toBe('Sin envíos con coste en este periodo')
    expect(w.find('[data-testid="cost-total"]').exists()).toBe(false)
  })

  it('reloads when the range changes', async () => {
    const w = await mountWith(jsonResponse(tourCostsReport()), jsonResponse(tourCostsReport()))
    await w.setProps({ from: '2026-11-15' })
    await flushPromises()
    expect(w.fetchMock).toHaveBeenCalledTimes(2)
    expect(String(w.fetchMock.mock.calls[1][0])).toContain('from=2026-11-15')
  })
})
