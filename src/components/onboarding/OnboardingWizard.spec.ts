import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { RESUME_KEY } from '@/utils/googleOAuth'
import OnboardingWizard from './OnboardingWizard.vue'
import OnbCalendarStep from './OnbCalendarStep.vue'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'

const redirectTo = vi.hoisted(() => vi.fn())
vi.mock('@/utils/navigation', () => ({ redirectTo }))

const NOT_CONNECTED = {
  connected: false,
  account_email: '',
  granted_scopes: [],
  features: { calendar: false, contacts: false },
  connected_at: null,
}

function setupFetch() {
  const fn = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    if (url.endsWith('/integrations/google/status/')) return jsonResponse(NOT_CONNECTED)
    if (url.endsWith('/integrations/google/authorize/')) {
      return jsonResponse({ authorization_url: 'https://accounts.google.com/cal', state: 'S', scopes: [] })
    }
    return jsonResponse([])
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/home')
  await router.isReady()
  return router
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

describe('OnboardingWizard', () => {
  it("initialStep='calendar' arranca en ese paso con initialTourId", async () => {
    setupFetch()
    const router = await makeRouter()
    const w = mount(OnboardingWizard, {
      props: { initialStep: 'calendar', initialTourId: 42 },
      global: { plugins: [router, i18n], stubs: { teleport: true, transition: false } },
    })
    await flushPromises()
    const step = w.findComponent(OnbCalendarStep)
    expect(step.exists()).toBe(true)
    expect(step.props('tourId')).toBe(42)
  })

  it('sin initialStep empieza en la gira', async () => {
    setupFetch()
    const router = await makeRouter()
    const w = mount(OnboardingWizard, {
      global: {
        plugins: [router, i18n],
        stubs: { teleport: true, transition: false, OnbTourStep: { template: '<div data-testid="tour-step" />' } },
      },
    })
    await flushPromises()
    expect(w.find('[data-testid="tour-step"]').exists()).toBe(true)
  })
})

describe('OnbCalendarStep', () => {
  it('sin calendario conectado muestra Conectar y Saltar; no lista calendarios', async () => {
    const fn = setupFetch()
    const router = await makeRouter()
    const w = mount(OnbCalendarStep, {
      props: { tourId: 42 },
      global: { plugins: [router, i18n] },
    })
    await flushPromises()
    expect(w.find('[data-testid="onb-calendar-disconnected"]').exists()).toBe(true)
    expect(w.get('[data-testid="google-connect-calendar"]').text()).toBe('Conectar Google Calendar')
    expect(fn.mock.calls.some(([u]) => String(u).includes('google_calendars'))).toBe(false)

    await w.get('[data-testid="onb-calendar-skip"]').trigger('click')
    expect(w.emitted('skip')).toHaveLength(1)
  })

  it('Conectar guarda el punto de retorno del asistente (uuid de la gira) y vuelve a /home', async () => {
    const fn = setupFetch()
    useToursStore().tours = [{ id: 42, uuid: 'T42', name: 'Gira' } as Tour]
    const router = await makeRouter()
    const w = mount(OnbCalendarStep, {
      props: { tourId: 42 },
      global: { plugins: [router, i18n] },
    })
    await flushPromises()
    await w.get('[data-testid="google-connect-calendar"]').trigger('click')
    await flushPromises()
    const call = fn.mock.calls.find(([u]) => String(u).endsWith('/authorize/'))
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ purpose: 'calendar', return_to: '/home' })
    expect(JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? 'null')).toMatchObject({
      step: 'calendar',
      tourUuid: 'T42',
    })
    expect(redirectTo).toHaveBeenCalledWith('https://accounts.google.com/cal')
  })
})
