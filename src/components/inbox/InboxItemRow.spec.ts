import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { inboxItem } from '@/test/inbox'
import InboxItemRow from './InboxItemRow.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('InboxItemRow', () => {
  it('muestra "Revisar y enviar" en ítems que llevan a un aviso', () => {
    const w = mount(InboxItemRow, {
      props: {
        item: inboxItem({
          kind: 'flight_early',
          params: { flight_number: 'IB1', minutes: 30, route: 'MAD → BCN', notice_uuid: 'N1' },
          target: {
            type: 'notice',
            tour_uuid: 'T1',
            activity_uuid: null,
            conflict_uuid: null,
            notice_uuid: 'N1',
          },
        }),
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-testid="inbox-item-title"]').text()).toBe('Vuelo IB1 adelantado 30 min')
    expect(w.get('[data-testid="inbox-item-review"]').text()).toBe('Revisar y enviar →')
  })

  it('sin destino notice no la muestra', () => {
    const w = mount(InboxItemRow, { props: { item: inboxItem() }, global: { plugins: [i18n] } })
    expect(w.find('[data-testid="inbox-item-review"]').exists()).toBe(false)
  })

  it('leído: ya no muestra "Revisar y enviar"', () => {
    const w = mount(InboxItemRow, {
      props: {
        item: inboxItem({
          is_read: true,
          read_at: '2026-11-21T11:00:00Z',
          target: {
            type: 'notice',
            tour_uuid: 'T1',
            activity_uuid: null,
            conflict_uuid: null,
            notice_uuid: 'N1',
          },
        }),
      },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-testid="inbox-item-review"]').exists()).toBe(false)
  })
})
