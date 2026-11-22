import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useAuthStore, type AuthUser } from '@/stores/auth'
import AppSidebar from './AppSidebar.vue'
import MobileNav from './MobileNav.vue'

const USER: AuthUser = {
  uuid: 'u1',
  email: 'a@b.es',
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

const PATHS = ['/home', '/events', '/calendar', '/contacts', '/tour', '/reports', '/settings']

async function makeRouter(path = '/home') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...PATHS.map((p) => ({ path: p, name: p.slice(1), component: { template: '<div />' } })),
      { path: '/admin', name: 'admin', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return router
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  useAuthStore().user = { ...USER }
})

describe('AppSidebar', () => {
  it('raíz night, "Inicio" primero y activo con relleno lima', async () => {
    const router = await makeRouter('/home')
    const w = mount(AppSidebar, { global: { plugins: [i18n, router] } })
    expect(w.find('[data-test="app-sidebar"]').classes()).toContain('sidebar-dark')
    const links = w.findAll('a[data-test^="sidebar-nav-"]')
    expect(links[0].attributes('href')).toBe('/home')
    expect(links[0].text()).toBe('Inicio')
    expect(links[0].classes()).toEqual(expect.arrayContaining(['bg-acid', 'text-night']))
    expect(links[1].classes()).not.toContain('bg-acid')
    expect(links.map((l) => l.attributes('href'))).toContain('/reports')
    expect(w.text()).not.toContain('Todas las Giras')
  })

  it('Panel Admin en ámbar solo para superuser', async () => {
    const router = await makeRouter('/events')
    expect(
      mount(AppSidebar, { global: { plugins: [i18n, router] } })
        .find('[data-test="sidebar-admin"]')
        .exists()
    ).toBe(false)
    useAuthStore().user = { ...USER, is_superuser: true }
    const w = mount(AppSidebar, { global: { plugins: [i18n, router] } })
    expect(w.find('[data-test="sidebar-admin"]').classes()).toContain('text-[#F4B26B]')
  })
  it('sin bloque de usuario y "Configuración" como última entrada', async () => {
    useAuthStore().user = { ...USER, is_superuser: true, avatar: 'https://cdn.example.com/a.png' }
    const router = await makeRouter('/settings')
    const w = mount(AppSidebar, { global: { plugins: [i18n, router] } })
    expect(w.find('[data-test="sidebar-avatar"]').exists()).toBe(false)
    expect(w.text()).not.toContain('a@b.es')
    expect(w.text()).not.toContain('Ana Pérez')
    expect(w.findAll('img').map((i) => i.attributes('alt'))).toEqual(['Giras Pro'])
    const items = w.findAll('aside > a, aside > button')
    const last = items[items.length - 1]
    expect(last.attributes('data-test')).toBe('sidebar-settings')
    expect(last.text()).toBe('Configuración')
    expect(last.classes()).toEqual(expect.arrayContaining(['bg-acid', 'text-night']))
    expect(items[items.length - 2].attributes('data-test')).toBe('sidebar-admin')
    await last.trigger('click')
    expect(w.emitted('openSettings')).toHaveLength(1)
  })
})

describe('MobileNav', () => {
  it('5 pestañas en orden, sin Giras ni Informes', async () => {
    const router = await makeRouter('/events')
    const w = mount(MobileNav, { global: { plugins: [i18n, router] } })
    expect(w.find('[data-test="mobile-nav"]').classes()).toContain('sidebar-dark')
    const links = w.findAll('[data-test="mobile-nav-link"]')
    expect(links.map((l) => l.attributes('href'))).toEqual([
      '/home',
      '/events',
      '/calendar',
      '/contacts',
      '/settings',
    ])
    expect(w.text()).not.toContain('Giras')
    expect(w.text()).not.toContain('Informes')
    expect(links[4].text()).toContain('Ajustes')
  })

  it('Ajustes muestra el engranaje, sin avatar ni iniciales', async () => {
    useAuthStore().user = { ...USER, avatar: 'https://cdn.example.com/a.png' }
    const router = await makeRouter('/home')
    const w = mount(MobileNav, { global: { plugins: [i18n, router] } })
    expect(w.find('[data-test="mobile-nav-avatar"]').exists()).toBe(false)
    expect(w.find('img').exists()).toBe(false)
    const icon = w.find('[data-test="mobile-nav-settings-icon"]')
    expect(icon.find('svg circle').exists()).toBe(true)
    expect(icon.classes()).not.toContain('bg-acid')
    expect(w.text()).not.toContain('AP')
  })

  it('Ajustes activo con píldora lima en /settings', async () => {
    const router = await makeRouter('/settings')
    const w = mount(MobileNav, { global: { plugins: [i18n, router] } })
    const icon = w.find('[data-test="mobile-nav-settings-icon"]')
    expect(icon.classes()).toEqual(expect.arrayContaining(['bg-acid', 'text-night']))
  })

  it('Inicio activo por nombre de ruta', async () => {
    const router = await makeRouter('/home')
    const w = mount(MobileNav, { global: { plugins: [i18n, router] } })
    const first = w.findAll('[data-test="mobile-nav-link"]')[0]
    expect(first.find('span').classes()).toContain('bg-acid')
  })
})
