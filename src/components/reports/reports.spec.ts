import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import ReportsSummaryPanel from './ReportsSummaryPanel.vue'
import TypeBreakdown from './TypeBreakdown.vue'

const metrics = {
  recipients: 4,
  pending: 0,
  sent: 4,
  delivered: 0,
  read: 0,
  confirmed: 1,
  failed: 0,
}

describe('ReportsSummaryPanel', () => {
  it('con tasas null (sin WhatsApp) muestra "—" en vez de 0 %', () => {
    i18n.global.locale.value = 'es'
    const w = mount(ReportsSummaryPanel, {
      props: {
        title: 'Informes',
        totals: { ...metrics, confirmable_sent: 0 },
        rates: { delivery_rate: null, read_rate: null, confirmation_rate: null },
        notificationsTotal: 4,
      },
      global: { plugins: [i18n] },
    })
    expect(w.text()).not.toContain('0%')
    expect(w.text()).toContain('Tasa de entrega—')
  })
})

describe('TypeBreakdown', () => {
  it('tasa = confirmados / confirmable_sent, y "—" si no hay confirmables', () => {
    const w = mount(TypeBreakdown, {
      props: {
        types: [
          { ...metrics, notification_type: 'event_reminder', notifications: 2, confirmable_sent: 2 },
          { ...metrics, notification_type: 'day_sheet', notifications: 4, confirmable_sent: 0 },
        ],
      },
      global: { plugins: [i18n] },
    })
    const rows = w.findAll('tbody tr').map((r) => r.findAll('td').map((c) => c.text()))
    expect(rows[0]).toEqual(['Recordatorio de evento', '2', '4', '50%'])
    expect(rows[1]).toEqual(['Day sheet', '4', '4', '—'])
  })
})
