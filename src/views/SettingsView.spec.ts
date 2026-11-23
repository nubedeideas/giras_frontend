import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import SettingsView from './SettingsView.vue'

async function mountTab(tab: string, extra: Record<string, string> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/settings', name: 'settings', component: SettingsView }],
  })
  await router.push({ path: '/settings', query: { tab, ...extra } })
  await router.isReady()
  const w = shallowMount(SettingsView, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return Object.assign(w, { router })
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
  it('F4: "Calendarios y hojas", monta Google, iCal y las hojas de Google', async () => {
    i18n.global.locale.value = 'es'
    const w = await mountTab('calendars')
    expect(w.text()).toContain('Calendarios y hojas')
    expect(w.text()).toContain(
      'Conecta Google Calendar, suscríbete a un calendario iCal o vincula una hoja de Google.'
    )
    expect(w.findComponent({ name: 'CalendarsManager' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'IcalSubscriptionsManager' }).exists()).toBe(true)
    const sheets = w.findComponent({ name: 'SheetSubscriptionsManager' })
    expect(sheets.exists()).toBe(true)
    expect(sheets.props('openNew')).toBe(false)

    i18n.global.locale.value = 'en'
    const en = await mountTab('calendars')
    expect(en.text()).toContain('Calendars and sheets')
    expect(en.text()).toContain('Connect Google Calendar, subscribe to an iCal calendar')
  })

  it('F4: ?sheets=new (vuelta del OAuth) abre el alta de la hoja y limpia el parámetro', async () => {
    const w = await mountTab('calendars', { sheets: 'new', google_connect: 'ok', purpose: 'sheets' })
    expect(w.findComponent({ name: 'SheetSubscriptionsManager' }).props('openNew')).toBe(true)
    const q = w.router.currentRoute.value.query
    expect(q.sheets).toBeUndefined()
    expect(q.tab).toBe('calendars')
    expect(q.google_connect).toBe('ok')
  })

  it('otra pestaña no monta el gestor iCal', async () => {
    const w = await mountTab('general')
    expect(w.findComponent({ name: 'IcalSubscriptionsManager' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'SheetSubscriptionsManager' }).exists()).toBe(false)
  })
})
