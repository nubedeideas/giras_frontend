import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch, stubMatchMedia } from '@/test/reminders'
import { notice } from '@/test/notices'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import TourView from './TourView.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

async function mountView(query: Record<string, string>) {
  const fn = stubFetch((url) => {
    if (url.pathname.endsWith('/tours/T1/')) {
      return jsonResponse({ uuid: 'T1', current_user_is_admin: true, can_manage_crew: false })
    }
    if (url.pathname.endsWith('/notices/')) {
      return jsonResponse({ count: 1, next: null, previous: null, results: [notice()] })
    }
    return jsonResponse({}, 404)
  })
  const tours = useToursStore()
  tours.tours = [{ id: 1, uuid: 'T1', name: 'Gira', current_user_is_admin: true } as Tour]
  tours.setActiveTour(1)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push({ path: '/tour', query })
  const replace = vi.spyOn(router, 'replace')
  const w = mount(TourView, {
    global: {
      plugins: [i18n, router],
      stubs: {
        NoticesPanel: true,
        TourInsightsPanel: true,
        TourDocumentsPanel: true,
        ScheduleConflictsPanel: true,
        CrewPortalPanel: true,
        TourRemindersPanel: true,
      },
    },
  })
  await flushPromises()
  return { w, fn, replace }
}

describe('TourView: pestaña Avisos', () => {
  it('deep link tab+notice: abre Avisos con el aviso y limpia la query en un solo replace', async () => {
    const { w, replace } = await mountView({ tab: 'notices', notice: 'N1' })
    const panel = w.findComponent({ name: 'NoticesPanel' })
    expect(panel.exists()).toBe(true)
    expect(panel.props('initialNotice')).toBe('N1')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace.mock.calls[0][0]).toEqual({ query: { tab: undefined, notice: undefined } })
  })

  it('contador de pendientes con una sola petición de listado', async () => {
    const { w, fn } = await mountView({})
    expect(w.get('[data-test="notices-tab-count"]').text()).toBe('1')
    const lists = fn.mock.calls.filter(([u]) => new URL(String(u)).pathname.endsWith('/notices/'))
    expect(lists).toHaveLength(1)
  })
})
