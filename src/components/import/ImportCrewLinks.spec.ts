import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import type { CrewLinkRow, CrewLinkState } from '@/composables/useCrewLinks'
import ImportCrewLinks from './ImportCrewLinks.vue'

const LIST = '/tours/T1/crew-links/'

function linkRow(uuid: string, name: string, state: CrewLinkState = 'active'): CrewLinkRow {
  return {
    contact: { uuid, display_name: name, has_phone: true, has_email: false },
    sources: ['default_group'],
    state,
    link:
      state === 'none'
        ? null
        : {
            uuid: `L-${uuid}`,
            url: state === 'active' ? `https://giras.pro/crew/tok-${uuid}` : null,
            version: 1,
            created_at: '2026-11-23T10:00:00Z',
            rotated_at: null,
            revoked_at: null,
            view_count: 0,
            first_viewed_at: null,
            last_viewed_at: null,
          },
  }
}

const page = (results: CrewLinkRow[], next: string | null = null) => ({
  count: results.length,
  next,
  previous: null,
  results,
})

type Call = { method: string; path: string; search: string }
type Handler = (call: Call) => Response | Promise<Response> | undefined

/** `fetch` por URL (lista paginada y POST de crear enlace). */
function setupFetch(handler: Handler) {
  const log: Call[] = []
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input))
    const call = { method: init?.method ?? 'GET', path: url.pathname.replace(/^\/api/, ''), search: url.search }
    log.push(call)
    return (await handler(call)) ?? jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return log
}

async function mountLinks(props: Partial<{ tourUuid: string; contactUuids: string[] }> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/tour', name: 'tour', component: { template: '<div />' } },
    ],
  })
  const w = mount(ImportCrewLinks, {
    props: { tourUuid: 'T1', tourName: 'Gira 2027', contactUuids: ['C1', 'C2'], ...props },
    global: { plugins: [i18n, router] },
  })
  return w
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

