import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { jsonResponse } from '@/test/http'
import TourView from './TourView.vue'

const stubs = {
  TourInsightsPanel: true,
  TourDocumentsPanel: { props: ['isAdmin'], template: '<div data-testid="docs" :data-admin="String(isAdmin)" />' },
  ScheduleConflictsPanel: true,
  TourSelectPrompt: true,
  CrewPortalPanel: { template: '<div data-testid="crew-panel" />' },
}

function setup(detail: Record<string, unknown>, ownerEmail = 'owner@x.es') {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => jsonResponse({ uuid: 'T1', ...detail }))
  )
  const auth = useAuthStore()
  auth.user = { email: 'me@x.es', is_superuser: false } as typeof auth.user
  const tours = useToursStore()
  tours.tours = [
    {
      id: 1,
      uuid: 'T1',
      name: 'Gira',
      artist_name: 'A',
      start_date: '2026-11-01',
      end_date: '2026-11-30',
      status: 'active',
      currency: 'EUR',
      color: '#a8d800',
      owner_email: ownerEmail,
    },
  ]
  tours.setActiveTour(1)
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountView() {
  return mount(TourView, { global: { plugins: [i18n], stubs } })
}

function tabLabels(w: ReturnType<typeof mountView>) {
  return w.findAll('button').map((b) => b.text())
}

describe('TourView: rol de admin', () => {
  it('current_user_is_admin=true (miembro tour_manager, no owner) muestra Crew', async () => {
    setup({ current_user_is_admin: true })
    const w = mountView()
    await flushPromises()
    expect(tabLabels(w)).toContain('Crew')
    await w.findAll('button').find((b) => b.text() === 'Documentos')!.trigger('click')
    expect(w.get('[data-testid="docs"]').attributes('data-admin')).toBe('true')
  })

  it('current_user_is_admin=false manda aunque el email coincida con el owner', async () => {
    setup({ current_user_is_admin: false }, 'me@x.es')
    const w = mountView()
    await flushPromises()
    expect(tabLabels(w)).not.toContain('Crew')
  })

  it('sin el campo en el detalle se usa el fallback por owner', async () => {
    setup({}, 'me@x.es')
    const w = mountView()
    await flushPromises()
    expect(tabLabels(w)).toContain('Crew')
  })
})
