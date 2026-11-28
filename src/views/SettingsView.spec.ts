import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import SettingsView from './SettingsView.vue'

/** Usuario en el store antes de montar (en la app lo carga el guard con `fetchMe()`). */
function setUser(overrides: Partial<AuthUser> = {}) {
  useAuthStore().user = {
    uuid: 'u1',
    email: 'tm@giras.pro',
    first_name: 'Tour',
    last_name: 'Manager',
    full_name: 'Tour Manager',
    phone_number: null,
    avatar: null,
    bio: '',
    timezone: 'Europe/Madrid',
    language: 'es',
    google_id: null,
    telegram_id: null,
    is_verified: true,
    is_active: true,
    is_staff: false,
    is_superuser: false,
    ...overrides,
  }
}

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

describe('SettingsView › General', () => {
  it('ayuda del teléfono nueva en ES y EN', async () => {
    setUser()
    const w = await mountTab('general')
    expect(w.text()).toContain('Lo usamos para avisarte de cambios en tus Giras.')

    i18n.global.locale.value = 'en'
    const en = await mountTab('general')
    expect(en.text()).toContain('We use it to let you know about changes to your tours.')
  })

  it('integraciones sin proveedores (Twilio, Mailgun, Apple) en ES y EN', async () => {
    setUser()
    const w = await mountTab('general')
    for (const name of ['Google Calendar', 'WhatsApp', 'Email', 'Pases de Wallet']) {
      expect(w.text()).toContain(name)
    }
    for (const provider of ['Twilio', 'Mailgun', 'Apple']) expect(w.text()).not.toContain(provider)

    i18n.global.locale.value = 'en'
    const en = await mountTab('general')
    expect(en.text()).toContain('Wallet passes')
    for (const provider of ['Twilio', 'Mailgun', 'Apple']) expect(en.text()).not.toContain(provider)
  })
})

describe('SettingsView › Actividades', () => {
  it('título y subtítulo que explican los tipos del sistema y los propios (ES y EN)', async () => {
    setUser()
    const w = await mountTab('activities')
    expect(w.text()).toContain('Tipos de actividad')
    expect(w.text()).toContain('no se pueden editar')
    expect(w.text()).toContain('crea tus propios tipos personalizados')

    i18n.global.locale.value = 'en'
    const en = await mountTab('activities')
    expect(en.text()).toContain('Activity types')
    expect(en.text()).toContain('create your own custom types')
  })
})

describe('SettingsView › Recordatorios', () => {
  it('card "¿Cómo funcionan?" con límites, destinatarios y cupo', async () => {
    setUser()
    const w = await mountTab('reminders')
    const card = w.get('[data-test="reminders-how"]').text()
    expect(card).toContain('¿Cómo funcionan?')
    expect(card).toContain('hasta 5 recordatorios')
    expect(card).toContain('desde 5 minutos hasta 14 días')
    expect(card).toContain('Equipo de la gira')
    expect(card).toContain('cupo de WhatsApp')

    i18n.global.locale.value = 'en'
    const en = await mountTab('reminders')
    expect(en.get('[data-test="reminders-how"]').text()).toContain('from 5 minutes to 14 days')
  })
})

describe('SettingsView › Templates solo para superusers', () => {
  const navLabels = (w: Awaited<ReturnType<typeof mountTab>>) =>
    w.findAll('nav button').map((b) => b.text())

  it('usuario normal: la navegación no tiene "Templates"', async () => {
    setUser({ is_superuser: false })
    const w = await mountTab('general')
    expect(navLabels(w)).not.toContain('Templates')
    expect(navLabels(w)).toContain('General')
  })

  it('?tab=templates sin superuser → redirige a general y no monta las plantillas', async () => {
    setUser({ is_superuser: false })
    const w = await mountTab('templates')
    await flushPromises()
    expect(w.router.currentRoute.value.query.tab).toBe('general')
    expect(w.findComponent({ name: 'NotificationTemplatesView' }).exists()).toBe(false)
    expect(w.text()).toContain('Lo usamos para avisarte de cambios en tus Giras.')
  })

  it('superuser: ve la pestaña y ?tab=templates monta las plantillas sin redirigir', async () => {
    setUser({ is_superuser: true })
    const w = await mountTab('templates')
    await flushPromises()
    expect(navLabels(w)).toContain('Templates')
    expect(w.router.currentRoute.value.query.tab).toBe('templates')
    expect(w.findComponent({ name: 'NotificationTemplatesView' }).exists()).toBe(true)
  })

  it('?tab=foo → redirige a general', async () => {
    setUser()
    const w = await mountTab('foo')
    await flushPromises()
    expect(w.router.currentRoute.value.query.tab).toBe('general')
    expect(w.text()).toContain('Lo usamos para avisarte de cambios en tus Giras.')
  })
})
