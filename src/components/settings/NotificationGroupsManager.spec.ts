import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import type {
  NotificationGroup,
  NotificationGroupListItem,
} from '@/composables/useNotificationGroups'
import NotificationGroupsManager from './NotificationGroupsManager.vue'

const LIST: NotificationGroupListItem[] = [
  { uuid: 'g-a', name: 'Equipo de la gira', tour: 'tour-1', tour_name: 'Gira 26', contact_count: 2 },
  { uuid: 'g-b', name: 'Producción', tour: null, tour_name: null, contact_count: 0 },
]

function detail(item: NotificationGroupListItem, description: string): NotificationGroup {
  return {
    ...item,
    description,
    contacts: [],
    created_by_name: null,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  }
}

const DETAIL_A = detail(LIST[0], 'Todo el equipo de la gira')
const DETAIL_B = detail(LIST[1], 'Producción local')

/** Backend con `system_key`: Equipo de la gira bloqueado y un grupo manual. */
const LOCKED_LIST: NotificationGroupListItem[] = [
  { ...LIST[0], uuid: 'g-t', system_key: 'tour_team' },
  { ...LIST[1], system_key: null },
]
const DETAIL_T = detail(LOCKED_LIST[0], 'Todo el equipo de la gira')
const DETAIL_B_KEY = detail(LOCKED_LIST[1], 'Producción local')

const LOCKED_403 = {
  success: false,
  error: {
    message: 'Error en la solicitud',
    status_code: 403,
    details: {
      group: ['El Equipo de la gira no se puede eliminar.'],
      code: ['system_group_locked'],
    },
  },
}

type Handler = (url: string, method: string, init: RequestInit) => Response | Promise<Response> | undefined

