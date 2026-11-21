import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { rule, ruleOptions } from '@/test/rules'
import { useToursStore } from '@/stores/tours'
import RuleListItem from './RuleListItem.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

async function mountItem(overrides: Parameters<typeof rule>[0]) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/settings')
  await router.isReady()
  const w = mount(RuleListItem, {
    props: { rule: rule(overrides), options: ruleOptions() },
    global: { plugins: [i18n, router] },
  })
  return Object.assign(w, { router })
}

describe('RuleListItem: activity_upcoming pasa a Recordatorios', () => {
  it('avisa y enlaza a la pestaña Recordatorios de la gira', async () => {
    useToursStore().tours = [
      {
        id: 1,
        uuid: 'tour-1',
        name: 'Gira',
        artist_name: 'A',
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        status: 'active',
        currency: 'EUR',
        color: 'var(--acid)',
        owner_email: 'a@b.es',
      },
    ]
    const w = await mountItem({ trigger: 'activity_upcoming', is_editable: false, tour: 'tour-1' })
    expect(w.get('[data-test="rule-moved-to-reminders"]').text()).toContain(
      'Los avisos antes de la actividad se configuran ahora en Recordatorios.'
    )
    await w.get('[data-test="rule-go-to-reminders"]').trigger('click')
    await flushPromises()
    expect(w.router.currentRoute.value.fullPath).toBe('/tour?tab=reminders')
  })

  it('sin gira en la lista lleva a Configuración → Recordatorios', async () => {
    const w = await mountItem({ trigger: 'activity_upcoming', tour: null })
    await w.get('[data-test="rule-go-to-reminders"]').trigger('click')
    await flushPromises()
    expect(w.router.currentRoute.value.fullPath).toBe('/settings?tab=reminders')
  })

  it('no avisa en otros disparadores', async () => {
    const w = await mountItem({ trigger: 'activity_created' })
    expect(w.find('[data-test="rule-moved-to-reminders"]').exists()).toBe(false)
  })
})
