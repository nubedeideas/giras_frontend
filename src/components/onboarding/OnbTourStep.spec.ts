import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { defaultTourZone } from '@/utils/timezones'
import OnbTourStep from './OnbTourStep.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OnbTourStep: zona horaria (F0 §4.3)', () => {
  it('propone la zona por defecto y la manda al crear la gira', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input, init) => {
        if (String(input).endsWith('/tours/') && init?.method === 'POST') {
          const body = JSON.parse(String(init.body))
          bodies.push(body)
          return jsonResponse({ uuid: 'T9', owner_email: 'x', ...body }, 201)
        }
        return jsonResponse({}, 404)
      })
    )
    const w = mount(OnbTourStep, { global: { plugins: [i18n] } })
    const select = w.get<HTMLSelectElement>('[data-testid="onb-tour-timezone"]')
    expect(select.element.value).toBe(defaultTourZone())
    expect(w.text()).toContain(i18n.global.t('onboarding.tour.timezoneHelp'))

    await select.setValue('America/Santiago')
    // Sin Spotify: el formulario solo necesita nombre, artista y fechas.
    const vm = w.vm as unknown as { $: { setupState: Record<string, unknown> } }
    Object.assign(vm.$.setupState.form as object, {
      name: 'Gira',
      artist_name: 'Artista',
      start_date: '2026-12-01',
      end_date: '2026-12-20',
    })
    await flushPromises()
    const buttons = w.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
    await flushPromises()
    expect(bodies).toHaveLength(1)
    expect(bodies[0].timezone).toBe('America/Santiago')
    expect(w.emitted('next')).toHaveLength(1)
  })
})
