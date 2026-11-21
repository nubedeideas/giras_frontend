import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import ImportContactsModal from './ImportContactsModal.vue'

const redirectTo = vi.hoisted(() => vi.fn())
vi.mock('@/utils/navigation', () => ({ redirectTo }))

const SCOPE_MISSING = {
  code: 'google_scope_missing',
  detail: 'Necesitas conectar Google Contactos para usar esta función.',
  purpose: 'contacts',
  required_scopes: ['https://www.googleapis.com/auth/contacts.readonly'],
  connected: true,
}

function status(contacts: boolean) {
  return {
    connected: true,
    account_email: 'tm@giras.pro',
    granted_scopes: [],
    features: { calendar: true, calendar_write: true, contacts },
    connected_at: null,
  }
}

const SUB = { id: 9, sync_enabled: true, last_synced_at: null, error_count: 0, last_error: '' }

function setupFetch(opts: { contacts: boolean | (() => boolean); syncNow?: () => Response }) {
  const fn = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    const contacts = typeof opts.contacts === 'function' ? opts.contacts() : opts.contacts
    if (url.endsWith('/integrations/google/status/')) return jsonResponse(status(contacts))
    if (url.endsWith('/integrations/google/authorize/')) {
      return jsonResponse({ authorization_url: 'https://accounts.google.com/c', state: 'S', scopes: [] })
    }
    if (url.endsWith('/integrations/contacts/')) return jsonResponse([SUB])
    if (url.endsWith('/integrations/contacts/9/sync_now/')) {
      return opts.syncNow ? opts.syncNow() : jsonResponse({ created: 1, updated: 0, deleted: 0, skipped: 0, errors: [] })
    }
    if (url.endsWith('/contacts/google-contacts/')) return jsonResponse([])
    if (url.endsWith('/contacts/roles/')) return jsonResponse([])
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

async function mountModal(props: { show: boolean; autoSync?: boolean } = { show: true }) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/contacts')
  await router.isReady()
  const w = mount(ImportContactsModal, {
    props,
    global: { plugins: [router, i18n], stubs: { transition: false } },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  redirectTo.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ImportContactsModal (pestaña Google)', () => {
  it('sin features.contacts: CTA que conecta contactos y vuelve al modal', async () => {
    const fn = setupFetch({ contacts: false })
    const w = await mountModal()
    expect(w.find('[data-testid="contacts-start-sync"]').exists()).toBe(false)
    expect(w.get('[data-testid="google-consent-text"]').text()).toContain('lea tus contactos')
    await w.get('[data-testid="google-connect-contacts"]').trigger('click')
    await flushPromises()
    const call = fn.mock.calls.find(([u]) => String(u).endsWith('/authorize/'))
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      purpose: 'contacts',
      return_to: '/contacts?import=google',
    })
    expect(redirectTo).toHaveBeenCalledWith('https://accounts.google.com/c')
  })

  it('syncNow con 403 google_scope_missing → vuelve a idle con CTA y sin error genérico', async () => {
    let granted = true
    setupFetch({
      contacts: () => granted,
      syncNow: () => {
        granted = false
        return jsonResponse(SCOPE_MISSING, 403)
      },
    })
    const w = await mountModal()
    await w.get('[data-testid="contacts-start-sync"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="google-connect-contacts"]').exists()).toBe(true)
    expect(w.text()).not.toContain('Necesitas conectar Google Contactos')
    expect(w.find('.text-red-400').exists()).toBe(false)
  })

  it('autoSync con contactos conectados arranca la sincronización al abrirse', async () => {
    const fn = setupFetch({ contacts: true })
    await mountModal({ show: true, autoSync: true })
    expect(fn.mock.calls.some(([u]) => String(u).endsWith('/contacts/9/sync_now/'))).toBe(true)
  })

  it('autoSync sin permiso no sincroniza', async () => {
    const fn = setupFetch({ contacts: false })
    await mountModal({ show: true, autoSync: true })
    expect(fn.mock.calls.some(([u]) => String(u).includes('sync_now'))).toBe(false)
  })
})
