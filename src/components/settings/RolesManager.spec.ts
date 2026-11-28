import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import type { ContactRole } from '@/composables/useContactRoles'
import RolesManager from './RolesManager.vue'

function role(overrides: Partial<ContactRole>): ContactRole {
  return {
    uuid: 'r1',
    name: 'Técnico de sonido',
    slug: 'tecnico-de-sonido',
    description: 'FOH y monitores',
    icon: '',
    color: '#1a8fff',
    is_system: false,
    is_active: true,
    created_by_name: null,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    ...overrides,
  }
}

const ROLES = [
  role({ uuid: 'r1', name: 'Técnico de sonido' }),
  role({ uuid: 'r2', name: 'Tour manager', is_system: true, description: '' }),
]

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () =>
      jsonResponse({ count: ROLES.length, next: null, previous: null, results: ROLES })
    )
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function mountManager() {
  const w = mount(RolesManager, { global: { plugins: [i18n] }, attachTo: document.body })
  await flushPromises()
  return w
}

describe('RolesManager', () => {
  it('clic en el nombre del rol abre la edición con su nombre y descripción', async () => {
    const w = await mountManager()
    const titles = w.findAll('[data-test="role-title"]')
    // Todos los roles, también los del sistema, se editan desde el nombre.
    expect(titles).toHaveLength(2)
    expect(titles[0].attributes('aria-label')).toBe('Editar Técnico de sonido')
    await titles[0].trigger('click')
    const name = w.get<HTMLInputElement>('input[placeholder="Nombre del rol"]')
    expect(name.element.value).toBe('Técnico de sonido')
    expect(w.get<HTMLInputElement>('input[placeholder="Descripción (opcional)"]').element.value).toBe(
      'FOH y monitores'
    )
  })

  it('"Nuevo rol" va antes de la lista y abre el alta arriba', async () => {
    const w = await mountManager()
    const btn = w.get('[data-test="roles-new"]')
    const list = w.get('[data-test="roles-list"]').element
    expect(btn.element.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(w.findAll('button').filter((b) => b.text().includes('Nuevo rol'))).toHaveLength(1)

    await btn.trigger('click')
    const input = w.get('input[placeholder="Nombre del rol *"]').element
    expect(input.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(w.find('[data-test="roles-new"]').exists()).toBe(false)
  })
})
