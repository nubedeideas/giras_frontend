import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import ChoosePlanModal from './ChoosePlanModal.vue'

const PLAN = {
  uuid: 'p1',
  code: 'basic',
  name: 'Básico',
  description: 'Para empezar',
  price: '49',
  currency: 'EUR',
  notification_limit: 200,
  is_unlimited_notifications: false,
  max_shows: 10,
  is_unlimited_shows: false,
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

function mountModal() {
  return mount(ChoosePlanModal, {
    props: { show: true, tourUuid: 'tour-1', currentPlanCode: null },
    global: { plugins: [i18n] },
  })
}

describe('ChoosePlanModal', () => {
  it('la X cierra mientras carga los planes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => new Promise<Response>(() => {}))
    )
    const w = mountModal()
    await w.vm.$nextTick()
    const close = w.get('[data-test="choose-plan-close"]')
    expect(close.attributes('aria-label')).toBe('Cerrar')
    await close.trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('la X cierra desde la lista de planes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => jsonResponse([PLAN]))
    )
    const w = mountModal()
    await flushPromises()
    expect(w.text()).toContain('Básico')
    await w.get('[data-test="choose-plan-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
