import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import SettingsView from './SettingsView.vue'

async function mountTab(tab: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/settings', name: 'settings', component: SettingsView }],
  })
  await router.push({ path: '/settings', query: { tab } })
  await router.isReady()
  const w = shallowMount(SettingsView, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => jsonResponse({ count: 0, next: null, previous: null, results: [] }))
  )
})

afterEach(() => {
  i18n.global.locale.value = 'es'
  vi.unstubAllGlobals()
})

describe('SettingsView › Calendarios (A11, F3)', () => {
  it('textos por i18n y monta Google y las suscripciones iCal', async () => {
    i18n.global.locale.value = 'es'
    const w = await mountTab('calendars')
    expect(w.text()).toContain('Conecta Google Calendar o suscríbete a un calendario iCal')
    expect(w.findComponent({ name: 'CalendarsManager' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'IcalSubscriptionsManager' }).exists()).toBe(true)

    i18n.global.locale.value = 'en'
    const en = await mountTab('calendars')
    expect(en.text()).toContain('Connect Google Calendar or subscribe to an iCal calendar')
  })

  it('otra pestaña no monta el gestor iCal', async () => {
    const w = await mountTab('general')
    expect(w.findComponent({ name: 'IcalSubscriptionsManager' }).exists()).toBe(false)
  })
})
