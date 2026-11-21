import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import GoogleConnectNotice from './GoogleConnectNotice.vue'

async function mountAt(query: Record<string, string>, props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push({ path: '/settings', query: { tab: 'calendars', ...query } })
  await router.isReady()
  const w = mount(GoogleConnectNotice, { props, global: { plugins: [router, i18n] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout'] })
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GoogleConnectNotice', () => {
  it.each([
    [{ google_connect: 'ok', purpose: 'calendar' }, 'Google Calendar conectado.'],
    [
      { google_connect: 'partial', purpose: 'contacts' },
      'No has concedido el permiso necesario para Google Contactos.',
    ],
    [{ google_connect: 'denied', purpose: 'calendar' }, 'Has cancelado la conexión con Google.'],
    [
      { google_connect: 'error', purpose: 'calendar', reason: 'google_account_mismatch' },
      'Conecta la misma cuenta de Google con la que entras en Giras.',
    ],
    [
      { google_connect: 'error', purpose: 'calendar', reason: 'raro' },
      'No hemos podido conectar con Google. Inténtalo de nuevo.',
    ],
  ])('%o → %s', async (query, text) => {
    const { w } = await mountAt(query)
    expect(w.get('[data-testid="google-connect-notice"]').text()).toContain(text)
  })

  it('a los 6 s limpia los parámetros y conserva el resto', async () => {
    const { w, router } = await mountAt({ google_connect: 'ok', purpose: 'calendar' })
    vi.advanceTimersByTime(6000)
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ tab: 'calendars' })
    expect(w.find('[data-testid="google-connect-notice"]').exists()).toBe(false)
  })

  it('con purpose solo se muestra para ese propósito', async () => {
    const { w } = await mountAt({ google_connect: 'ok', purpose: 'calendar' }, { purpose: 'contacts' })
    expect(w.find('[data-testid="google-connect-notice"]').exists()).toBe(false)
  })

  it('sin google_connect no muestra nada', async () => {
    const { w } = await mountAt({})
    expect(w.find('[data-testid="google-connect-notice"]').exists()).toBe(false)
  })
})