/** `fetch` por URL: la edición dispara `getGroup` además del listado. */
function setupFetch(extra: Handler = () => undefined, list: NotificationGroupListItem[] = LIST) {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const custom = extra(url, method, init ?? {})
    if (custom) return custom
    if (method === 'GET' && /\/notifications\/groups\/(\?.*)?$/.test(url)) {
      return jsonResponse({ count: list.length, next: null, previous: null, results: list })
    }
    if (method === 'GET' && url.endsWith('/notifications/groups/g-t/')) return jsonResponse(DETAIL_T)
    if (method === 'GET' && url.endsWith('/notifications/groups/g-b/') && list === LOCKED_LIST) {
      return jsonResponse(DETAIL_B_KEY)
    }
    if (method === 'GET' && url.endsWith('/notifications/groups/g-a/')) return jsonResponse(DETAIL_A)
    if (method === 'GET' && url.endsWith('/notifications/groups/g-b/')) return jsonResponse(DETAIL_B)
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const ModalStub = defineComponent({
  name: 'ManageGroupContactsModal',
  props: { show: Boolean, groupUuid: { type: String, default: null } },
  emits: ['close', 'saved'],
  template: '<div data-test="contacts-modal" />',
})

async function mountManager() {
  const w = mount(NotificationGroupsManager, {
    global: { plugins: [i18n], stubs: { ManageGroupContactsModal: ModalStub } },
  })
  await flushPromises()
  return w
}

function titleOf(w: Awaited<ReturnType<typeof mountManager>>, name: string) {
  const btn = w.findAll('[data-test="group-title"]').find((b) => b.text() === name)
  if (!btn) throw new Error(`sin título ${name}`)
  return btn
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

describe('NotificationGroupsManager', () => {
  it('clic en el nombre carga el detalle y Guardar conserva la descripción', async () => {
    const fn = setupFetch((url, method) => {
      if (method === 'PATCH' && url.endsWith('/notifications/groups/g-a/')) return jsonResponse(DETAIL_A)
    })
    const w = await mountManager()
    const title = titleOf(w, 'Equipo de la gira')
    expect(title.attributes('aria-label')).toBe('Editar Equipo de la gira')
    await title.trigger('click')
    await flushPromises()

    expect(fn.mock.calls.some(([u]) => String(u).endsWith('/notifications/groups/g-a/'))).toBe(true)
    const desc = w.get<HTMLInputElement>('[data-test="group-edit-description"]')
    expect(desc.element.value).toBe('Todo el equipo de la gira')

    await w.get('[data-test="group-edit-save"]').trigger('click')
    await flushPromises()
    const patch = fn.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      name: 'Equipo de la gira',
      description: 'Todo el equipo de la gira',
      tour: 'tour-1',
    })
  })

  it('mientras carga el detalle: texto de carga, inputs y Guardar deshabilitados', async () => {
    let resolve: (r: Response) => void = () => {}
    setupFetch((url, method) => {
      if (method === 'GET' && url.endsWith('/notifications/groups/g-a/')) {
        return new Promise<Response>((r) => (resolve = r))
      }
    })
    const w = await mountManager()
    await titleOf(w, 'Equipo de la gira').trigger('click')
    expect(w.get('[data-test="group-edit-loading"]').text()).toBe('Cargando grupo…')
    expect(w.get('[data-test="group-edit-description"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="group-edit-save"]').attributes('disabled')).toBeDefined()
    resolve(jsonResponse(DETAIL_A))
    await flushPromises()
    expect(w.find('[data-test="group-edit-loading"]').exists()).toBe(false)
    expect(w.get('[data-test="group-edit-save"]').attributes('disabled')).toBeUndefined()
  })

  it('error al cargar el detalle → mensaje y Guardar deshabilitado', async () => {
    const fn = setupFetch((url, method) => {
      if (method === 'GET' && url.endsWith('/notifications/groups/g-a/')) return jsonResponse({}, 500)
    })
    const w = await mountManager()
    await titleOf(w, 'Equipo de la gira').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="group-edit-error"]').text()).toBe('No se ha podido cargar el grupo.')
    expect(w.get('[data-test="group-edit-save"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="group-edit-save"]').trigger('click')
    expect(fn.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })

  it('respuesta vieja: abrir A y luego B antes de que A responda deja los datos de B', async () => {
    let resolveA: (r: Response) => void = () => {}
    setupFetch((url, method) => {
      if (method === 'GET' && url.endsWith('/notifications/groups/g-a/')) {
        return new Promise<Response>((r) => (resolveA = r))
      }
    })
    const w = await mountManager()
    await titleOf(w, 'Equipo de la gira').trigger('click')
    // B sigue en modo fila normal: se abre directamente sin cerrar A.
    await titleOf(w, 'Producción').trigger('click')
    await flushPromises()
    resolveA(jsonResponse(DETAIL_A))
    await flushPromises()

    expect(w.get<HTMLInputElement>('[data-test="group-edit-description"]').element.value).toBe(
      'Producción local'
    )
    expect(w.get<HTMLInputElement>('input[placeholder="Nombre del grupo"]').element.value).toBe(
      'Producción'
    )
    expect(w.find('[data-test="group-edit-loading"]').exists()).toBe(false)
  })

  it('"Añadir o quitar contactos" abre el modal del grupo; al guardar, contador nuevo y edición abierta', async () => {
    setupFetch()
    const w = await mountManager()
    await titleOf(w, 'Equipo de la gira').trigger('click')
    await flushPromises()
    const btn = w.get('[data-test="group-edit-contacts"]')
    expect(btn.text()).toBe('Añadir o quitar contactos (2)')
    await btn.trigger('click')

    const modal = w.findComponent(ModalStub)
    expect(modal.props('show')).toBe(true)
    expect(modal.props('groupUuid')).toBe('g-a')

    modal.vm.$emit('saved', 3)
    await flushPromises()
    expect(w.get('[data-test="group-edit-contacts"]').text()).toBe('Añadir o quitar contactos (3)')
    expect(w.find('[data-test="group-edit-save"]').exists()).toBe(true)
    expect(w.findComponent(ModalStub).props('show')).toBe(false)
  })

  it('"Eliminar grupo" muestra la confirmación; confirmar hace DELETE y el 409 da el mensaje de uso', async () => {
    const fn = setupFetch((url, method) => {
      if (method === 'DELETE' && url.endsWith('/notifications/groups/g-a/')) {
        return jsonResponse(
          {
            success: false,
            error: {
              message: 'Error en la solicitud',
              status_code: 409,
              details: {
                code: ['group_in_use'],
                rules: ['r-1'],
                group: ['Lo usan 1 reglas activas. Desactívalas antes de borrarlo.'],
              },
            },
          },
          409
        )
      }
    })
    const w = await mountManager()
    await titleOf(w, 'Equipo de la gira').trigger('click')
    await flushPromises()
    await w.get('[data-test="group-edit-delete"]').trigger('click')

    expect(w.find('[data-test="group-edit-save"]').exists()).toBe(false)
    expect(w.text()).toContain('¿Eliminar Equipo de la gira?')
    await w.findAll('button').find((b) => b.text() === 'Eliminar')!.trigger('click')
    await flushPromises()

    expect(fn.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
    expect(w.text()).toContain('Lo usan 1 reglas activas. Desactívalas antes de borrarlo.')
    expect(w.text()).not.toContain('group_in_use')
  })

  it('los botones de editar y gestionar contactos de la fila van en text-olive', async () => {
    setupFetch()
    const w = await mountManager()
    for (const sel of ['[data-test="group-row-edit"]', '[data-test="group-row-contacts"]']) {
      const buttons = w.findAll(sel)
      expect(buttons).toHaveLength(2)
      for (const b of buttons) expect(b.classes()).toContain('text-olive')
    }
  })
})

describe('NotificationGroupsManager · Equipo de la gira', () => {
  function rowOf(w: Awaited<ReturnType<typeof mountManager>>, name: string) {
    return titleOf(w, name).element.closest('.group') as HTMLElement
  }

  it('fila del equipo: etiqueta Sistema y sin papelera; grupo manual: papelera y sin etiqueta', async () => {
    setupFetch(undefined, LOCKED_LIST)
    const w = await mountManager()
    const team = rowOf(w, 'Equipo de la gira')
    const manual = rowOf(w, 'Producción')
    expect(team.querySelector('[data-test="group-row-delete"]')).toBeNull()
    const badge = team.querySelector('[data-test="group-system-badge"]')
    expect(badge?.textContent?.trim()).toBe('Sistema')
    expect(badge?.getAttribute('title')).toContain('No se puede eliminar, renombrar ni mover de gira')
    expect(manual.querySelector('[data-test="group-row-delete"]')).not.toBeNull()
    expect(manual.querySelector('[data-test="group-system-badge"]')).toBeNull()
  })

  it('edición del equipo: sin Eliminar, con aviso, nombre y gira deshabilitados; guarda solo la descripción', async () => {
    const fn = setupFetch((url, method) => {
      if (method === 'PATCH' && url.endsWith('/notifications/groups/g-t/')) {
        return jsonResponse({ ...DETAIL_T, description: 'Nueva' })
      }
    }, LOCKED_LIST)
    const w = await mountManager()
    await titleOf(w, 'Equipo de la gira').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="group-edit-delete"]').exists()).toBe(false)
    expect(w.get('[data-test="group-edit-locked-hint"]').text()).toContain(
      'sí puedes cambiar sus contactos y su descripción'
    )
    expect(w.get('[data-test="group-edit-name"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="group-edit-tour"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="group-edit-description"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="group-edit-contacts"]').exists()).toBe(true)

    await w.get('[data-test="group-edit-description"]').setValue('Nueva')
    await w.get('[data-test="group-edit-save"]').trigger('click')
    await flushPromises()
    const patch = fn.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ description: 'Nueva' })
    expect(w.find('[data-test="group-edit-save"]').exists()).toBe(false)
    expect(rowOf(w, 'Equipo de la gira').querySelector('[data-test="group-system-badge"]')).not.toBeNull()
  })

  it('edición del grupo manual: con Eliminar y guarda nombre, descripción y gira', async () => {
    const fn = setupFetch((url, method) => {
      if (method === 'PATCH' && url.endsWith('/notifications/groups/g-b/')) {
        return jsonResponse(DETAIL_B_KEY)
      }
    }, LOCKED_LIST)
    const w = await mountManager()
    await titleOf(w, 'Producción').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="group-edit-delete"]').exists()).toBe(true)
    expect(w.find('[data-test="group-edit-locked-hint"]').exists()).toBe(false)
    expect(w.get('[data-test="group-edit-name"]').attributes('disabled')).toBeUndefined()

    await w.get('[data-test="group-edit-save"]').trigger('click')
    await flushPromises()
    const patch = fn.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      name: 'Producción',
      description: 'Producción local',
      tour: null,
    })
  })

  it('listado sin system_key (backend viejo): la papelera se muestra en todas las filas', async () => {
    setupFetch()
    const w = await mountManager()
    expect(w.findAll('[data-test="group-row-delete"]')).toHaveLength(2)
    expect(w.find('[data-test="group-system-badge"]').exists()).toBe(false)
  })

  it('DELETE con 403 system_group_locked → mensaje traducido, sin código crudo', async () => {
    setupFetch((url, method) => {
      if (method === 'DELETE' && url.endsWith('/notifications/groups/g-a/')) {
        return jsonResponse(LOCKED_403, 403)
      }
    })
    const w = await mountManager()
    await rowOf(w, 'Equipo de la gira')
      .querySelector<HTMLButtonElement>('[data-test="group-row-delete"]')!
      .click()
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Eliminar')!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('El Equipo de la gira no se puede eliminar, renombrar ni mover de gira.')
    expect(w.text()).not.toContain('system_group_locked')
  })

  it('PATCH con 403 system_group_locked → mensaje traducido en la edición', async () => {
    setupFetch((url, method) => {
      if (method === 'PATCH' && url.endsWith('/notifications/groups/g-a/')) {
        return jsonResponse(LOCKED_403, 403)
      }
    })
    const w = await mountManager()
    await titleOf(w, 'Equipo de la gira').trigger('click')
    await flushPromises()
    await w.get('[data-test="group-edit-save"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="group-edit-error"]').text()).toBe(
      'El Equipo de la gira no se puede eliminar, renombrar ni mover de gira.'
    )
  })
})
