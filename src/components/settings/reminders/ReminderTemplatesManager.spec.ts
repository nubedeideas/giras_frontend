import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch, wrappedError } from '@/test/reminders'
import type { ActivityType } from '@/composables/useActivityTypes'
import ReminderTemplatesManager from './ReminderTemplatesManager.vue'

function type(overrides: Partial<ActivityType> = {}): ActivityType {
  return {
    uuid: 'at-flight',
    code: 'flight',
    name: 'Vuelo',
    category: 'logistics',
    icon: 'plane',
    color: '#1a8fff',
    description: '',
    display_order: 1,
    is_system: true,
    is_active: true,
    has_destination: true,
    has_duration: true,
    default_duration_minutes: 120,
    reminder_steps: [
      { minutes: 1440, channel: 'email' },
      { minutes: 180, channel: 'whatsapp' },
    ],
    default_reminder_minutes: [1440, 180],
    ...overrides,
  }
}

function page(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

async function mountManager() {
  const w = mount(ReminderTemplatesManager, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

describe('ReminderTemplatesManager', () => {
  it('lista los tipos por categoría con su resumen (legado incluido)', async () => {
    stubFetch(() =>
      jsonResponse(
        page([
          type(),
          type({
            uuid: 'at-show',
            code: 'show',
            name: 'Show',
            category: 'production',
            reminder_steps: null,
            default_reminder_minutes: [240],
          }),
        ])
      )
    )
    const w = await mountManager()
    expect(w.get('[data-test="template-flight"] [data-test="template-summary"]').text()).toBe(
      '24 h por email · 3 h por WhatsApp'
    )
    expect(w.get('[data-test="template-show"] [data-test="template-summary"]').text()).toBe(
      '4 h por WhatsApp'
    )
    expect(w.text()).toContain('Logística')
    expect(w.text()).toContain('Producción')
  })

  it('guarda por fila con PATCH de reminder_steps', async () => {
    const fn = stubFetch((_url, init) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body))
        return jsonResponse(type({ reminder_steps: body.reminder_steps }))
      }
      return jsonResponse(page([type()]))
    })
    const w = await mountManager()
    await w.get('[data-test="template-flight"] [data-test="template-toggle"]').trigger('click')
    const save = w.get('[data-test="template-save"]')
    expect(save.attributes('disabled')).toBeDefined()
    await w.get('[data-test="step-add"]').trigger('click')
    await w.get('[data-test="template-save"]').trigger('click')
    await flushPromises()
    const patch = fn.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(String(patch[0])).toContain('/events/activity-types/at-flight/')
    expect(JSON.parse(String(patch[1]!.body))).toEqual({
      reminder_steps: [
        { minutes: 1440, channel: 'email' },
        { minutes: 180, channel: 'whatsapp' },
        { minutes: 60, channel: 'whatsapp' },
      ],
    })
    expect(w.get('[data-test="template-saved"]').text()).toBe('Guardado.')
    expect(w.get('[data-test="template-summary"]').text()).toBe(
      '24 h por email · 3 h por WhatsApp · 1 h por WhatsApp'
    )
  })

  it('muestra el error del backend por código', async () => {
    stubFetch((_url, init) => {
      if (init?.method === 'PATCH') return wrappedError(400, 'too_many_steps')
      return jsonResponse(page([type()]))
    })
    const w = await mountManager()
    await w.get('[data-test="template-toggle"]').trigger('click')
    await w.get('[data-test="step-add"]').trigger('click')
    await w.get('[data-test="template-save"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="template-error"]').text()).toBe('Máximo 5 recordatorios por tipo.')
  })

  it('restablece una fila tras confirmar y recarga', async () => {
    let reset = false
    const fn = stubFetch((url) => {
      if (url.pathname.endsWith('/reset-reminders/')) {
        reset = true
        return jsonResponse({ updated: 1 })
      }
      return jsonResponse(
        page([reset ? type({ reminder_steps: [{ minutes: 180, channel: 'whatsapp' }] }) : type()])
      )
    })
    const w = await mountManager()
    await w.get('[data-test="template-toggle"]').trigger('click')
    await w.get('[data-test="template-reset"]').trigger('click')
    expect(w.text()).toContain('¿Volver a los valores de Giras?')
    await w.get('[data-test="template-reset-confirm"]').trigger('click')
    await flushPromises()
    const post = fn.mock.calls.find(([u]) => String(u).includes('reset-reminders'))!
    expect(JSON.parse(String(post[1]!.body))).toEqual({ codes: ['flight'] })
    expect(w.get('[data-test="template-summary"]').text()).toBe('3 h por WhatsApp')
  })

  it('restablece todos sin códigos', async () => {
    const fn = stubFetch((url) => {
      if (url.pathname.endsWith('/reset-reminders/')) return jsonResponse({ updated: 24 })
      return jsonResponse(page([type()]))
    })
    const w = await mountManager()
    await w.get('[data-test="reset-all"]').trigger('click')
    await w.get('[data-test="reset-all-confirm"]').trigger('click')
    await flushPromises()
    const post = fn.mock.calls.find(([u]) => String(u).includes('reset-reminders'))!
    expect(JSON.parse(String(post[1]!.body))).toEqual({})
  })

  it('error de carga con reintentar', async () => {
    stubFetch(() => jsonResponse({}, 500))
    const w = await mountManager()
    expect(w.find('[data-test="templates-error"]').exists()).toBe(true)
  })
})
