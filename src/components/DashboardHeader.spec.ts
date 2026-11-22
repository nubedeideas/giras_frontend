import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import { stubMatchMedia } from '@/test/reminders'
import DashboardHeader from './DashboardHeader.vue'

const USER: AuthUser = {
  uuid: 'u1',
  email: 'oscar@example.com',
  first_name: 'Ana',
  last_name: 'Pérez',
  full_name: 'Ana Pérez',
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
}

const stubs = {
  InboxBell: { template: '<button data-test="inbox-bell-stub" />' },
  InboxPanel: { template: '<div />' },
  TourMenuPanel: {
    name: 'TourMenuPanel',
    props: ['show', 'anchor', 'mobile', 'align'],
    template: '<div data-test="tour-menu-stub" />',
  },
}

async function mountHeader({ demo = false } = {}) {
  const auth = useAuthStore()
  auth.user = { ...USER }
  auth.isDemoMode = demo
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/home', name: 'home', component: { template: '<div />' } },
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
    ],
  })
  await router.push('/home')
  await router.isReady()
  const w = mount(DashboardHeader, { global: { plugins: [i18n, router], stubs } })
  return { w, router }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DashboardHeader', () => {
  it('no pinta nombre ni email del usuario como texto', async () => {
    const { w } = await mountHeader()
    expect(w.text()).not.toContain(USER.email)
    expect(w.text()).not.toContain(USER.full_name)
    expect(w.find('[data-test="header-avatar"]').text()).toBe('AP')
  })

  it('sin nombre, el avatar usa la inicial del email', async () => {
    const { w } = await mountHeader()
    useAuthStore().user = { ...USER, first_name: '', last_name: '', full_name: '' }
    await w.vm.$nextTick()
    expect(w.find('[data-test="header-avatar"]').text()).toBe('O')
  })

  it('el avatar abre Ajustes en la pestaña general', async () => {
    const { w, router } = await mountHeader()
    const avatar = w.find('[data-test="header-avatar"]')
    expect(avatar.attributes('aria-label')).toBe('Abrir ajustes')
    expect(avatar.attributes('title')).toBe(USER.full_name)
    await avatar.trigger('click')
    await new Promise((r) => setTimeout(r))
    expect(router.currentRoute.value.fullPath).toBe('/settings?tab=general')
  })

  it('InboxBell presente fuera de demo y ausente en demo', async () => {
    expect((await mountHeader()).w.find('[data-test="inbox-bell-stub"]').exists()).toBe(true)
    setActivePinia(createPinia())
    expect((await mountHeader({ demo: true })).w.find('[data-test="inbox-bell-stub"]').exists()).toBe(
      false
    )
  })

  it('el selector de gira abre TourMenuPanel alineado a la derecha', async () => {
    const { w } = await mountHeader()
    const panel = () => w.findComponent({ name: 'TourMenuPanel' })
    expect(panel().props('show')).toBe(false)
    expect(panel().props('align')).toBe('end')
    expect(panel().props('mobile')).toBe(false)
    await w.find('[data-test="tour-select"]').trigger('click')
    expect(panel().props('show')).toBe(true)
    expect(panel().props('anchor')).toMatchObject({ width: expect.any(Number) })
  })

  it('en móvil pasa mobile al panel', async () => {
    stubMatchMedia(true)
    const { w } = await mountHeader()
    expect(w.findComponent({ name: 'TourMenuPanel' }).props('mobile')).toBe(true)
  })
})
