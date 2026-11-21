import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { audience, group, stubFetch, wrappedError } from '@/test/reminders'
import ActivityRecipientsPanel from './ActivityRecipientsPanel.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.useRealTimers()
})

async function mountPanel() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/events')
  await router.isReady()
  const w = mount(ActivityRecipientsPanel, {
    props: { activityUuid: 'A1', tourUuid: 'T1' },
    global: { plugins: [i18n, router] },
  })
  await flushPromises()
  return Object.assign(w, { router })
}

function calls(fn: ReturnType<typeof stubFetch>, method: string) {
  return fn.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method)
}

describe('ActivityRecipientsPanel', () => {
  it('pinta recordatorios, base, personas y orígenes', async () => {
    const fn = stubFetch(() => jsonResponse(audience()))
    const w = await mountPanel()
    expect(new URL(String(fn.mock.calls[0][0])).searchParams.get('activity')).toBe('A1')
    expect(w.get('[data-test="recipients-reminders"]').text()).toBe(
      'Recordatorios: 24 h por email · 3 h por WhatsApp'
    )
    expect(w.get('[data-test="recipients-base"]').text()).toBe('Equipo de la gira')
    const people = w.findAll('[data-test="recipients-person"]')
    expect(people).toHaveLength(2)
    expect(people[1].text()).toContain('Equipo de la gira · Añadido')
    expect(people[1].get('[data-test="person-phone"]').attributes('title')).toBe('Sin teléfono')
  })

  it('base por grupos del tipo y avisos', async () => {
    stubFetch(() =>
      jsonResponse(
        audience({
          base_source: 'type_groups',
          base_groups: [
            group({ uuid: 'g-tech', name: 'Técnicos' }),
            group({ uuid: 'g-b', name: 'Banda' }),
          ],
          warnings: ['admins_without_phone'],
        })
      )
    )
    const w = await mountPanel()
    expect(w.get('[data-test="recipients-base"]').text()).toBe(
      'Por el tipo de actividad en esta gira: Técnicos, Banda'
    )
    expect(w.get('[data-test="recipients-warning"]').text()).toContain(
      'Hay administradores sin teléfono'
    )
  })

  it('excluir a una persona crea el override y recarga', async () => {
    let excluded = false
    const fn = stubFetch((_url, init) => {
      if (init?.method === 'POST') {
        excluded = true
        return jsonResponse({}, 201)
      }
      return jsonResponse(
        excluded
          ? audience({
              people: [audience().people[1]],
              overrides: [
                {
                  uuid: 'o-1',
                  activity: 'A1',
                  action: 'exclude',
                  group: null,
                  contact: { uuid: 'c-1', name: 'Ana Pérez' },
                  status: 'active',
                  source: 'manual',
                  reason: '',
                  created_at: '2026-11-21T10:00:00Z',
                },
              ],
            })
          : audience()
      )
    })
    const w = await mountPanel()
    await w.findAll('[data-test="person-exclude"]')[0].trigger('click')
    await flushPromises()
    expect(JSON.parse(String(calls(fn, 'POST')[0][1]!.body))).toEqual({
      activity: 'A1',
      action: 'exclude',
      contact: 'c-1',
    })
    expect(w.get('[data-test="override-excluded"]').text()).toContain('Ana Pérez')
    expect(w.findAll('[data-test="recipients-person"]')).toHaveLength(1)
  })

  it('añadir grupo desde el selector y quitar un ajuste', async () => {
    const added = {
      uuid: 'o-2',
      activity: 'A1',
      action: 'add' as const,
      group: group({ uuid: 'g-drivers', name: 'Conductores' }),
      contact: null,
      status: 'active' as const,
      source: 'manual' as const,
      reason: '',
      created_at: '2026-11-21T10:00:00Z',
    }
    let state: 'base' | 'added' = 'base'
    const fn = stubFetch((url, init) => {
      if (url.pathname.endsWith('/notifications/groups/')) {
        return jsonResponse({
          count: 2,
          next: null,
          previous: null,
          results: [
            { uuid: 'g-team', name: 'Equipo', tour: 'T1', tour_name: 'G', contact_count: 12 },
            { uuid: 'g-drivers', name: 'Conductores', tour: 'T1', tour_name: 'G', contact_count: 2 },
          ],
        })
      }
      if (init?.method === 'POST') {
        state = 'added'
        return jsonResponse(added, 201)
      }
      if (init?.method === 'DELETE') {
        state = 'base'
        return new Response(null, { status: 204 })
      }
      return jsonResponse(state === 'added' ? audience({ overrides: [added] }) : audience())
    })
    const w = await mountPanel()
    await w.get('[data-test="recipients-add-group"]').trigger('click')
    await flushPromises()
    // El grupo de la base no se ofrece.
    expect(w.find('[data-test="group-option-g-team"]').exists()).toBe(false)
    await w.get('[data-test="group-option-g-drivers"]').trigger('click')
    await flushPromises()
    expect(JSON.parse(String(calls(fn, 'POST')[0][1]!.body))).toEqual({
      activity: 'A1',
      action: 'add',
      group: 'g-drivers',
    })
    expect(w.get('[data-test="override-added"]').text()).toContain('Conductores')

    await w.get('[data-test="override-remove"]').trigger('click')
    await flushPromises()
    expect(String(calls(fn, 'DELETE')[0][0])).toContain('/notifications/recipient-overrides/o-2/')
    expect(w.find('[data-test="override-added"]').exists()).toBe(false)
  })

  it('añadir contacto con búsqueda y error con código', async () => {
    vi.useFakeTimers()
    const fn = stubFetch((url, init) => {
      if (url.pathname.endsWith('/contacts/')) {
        return jsonResponse({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              uuid: 'c-9',
              full_name: 'Marta Ruiz',
              first_name: 'Marta',
              last_name: 'Ruiz',
              company_name: '',
              primary_email: '',
              primary_phone: '',
              role: null,
            },
          ],
        })
      }
      if (init?.method === 'POST') return wrappedError(400, 'contact_not_assignable', 'contact')
      return jsonResponse(audience())
    })
    const w = await mountPanel()
    await w.get('[data-test="recipients-add-contact"]').trigger('click')
    await w.get('[data-test="contact-search"]').setValue('Mar')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    const gets = calls(fn, 'GET')
    const searchUrl = new URL(String(gets[gets.length - 1][0]))
    expect(searchUrl.searchParams.get('search')).toBe('Mar')
    // Incluye los contactos asignables de la gira (los del owner para un coadmin).
    expect(searchUrl.searchParams.get('tour')).toBe('T1')
    await w.get('[data-test="contact-option-c-9"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="recipients-action-error"]').text()).toBe(
      'No puedes añadir ese contacto a esta gira.'
    )
  })

  it('404 en una acción muestra el mensaje del backend y recarga', async () => {
    const fn = stubFetch((_url, init) => {
      if (init?.method === 'DELETE') {
        return jsonResponse(
          { success: false, error: { message: 'Ese ajuste ya no existe.', status_code: 404 } },
          404
        )
      }
      return jsonResponse(
        audience({
          overrides: [
            {
              uuid: 'o-9',
              activity: 'A1',
              action: 'add',
              group: group({ uuid: 'g-x', name: 'X' }),
              contact: null,
              status: 'active',
              source: 'manual',
              reason: '',
              created_at: '2026-11-21T10:00:00Z',
            },
          ],
        })
      )
    })
    const w = await mountPanel()
    const before = calls(fn, 'GET').length
    await w.get('[data-test="override-remove"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="recipients-action-error"]').text()).toBe('Ese ajuste ya no existe.')
    expect(calls(fn, 'GET').length).toBe(before + 1)
  })

  it('"Configurar" lleva a la pestaña Recordatorios de la gira', async () => {
    stubFetch(() => jsonResponse(audience()))
    const w = await mountPanel()
    await w.get('[data-test="recipients-configure"]').trigger('click')
    await flushPromises()
    expect(w.router.currentRoute.value.fullPath).toBe('/tour?tab=reminders')
  })

  it('error de carga con reintentar y 403 sin reintentar', async () => {
    stubFetch(() => jsonResponse({}, 500))
    const w = await mountPanel()
    expect(w.find('[data-test="recipients-retry"]').exists()).toBe(true)

    stubFetch(() => jsonResponse({}, 403))
    const w2 = await mountPanel()
    expect(w2.get('[data-test="recipients-error"]').text()).toContain(
      'Solo los administradores de la gira'
    )
    expect(w2.find('[data-test="recipients-retry"]').exists()).toBe(false)
  })
})
