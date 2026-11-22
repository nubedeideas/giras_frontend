import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubMatchMedia } from '@/test/reminders'
import { useToursStore } from '@/stores/tours'
import { useUIState } from '@/composables/useUIState'
import { RESUME_KEY } from '@/utils/googleOAuth'
import AppLayout from './AppLayout.vue'

vi.mock('@/composables/usePageMeta', () => ({ useNoIndex: () => {} }))
vi.mock('@/composables/useInboxPolling', () => ({ useInboxPolling: () => {} }))

function tour(uuid: string) {
  return {
    uuid,
    name: `Gira ${uuid}`,
    artist_name: 'A',
    start_date: '2026-12-01',
    end_date: '2026-12-31',
    status: 'active',
    status_display: 'Activa',
    spotify_image_url: null,
    members_count: 1,
    events_count: 0,
    duration_days: 30,
    owner_email: 'me@x.es',
    timezone: 'Europe/Madrid',
    enable_notifications: true,
    notifications_paused_at: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  }
}

const WizardStub = {
  name: 'OnboardingWizard',
  props: ['initialStep', 'initialTourId'],
  template: '<div data-testid="wizard" />',
}

async function mountLayout() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', name: 'home', component: { template: '<div />' } }],
  })
  await router.push('/home')
  await router.isReady()
  const w = mount(AppLayout, {
    global: {
      plugins: [router, i18n],
      stubs: {
        AppSidebar: true,
        MobileNav: true,
        DashboardHeader: true,
        SubscriptionUsageBanner: true,
        OnboardingWizard: WizardStub,
      },
    },
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
  stubMatchMedia(false)
  useUIState().closeWizard()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppLayout: vuelta del OAuth al asistente', () => {
  it('reabre el asistente con la gira guardada por uuid aunque cambie el orden de GET /tours/', async () => {
    // Tras la recarga, /tours/ trae primero otra gira: su id sintético es el "primero" de la
    // sesión, que antes del redirect era el de la gira del asistente.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({
          count: 2,
          next: null,
          previous: null,
          results: [tour('RESUME-OTRA'), tour('RESUME-MIA')],
        })
      )
    )
    sessionStorage.setItem(
      RESUME_KEY,
      JSON.stringify({ step: 'crew', tourUuid: 'RESUME-MIA', createdAt: Date.now() })
    )
    const w = await mountLayout()
    const wizard = w.findComponent(WizardStub)
    expect(wizard.exists()).toBe(true)
    expect(wizard.props('initialStep')).toBe('crew')
    const store = useToursStore()
    const id = wizard.props('initialTourId') as number
    expect(store.tours.find((t) => t.id === id)?.uuid).toBe('RESUME-MIA')
    expect(store.tours.find((t) => t.uuid === 'RESUME-OTRA')?.id).not.toBe(id)
  })

  it('un uuid que ya no está en la lista abre el asistente sin gira, nunca con otra', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ count: 1, next: null, previous: null, results: [tour('RESUME-X')] })
      )
    )
    sessionStorage.setItem(
      RESUME_KEY,
      JSON.stringify({ step: 'calendar', tourUuid: 'BORRADA', createdAt: Date.now() })
    )
    const w = await mountLayout()
    expect(w.findComponent(WizardStub).props('initialTourId')).toBeNull()
  })
})
