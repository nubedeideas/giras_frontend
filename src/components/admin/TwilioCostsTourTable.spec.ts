import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { costsTourRow, normSpaces as norm } from '@/test/twilioCosts'
import type { TwilioCostsTourRow } from '@/composables/useAdminTwilioCosts'
import TwilioCostsTourTable from './TwilioCostsTourTable.vue'


beforeEach(() => {
  i18n.global.locale.value = 'es'
})

function mountTable(tours: TwilioCostsTourRow[], truncated = false) {
  return mount(TwilioCostsTourTable, {
    props: { tours, currency: 'USD', truncated },
    global: { plugins: [i18n] },
  })
}

const ROWS = [
  costsTourRow({
    tour_uuid: 'A',
    tour_name: 'A',
    amount_month: '1.00000',
    amount_total: '9.00000',
    margin_total: '10.00000',
  }),
  costsTourRow({
    tour_uuid: 'B',
    tour_name: 'B',
    amount_month: '3.00000',
    amount_total: '4.00000',
    margin_total: null,
    margin_pct: null,
  }),
  costsTourRow({
    tour_uuid: 'C',
    tour_name: 'C',
    amount_month: '2.00000',
    amount_total: '20.00000',
    margin_total: '50.00000',
  }),
]

const order = (w: ReturnType<typeof mountTable>) =>
  w.findAll('[data-testid="tour-row"]').map((r) => r.findAll('td')[0].text().split(' — ')[1])

describe('TwilioCostsTourTable', () => {
  it('sorts by cost month by default', async () => {
    const w = mountTable(ROWS)
    expect(order(w)).toEqual(['B', 'C', 'A'])
    await w.get('[data-testid="sort-amount_total"]').trigger('click')
    expect(order(w)).toEqual(['C', 'A', 'B'])
    // Margen null al final.
    await w.get('[data-testid="sort-margin_total"]').trigger('click')
    expect(order(w)).toEqual(['C', 'A', 'B'])
  })

  it('negative margin uses orange', () => {
    const w = mountTable([costsTourRow({ margin_total: '-2.50000', margin_pct: -12.5 })])
    const margin = w.get('[data-testid="margin"]')
    expect(margin.classes()).toContain('text-brand-orange')
    expect(norm(margin.text())).toBe('-2,50 US$')
    expect(w.get('[data-testid="margin-pct"]').classes()).toContain('text-brand-orange')
    expect(norm(w.get('[data-testid="margin-pct"]').text())).toBe('-12,5 %')

    const positive = mountTable([costsTourRow()])
    expect(positive.get('[data-testid="margin"]').classes()).not.toContain('text-brand-orange')
  })

  it('null margin shows dash with title', () => {
    const w = mountTable([costsTourRow({ margin_total: null, margin_pct: null })])
    const margin = w.get('[data-testid="margin"]')
    expect(margin.text()).toBe('—')
    expect(margin.attributes('title')).toBe('Moneda distinta o sin pagos')
    expect(w.get('[data-testid="margin-pct"]').text()).toBe('—')
  })

  it('truncated note', () => {
    expect(mountTable(ROWS).find('[data-testid="truncated"]').exists()).toBe(false)
    const w = mountTable(ROWS, true)
    expect(w.get('[data-testid="truncated"]').text()).toBe(
      'Solo se muestran las 3 giras con más coste'
    )
  })

  it('shows deleted tours, unlimited usage and the plan', () => {
    const w = mountTable([
      costsTourRow({ is_deleted: true, notification_limit: 0, notifications_used: 7 }),
    ])
    const cells = w.findAll('td').map((c) => c.text())
    expect(cells[0]).toContain('borrada')
    expect(cells[2]).toBe('Starter')
    expect(cells[4]).toBe('7 / ilimitado')
  })

  it('paid uses plan currency without payments and dash for MIXED', () => {
    const none = mountTable([
      costsTourRow({ paid_amount: '0.00000', paid_currency: null, plan_currency: 'EUR' }),
    ])
    expect(norm(none.get('[data-testid="paid"]').text())).toBe('0,00 €')

    const mixed = mountTable([costsTourRow({ paid_amount: '300.00000', paid_currency: 'MIXED' })])
    const cell = mixed.get('[data-testid="paid"]')
    expect(cell.text()).toBe('—')
    expect(cell.attributes('title')).toBe('Pagos en varias monedas: el importe no se puede sumar')
  })
})
