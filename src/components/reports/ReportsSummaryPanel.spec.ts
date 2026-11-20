import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import ReportsSummaryPanel from './ReportsSummaryPanel.vue'

const totals = { sent: 1, delivered: 1, read: 1, failed: 0, pending: 0, confirmed: 0, confirmable_sent: 0 }
const rates = { delivery_rate: null, read_rate: null, confirmation_rate: null }

function line(crewPortal?: { links: number; viewed: number; views: number }, locale = 'es') {
  i18n.global.locale.value = locale as 'es'
  const w = mount(ReportsSummaryPanel, {
    props: { title: 'T', totals: totals as never, rates, notificationsTotal: 1, crewPortal },
    global: { plugins: [i18n], stubs: { SummaryDonut: true } },
  })
  return w.find('[data-testid="crew-portal-summary"]')
}

describe('ReportsSummaryPanel: portal del crew', () => {
  it('no sale sin enlaces', () => {
    expect(line().exists()).toBe(false)
    expect(line({ links: 0, viewed: 0, views: 0 }).exists()).toBe(false)
  })

  it('plural correcto de visitas', () => {
    expect(line({ links: 3, viewed: 1, views: 1 }).text()).toBe(
      'Portal del crew: 1 de 3 han abierto su agenda · 1 visita'
    )
    expect(line({ links: 3, viewed: 2, views: 5 }).text()).toContain('· 5 visitas')
    expect(line({ links: 3, viewed: 0, views: 0 }).text()).toContain('· 0 visitas')
    expect(line({ links: 3, viewed: 1, views: 1 }, 'en').text()).toBe(
      'Crew portal: 1 of 3 have opened their schedule · 1 visit'
    )
  })
})
