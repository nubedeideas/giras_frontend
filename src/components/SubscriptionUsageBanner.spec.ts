import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch } from '@/test/reminders'
import { useToursStore } from '@/stores/tours'
import SubscriptionUsageBanner from './SubscriptionUsageBanner.vue'

function usage(percentage: number, overrides: Record<string, unknown> = {}) {
  return {
    plan_code: 'starter',
    plan_name: 'Starter',
    notifications_used: percentage * 5,
    notification_limit: 500,
    remaining: 500 - percentage * 5,
    usage_percentage: percentage,
    is_unlimited: false,
    shows_used: 1,
    shows_limit: 10,
    is_active: true,
    ...overrides,
  }
}

async function mountBanner(data: unknown) {
  stubFetch(() => jsonResponse(data))
  const tours = useToursStore()
  tours.tours = [
    {
      id: 1,
      uuid: 'T1',
      name: 'Gira',
      artist_name: 'A',
      start_date: '2026-11-01',
      end_date: '2026-11-30',
      status: 'active',
      currency: 'EUR',
      color: 'var(--acid)',
      owner_email: 'a@b.es',
      timezone: 'Europe/Madrid',
      enable_notifications: true,
      notifications_paused_at: null,
    },
  ]
  tours.setActiveTour(1)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  const w = mount(SubscriptionUsageBanner, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

describe('SubscriptionUsageBanner', () => {
  it('no aparece por debajo del 80 % ni en planes ilimitados', async () => {
    expect((await mountBanner(usage(79))).find('[data-test="usage-banner"]').exists()).toBe(false)
    expect(
      (await mountBanner(usage(100, { is_unlimited: true }))).find('[data-test="usage-banner"]')
        .exists()
    ).toBe(false)
  })

  it('80 %: aviso ámbar', async () => {
    const w = await mountBanner(usage(80))
    const banner = w.get('[data-test="usage-banner"]')
    expect(banner.attributes('data-level')).toBe('warning')
    expect(banner.classes()).toContain('bg-pending-bg')
    expect(w.get('[data-test="usage-banner-text"]').text()).toBe(
      'Esta gira ha usado el 80 % de sus WhatsApp del plan Starter.'
    )
  })

  it('100 %: aviso rojo con la frase de degradación', async () => {
    const w = await mountBanner(usage(100))
    const banner = w.get('[data-test="usage-banner"]')
    expect(banner.attributes('data-level')).toBe('reached')
    expect(banner.classes()).toContain('bg-failed-bg')
    expect(w.get('[data-test="usage-banner-text"]').text()).toBe(
      'Esta gira ha agotado los WhatsApp del plan Starter. Los recordatorios automáticos pasan a email y aviso en la app, y no se envía ningún WhatsApp hasta que cambies de plan.'
    )
  })
})
