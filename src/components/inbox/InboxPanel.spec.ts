import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import i18n from '@/i18n'
import { inboxApi } from '@/composables/useInbox'
import { useInboxStore } from '@/stores/inbox'
import { useToursStore } from '@/stores/tours'
import { inboxItem } from '@/test/inbox'
import InboxBell from './InboxBell.vue'
import InboxPanel from './InboxPanel.vue'

const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const Host = defineComponent({
  setup() {
    return () => h('div', [h(InboxBell), h(InboxPanel)])
  },
})

function page(results = [inboxItem()], next: string | null = null) {
  return { count: results.length, next, previous: null, results }
}

function mountHost() {
  return mount(Host, { attachTo: document.body, global: { plugins: [i18n] } })
}

const $ = (sel: string) => document.body.querySelector(sel) as HTMLElement | null

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  push.mockReset().mockResolvedValue(undefined)
  vi.spyOn(inboxApi, 'getUnreadCount').mockResolvedValue({
    unread: 1,
    latest_occurred_at: '2026-11-21T10:00:00Z',
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('InboxPanel', () => {
  it('shows skeleton while loading', async () => {
    vi.spyOn(inboxApi, 'listInbox').mockReturnValue(new Promise(() => {}))
    const w = mountHost()
    void useInboxStore().open()
    await flushPromises()
    expect($('[data-testid="inbox-skeleton"]')).not.toBeNull()
    expect($('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('inbox-panel-title')
    w.unmount()
  })

  it('shows empty per filter', async () => {
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([]))
    const w = mountHost()
    const inbox = useInboxStore()
    await inbox.open()
    await flushPromises()
    expect($('[data-testid="inbox-empty"]')?.textContent?.trim()).toBe('No tienes notificaciones.')
    $('[data-testid="inbox-filter-unread"]')!.click()
    await flushPromises()
    expect(inbox.filter).toBe('unread')
    expect($('[data-testid="inbox-empty"]')?.textContent?.trim()).toBe('Lo tienes todo al día.')
    w.unmount()
  })

  it('shows error with retry', async () => {
    const list = vi
      .spyOn(inboxApi, 'listInbox')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page())
    const w = mountHost()
    await useInboxStore().open()
    await flushPromises()
    expect($('[data-testid="inbox-error"]')?.textContent).toContain(
      'No se han podido cargar las notificaciones.'
    )
    ;($('[data-testid="inbox-retry"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(2)
    expect($('[data-testid="inbox-error"]')).toBeNull()
    expect(document.body.querySelectorAll('[data-testid="inbox-item"]').length).toBe(1)
    w.unmount()
  })

  it('clicking an item marks read, activates tour and navigates', async () => {
    const item = inboxItem({
      kind: 'flight_delay',
      params: {
        flight_number: 'IB1',
        route: 'MAD → BCN',
        delay_minutes: 45,
        prev_delay_minutes: 0,
      },
      target: { type: 'activity', tour_uuid: 'T2', activity_uuid: 'A1', conflict_uuid: null },
    })
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([item]))
    const read = vi
      .spyOn(inboxApi, 'markInboxRead')
      .mockResolvedValue({ item: { ...item, is_read: true }, unread: 0 })
    const tours = useToursStore()
    const setActive = vi.spyOn(tours, 'setActiveTourByUuid').mockReturnValue(true)
    const w = mountHost()
    const inbox = useInboxStore()
    await inbox.open()
    await flushPromises()
    expect($('[data-testid="inbox-item-title"]')?.textContent).toBe(
      'Vuelo IB1 con 45 min de retraso'
    )

    $('[data-testid="inbox-item"]')!.click()
    await flushPromises()
    expect(read).toHaveBeenCalledWith(item.uuid)
    expect(setActive).toHaveBeenCalledWith('T2')
    expect(push).toHaveBeenCalledWith({ path: '/events', query: { activity: 'A1' } })
    expect(inbox.isOpen).toBe(false)
    expect(inbox.unreadCount).toBe(0)
    w.unmount()
  })

  it('item without target only marks read and keeps panel open', async () => {
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([inboxItem()]))
    const read = vi
      .spyOn(inboxApi, 'markInboxRead')
      .mockResolvedValue({ item: inboxItem({ is_read: true }), unread: 0 })
    const setActive = vi.spyOn(useToursStore(), 'setActiveTourByUuid')
    const w = mountHost()
    const inbox = useInboxStore()
    await inbox.open()
    await flushPromises()
    $('[data-testid="inbox-item"]')!.click()
    await flushPromises()
    expect(read).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
    expect(setActive).not.toHaveBeenCalled()
    expect(inbox.isOpen).toBe(true)
    w.unmount()
  })

  it('mark all read disabled at 0', async () => {
    vi.spyOn(inboxApi, 'getUnreadCount').mockResolvedValue({ unread: 0, latest_occurred_at: null })
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([inboxItem({ is_read: true })]))
    const all = vi.spyOn(inboxApi, 'markAllInboxRead')
    const w = mountHost()
    await useInboxStore().open()
    await flushPromises()
    const btn = $('[data-testid="inbox-mark-all"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    btn.click()
    await flushPromises()
    expect(all).not.toHaveBeenCalled()
    w.unmount()
  })

  it('escape closes and returns focus', async () => {
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([]))
    const w = mountHost()
    const inbox = useInboxStore()
    $('#inbox-bell')!.click()
    await flushPromises()
    expect(inbox.isOpen).toBe(true)
    expect(document.activeElement?.id).toBe('inbox-panel')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(inbox.isOpen).toBe(false)
    expect($('[role="dialog"]')).toBeNull()
    expect(document.activeElement?.id).toBe('inbox-bell')
    w.unmount()
  })

  it('never renders html from message body', async () => {
    const item = inboxItem({
      kind: 'message',
      title: '<img src=x onerror=alert(1)>',
      body: '<b>negrita</b> <script>alert(1)</script>',
    })
    vi.spyOn(inboxApi, 'listInbox').mockResolvedValue(page([item]))
    const w = mountHost()
    await useInboxStore().open()
    await flushPromises()
    const body = $('[data-testid="inbox-item-body"]')!
    expect(body.textContent).toBe('<b>negrita</b> <script>alert(1)</script>')
    expect(body.querySelector('b')).toBeNull()
    expect(body.querySelector('script')).toBeNull()
    expect($('[data-testid="inbox-item-title"]')!.querySelector('img')).toBeNull()
    w.unmount()
  })
})
