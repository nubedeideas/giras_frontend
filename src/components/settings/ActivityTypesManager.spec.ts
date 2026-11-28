import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import type { ActivityType } from '@/composables/useActivityTypes'
import ActivityTypesManager from './ActivityTypesManager.vue'

function type(overrides: Partial<ActivityType>): ActivityType {
  return {
    uuid: 't1',
    code: 'flight',
    name: 'Vuelo',
    category: 'logistics',
    icon: 'plane',
    color: '#1a8fff',
    description: '',
    display_order: 0,
    is_system: true,
    is_active: true,
    has_destination: true,
    has_duration: true,
    default_duration_minutes: 60,
    ...overrides,
  }
}

const SYSTEM = type({ uuid: 'sys-1', name: 'Vuelo' })
const CUSTOM = type({
  uuid: 'own-1',
  code: 'custom_ensayo',
  name: 'Ensayo',
  category: 'production',
  icon: 'calendar',
  is_system: false,
})

type Handler = (url: string, init: RequestInit) => Response | undefined

/** `fetch` por URL: el listado siempre responde; `extra` atiende las mutaciones. */
function setupFetch(extra: Handler = () => undefined) {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const custom = extra(url, init ?? {})
    if (custom) return custom
    if (method === 'GET' && url.includes('/events/activity-types/?')) {
      return jsonResponse({ count: 2, next: null, previous: null, results: [SYSTEM, CUSTOM] })
    }
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function bodyOf(fn: ReturnType<typeof setupFetch>, method: string) {
  const call = fn.mock.calls.find(([, init]) => (init?.method ?? 'GET').toUpperCase() === method)
  if (!call) throw new Error(`sin llamada ${method}`)
  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>
}

async function mountManager() {
  const w = mount(ActivityTypesManager, { global: { plugins: [i18n] }, attachTo: document.body })
  await flushPromises()
  return w
}

/** Fila de la lista que contiene ese nombre. */
function rowOf(w: Awaited<ReturnType<typeof mountManager>>, name: string) {
  const row = w
    .get('[data-test="activity-types-list"]')
    .findAll(':scope > div')
    .find((r) => r.text().includes(name))
  if (!row) throw new Error(`sin fila ${name}`)
  return row
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ActivityTypesManager', () => {
  it('tipo del sistema: nombre sin enlace, sin editar ni eliminar, con la etiqueta "sistema"', async () => {
    setupFetch()
    const w = await mountManager()
    const row = rowOf(w, 'Vuelo')
    expect(row.find('[data-test="activity-type-title"]').exists()).toBe(false)
    expect(row.find('button[title="Editar"]').exists()).toBe(false)
    expect(row.find('button[title="Eliminar"]').exists()).toBe(false)
    expect(row.text()).toContain('sistema')
  })

  it('tipo propio: el nombre es un enlace que abre la edición', async () => {
    setupFetch()
    const w = await mountManager()
    const title = rowOf(w, 'Ensayo').get('[data-test="activity-type-title"]')
    expect(title.attributes('aria-label')).toBe('Editar Ensayo')
    await title.trigger('click')
    const input = w.get<HTMLInputElement>('input[placeholder="Nombre *"]')
    expect(input.element.value).toBe('Ensayo')
  })

  it('"Nuevo tipo de actividad" va antes de la lista y no queda botón al pie', async () => {
    setupFetch()
    const w = await mountManager()
    const btn = w.get('[data-test="activity-types-new"]').element
    const list = w.get('[data-test="activity-types-list"]').element
    expect(btn.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const buttons = w.findAll('button').filter((b) => b.text().includes('Nuevo tipo de actividad'))
    expect(buttons).toHaveLength(1)

    await w.get('[data-test="activity-types-new"]').trigger('click')
    // El formulario de alta se abre arriba, antes de la lista.
    const form = w.get('input[placeholder="Nombre *"]').element
    expect(form.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(w.find('[data-test="activity-types-new"]').exists()).toBe(false)
  })

  it('sin campo de icono en el alta ni en la edición', async () => {
    setupFetch()
    const w = await mountManager()
    await w.get('[data-test="activity-types-new"]').trigger('click')
    expect(w.html()).not.toContain('Ícono')
    await w.findAll('button').find((b) => b.text() === 'Cancelar')!.trigger('click')
    await rowOf(w, 'Ensayo').get('[data-test="activity-type-title"]').trigger('click')
    expect(w.html()).not.toContain('Ícono')
  })

  it('alta: el POST lleva icon "calendar" y no lleva code', async () => {
    const fn = setupFetch((url, init) => {
      if (init.method === 'POST' && url.endsWith('/events/activity-types/')) {
        return jsonResponse(type({ uuid: 'own-2', code: 'custom_prensa', name: 'Prensa', is_system: false }), 201)
      }
    })
    const w = await mountManager()
    await w.get('[data-test="activity-types-new"]').trigger('click')
    await w.get('input[placeholder="Nombre *"]').setValue('Prensa')
    await w.findAll('button').find((b) => b.text() === 'Crear tipo')!.trigger('click')
    await flushPromises()
    const body = bodyOf(fn, 'POST')
    expect(body.icon).toBe('calendar')
    expect(body).not.toHaveProperty('code')
    expect(body.name).toBe('Prensa')
    expect(w.text()).toContain('Prensa')
  })

  it('edición de un tipo propio: el PATCH no lleva icon', async () => {
    const fn = setupFetch((url, init) => {
      if (init.method === 'PATCH' && url.endsWith('/events/activity-types/own-1/')) {
        return jsonResponse({ ...CUSTOM, name: 'Ensayo general' })
      }
    })
    const w = await mountManager()
    await rowOf(w, 'Ensayo').get('[data-test="activity-type-title"]').trigger('click')
    await w.get('input[placeholder="Nombre *"]').setValue('Ensayo general')
    await w.findAll('button').find((b) => b.text() === 'Guardar')!.trigger('click')
    await flushPromises()
    const body = bodyOf(fn, 'PATCH')
    expect(body).not.toHaveProperty('icon')
    expect(body.name).toBe('Ensayo general')
    expect(w.text()).toContain('Ensayo general')
  })

  it('403 system_type_locked al guardar → mensaje traducido, no el crudo', async () => {
    setupFetch((_url, init) => {
      if (init.method === 'PATCH') {
        return jsonResponse(
          {
            success: false,
            // Cuerpo real del handler de excepciones para el PermissionDenied del backend.
            error: {
              message: 'Error en la solicitud',
              status_code: 403,
              details: {
                activity_type: ['Los tipos del sistema no se pueden editar; solo sus recordatorios.'],
                code: ['system_type_locked'],
              },
            },
          },
          403
        )
      }
    })
    const w = await mountManager()
    await rowOf(w, 'Ensayo').get('[data-test="activity-type-title"]').trigger('click')
    await w.findAll('button').find((b) => b.text() === 'Guardar')!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Los tipos del sistema no se pueden editar.')
    expect(w.text()).not.toContain('system_type_locked')
  })

  it('textos del alta y la etiqueta "sistema" por i18n (EN)', async () => {
    i18n.global.locale.value = 'en'
    setupFetch()
    const w = await mountManager()
    expect(rowOf(w, 'Vuelo').text()).toContain('system')
    await w.get('[data-test="activity-types-new"]').trigger('click')
    expect(w.text()).toContain('New activity type')
    expect(w.text()).toContain('Create type')
    expect(w.text()).toContain('Active')
    expect(w.find('input[placeholder="Name *"]').exists()).toBe(true)
  })
})
