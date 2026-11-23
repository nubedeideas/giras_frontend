import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { useActivitiesStore } from '@/stores/activities'
import type { Activity } from '@/composables/useActivities'
import ActivityDetail from './ActivityDetail.vue'

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    uuid: 'A1',
    title: 'Concierto',
    description: '',
    scheduled_at: '2027-03-03T20:00:00Z',
    end_at: null,
    timezone: 'Europe/Madrid',
    all_day: false,
    status: 'scheduled',
    priority: 'normal',
    location_name: '',
    location_address: '',
    destination_name: '',
    destination_address: '',
    destination_timezone: '',
    notes: '',
    cost: null,
    currency: 'EUR',
    external_id: '',
    external_source: '',
    activity_type: null,
    created_at: '2026-11-23T10:00:00Z',
    updated_at: '2026-11-23T10:00:00Z',
    ...overrides,
  }
}

async function mountWith(source: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  useActivitiesStore().selectedDetail = activity({ external_source: source })
  const w = shallowMount(ActivityDetail, {
    global: { plugins: [i18n, router], stubs: { GlassBlock: false } },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => jsonResponse({ count: 0, next: null, previous: null, results: [] }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ActivityDetail › origen (F3)', () => {
  it('etiquetas por i18n de google_calendar, ics e import_job; el resto tal cual', async () => {
    expect((await mountWith('ics')).get('[data-test="activity-source"]').text()).toBe(
      'Calendario (.ics / iCal)'
    )
    expect((await mountWith('import_job')).get('[data-test="activity-source"]').text()).toBe(
      'Importación'
    )
    expect((await mountWith('google_calendar')).get('[data-test="activity-source"]').text()).toBe(
      'Google Calendar'
    )
    expect((await mountWith('gsheet')).get('[data-test="activity-source"]').text()).toBe(
      'Hoja de Google'
    )
    expect((await mountWith('otro')).get('[data-test="activity-source"]').text()).toBe('otro')
    expect((await mountWith('')).find('[data-test="activity-source"]').exists()).toBe(false)
  })
})
