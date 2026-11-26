import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse, mockFetch } from '@/test/http'
import MagicLinkView from './MagicLinkView.vue'

async function mountAt(query: Record<string, string>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/magic-link', component: MagicLinkView },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push({ path: '/auth/magic-link', query })
  await router.isReady()
  const w = mount({ template: '<RouterView />' }, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  i18n.global.locale.value = 'en'
})

afterEach(() => {
  i18n.global.locale.value = 'es'
  vi.unstubAllGlobals()
})

describe('MagicLinkView', () => {
  it('sin token: error traducido (EN)', async () => {
    const w = await mountAt({})
    expect(w.text()).toContain('Invalid link')
    expect(w.text()).toContain('the access token is missing')
    expect(w.text()).toContain('Back to sign in')
  })

  it('token caducado: texto i18n, no el mensaje en español del backend (EN)', async () => {
    mockFetch(jsonResponse({ error: 'Token expirado o ya usado' }, 400))
    const w = await mountAt({ token: 'abc' })
    expect(w.text()).toContain('This sign-in link is invalid or has expired.')
    expect(w.text()).not.toContain('Token expirado')
  })
})