describe('ImportCrewLinks', () => {
  it('esqueleto al cargar; todas las páginas, filtradas por las personas confirmadas', async () => {
    const log = setupFetch((c) => {
      if (c.path !== LIST) return undefined
      return c.search.includes('page=2')
        ? jsonResponse(page([linkRow('C2', 'Pedro', 'none')]))
        : jsonResponse(page([linkRow('C1', 'Ana'), linkRow('C9', 'Otra persona')], 'next'))
    })
    const w = await mountLinks()
    expect(w.find('[data-test="import-crew-links-loading"]').exists()).toBe(true)
    await flushPromises()
    expect(log.map((c) => c.search)).toEqual([
      expect.stringContaining('page=1'),
      expect.stringContaining('page=2'),
    ])
    expect(w.get('h2').text()).toBe('Comparte la agenda con tu equipo')
    const rows = w.findAll('[data-test="import-crew-link"]')
    expect(rows.map((r) => r.attributes('data-contact'))).toEqual(['C1', 'C2'])
    expect(rows[0].get('[data-test="import-crew-link-state"]').text()).toBe('Enlace listo')
    expect(rows[0].get('[data-test="import-crew-link-state"]').attributes('data-status')).toBe('sent')
    expect(rows[1].get('[data-test="import-crew-link-state"]').text()).toBe('Sin enlace')
    expect(rows[1].get('[data-test="import-crew-link-state"]').attributes('data-status')).toBe('off')
    // Sin teléfono a la vista, solo el nombre.
    expect(w.text()).not.toContain('+34')
  })

  it('sin enlace: POST primero y después el menú de compartir del sistema con su enlace', async () => {
    const log = setupFetch((c) => {
      if (c.path === LIST) return jsonResponse(page([linkRow('C2', 'Pedro', 'none')]))
      if (c.path === `${LIST}C2/` && c.method === 'POST') return jsonResponse(linkRow('C2', 'Pedro'), 201)
      return undefined
    })
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, share })
    const w = await mountLinks()
    await flushPromises()
    await w.get('[data-test="import-crew-link-share"]').trigger('click')
    await flushPromises()
    expect(log.map((c) => `${c.method} ${c.path}`)).toEqual([`GET ${LIST}`, `POST ${LIST}C2/`])
    expect(share).toHaveBeenCalledWith({
      title: 'Agenda de Gira 2027',
      text: 'Hola, Pedro. Aquí tienes la agenda de la gira Gira 2027: https://giras.pro/crew/tok-C2',
    })
    // La fila pasa a "Enlace listo".
    expect(w.get('[data-test="import-crew-link-state"]').text()).toBe('Enlace listo')
  })

  it('cancelar el menú no muestra nada; si el navegador ya no deja abrirlo tras crear, pide tocar otra vez', async () => {
    setupFetch((c) => {
      if (c.path === LIST) return jsonResponse(page([linkRow('C1', 'Ana'), linkRow('C2', 'Pedro', 'none')]))
      if (c.path === `${LIST}C2/`) return jsonResponse(linkRow('C2', 'Pedro'), 201)
      return undefined
    })
    const share = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }))
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    vi.stubGlobal('navigator', { ...navigator, share })
    const w = await mountLinks()
    await flushPromises()
    const [ana, pedro] = w.findAll('[data-test="import-crew-link"]')
    await ana.get('[data-test="import-crew-link-share"]').trigger('click')
    await flushPromises()
    expect(ana.find('[data-test="import-crew-link-feedback"]').exists()).toBe(false)
    await pedro.get('[data-test="import-crew-link-share"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test="import-crew-link"]')[1].get('[data-test="import-crew-link-feedback"]').text()).toBe(
      'Enlace creado. Toca Compartir otra vez para enviarlo.'
    )
  })

  it('sin Web Share copia el enlace y avisa "Enlace copiado"', async () => {
    setupFetch((c) => (c.path === LIST ? jsonResponse(page([linkRow('C1', 'Ana')])) : undefined))
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountLinks()
    await flushPromises()
    await w.get('[data-test="import-crew-link-share"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://giras.pro/crew/tok-C1')
    expect(w.get('[data-test="import-crew-link-feedback"]').text()).toBe('Enlace copiado')
  })

  it('"WhatsApp" abre wa.me sin número con el texto codificado (sin Twilio)', async () => {
    const log = setupFetch((c) => (c.path === LIST ? jsonResponse(page([linkRow('C1', 'Ana')])) : undefined))
    const open = vi.fn(() => null)
    vi.stubGlobal('open', open)
    const w = await mountLinks()
    await flushPromises()
    const btn = w.get('[data-test="import-crew-link-whatsapp"]')
    // Solo en escritorio: en el móvil va dentro del menú de compartir.
    expect(btn.classes()).toEqual(expect.arrayContaining(['hidden', 'lg:inline-flex']))
    await btn.trigger('click')
    const text = 'Hola, Ana. Aquí tienes la agenda de la gira Gira 2027: https://giras.pro/crew/tok-C1'
    expect(open).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    expect(log).toHaveLength(1)
  })

  it('portal desactivado: aviso con enlace a Mi Gira y sin "Compartir"', async () => {
    setupFetch((c) => (c.path === LIST ? jsonResponse(page([linkRow('C1', 'Ana', 'disabled')])) : undefined))
    const w = await mountLinks()
    await flushPromises()
    expect(w.get('[data-test="import-crew-links-disabled"]').text()).toContain(
      'El portal del equipo está desactivado'
    )
    expect(w.find('[data-test="import-crew-link-share"]').exists()).toBe(false)
    expect(w.get('[data-test="import-crew-link-state"]').text()).toBe('Portal desactivado')
  })

  it('error del POST traducido, nunca el código', async () => {
    setupFetch((c) => {
      if (c.path === LIST) return jsonResponse(page([linkRow('C2', 'Pedro', 'none')]))
      return jsonResponse({ code: 'portal_unavailable', detail: 'x', reason: 'expired' }, 400)
    })
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn() })
    const w = await mountLinks()
    await flushPromises()
    await w.get('[data-test="import-crew-link-share"]').trigger('click')
    await flushPromises()
    const fb = w.get('[data-test="import-crew-link-feedback"]')
    expect(fb.text()).toBe('El portal de esta gira ya no está disponible')
    expect(fb.attributes('role')).toBe('alert')
    expect(fb.text()).not.toContain('portal_unavailable')
  })

  it('error de la lista con Reintentar', async () => {
    let fail = true
    setupFetch((c) => {
      if (c.path !== LIST) return undefined
      return fail ? jsonResponse({ detail: 'x' }, 500) : jsonResponse(page([linkRow('C1', 'Ana')]))
    })
    const w = await mountLinks()
    await flushPromises()
    expect(w.get('[data-test="import-crew-links-error"]').text()).toBe('No hemos podido cargar los enlaces')
    fail = false
    await w.get('[data-test="import-crew-links-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test="import-crew-link"]')).toHaveLength(1)
  })

  it('nadie confirmado con enlace posible: no se pinta la sección', async () => {
    setupFetch((c) => (c.path === LIST ? jsonResponse(page([linkRow('C9', 'Otra')])) : undefined))
    const w = await mountLinks()
    await flushPromises()
    expect(w.find('[data-test="import-crew-links"]').exists()).toBe(false)
  })

  it('una respuesta atrasada de otra gira no se pinta', async () => {
    let resolveOld: (r: Response) => void = () => {}
    setupFetch((c) => {
      if (c.path === LIST) return new Promise<Response>((r) => (resolveOld = r))
      if (c.path === '/tours/T2/crew-links/') return jsonResponse(page([linkRow('C1', 'Ana de T2')]))
      return undefined
    })
    const w = await mountLinks()
    await w.setProps({ tourUuid: 'T2' })
    await flushPromises()
    resolveOld(jsonResponse(page([linkRow('C1', 'Ana de T1')])))
    await flushPromises()
    const names = w.findAll('[data-test="import-crew-link"]').map((r) => r.text())
    expect(names).toHaveLength(1)
    expect(names[0]).toContain('Ana de T2')
  })
})
