import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { jsonResponse } from '@/test/http'
import { adminTour } from '@/test/icalSubscriptions'
import type { Tour } from '@/types'
import AssignCalendarModal from './AssignCalendarModal.vue'

function mountModal(tour: Tour) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => jsonResponse({ count: 0, next: null, previous: null, results: [] }))
  )
  return mount(AssignCalendarModal, {
    props: { show: false, tour },
    global: { plugins: [i18n] },
  })
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

describe('AssignCalendarModal (A10, F3)', () => {
  it('pie "¿Usas Apple Calendar u Outlook?" que pide abrir el alta iCal con la gira', async () => {
    const tour = adminTour()
    const w = mountModal(tour)
    await w.setProps({ show: true })
    await flushPromises()
    expect(w.get('[data-test="assign-cal-ical"]').text()).toContain(
      '¿Usas Apple Calendar u Outlook?'
    )
    await w.get('[data-test="assign-cal-ical-open"]').trigger('click')
    expect(w.emitted('subscribeIcal')).toEqual([[tour]])
  })

  it('no admin o demo: sin enlace', async () => {
    const member = mountModal(adminTour({ current_user_is_admin: false }))
    await member.setProps({ show: true })
    await flushPromises()
    expect(member.find('[data-test="assign-cal-ical"]').exists()).toBe(false)

    useAuthStore().isDemoMode = true
    const demo = mountModal(adminTour())
    await demo.setProps({ show: true })
    await flushPromises()
    expect(demo.find('[data-test="assign-cal-ical"]').exists()).toBe(false)
  })
})
