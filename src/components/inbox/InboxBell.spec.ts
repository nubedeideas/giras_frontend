import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useInboxStore } from '@/stores/inbox'
import InboxBell from './InboxBell.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

function mountBell() {
  return mount(InboxBell, { global: { plugins: [i18n] } })
}

describe('InboxBell', () => {
  it('hides badge at 0', () => {
    const w = mountBell()
    expect(w.find('[data-testid="inbox-badge"]').exists()).toBe(false)
  })

  it('shows count and 99+', async () => {
    const inbox = useInboxStore()
    inbox.unreadCount = 7
    const w = mountBell()
    expect(w.get('[data-testid="inbox-badge"]').text()).toBe('7')
    inbox.unreadCount = 150
    await w.vm.$nextTick()
    expect(w.get('[data-testid="inbox-badge"]').text()).toBe('99+')
  })

  it('aria-label with unread count', async () => {
    const inbox = useInboxStore()
    const w = mountBell()
    expect(w.attributes('aria-label')).toBe('Notificaciones')
    inbox.unreadCount = 1
    await w.vm.$nextTick()
    expect(w.attributes('aria-label')).toBe('Notificaciones, 1 sin leer')
    inbox.unreadCount = 12
    await w.vm.$nextTick()
    expect(w.attributes('aria-label')).toBe('Notificaciones, 12 sin leer')
    i18n.global.locale.value = 'en'
    await w.vm.$nextTick()
    expect(w.attributes('aria-label')).toBe('Notifications, 12 unread')
    expect(w.attributes('aria-haspopup')).toBe('dialog')
  })

  it('toggles panel', async () => {
    const inbox = useInboxStore()
    const toggle = vi.spyOn(inbox, 'toggle').mockImplementation(async () => {
      inbox.isOpen = !inbox.isOpen
    })
    const w = mountBell()
    expect(w.attributes('aria-expanded')).toBe('false')
    await w.trigger('click')
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(w.attributes('aria-expanded')).toBe('true')
    await w.trigger('click')
    expect(w.attributes('aria-expanded')).toBe('false')
  })
})
