import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { icalApiError } from '@/test/icalSubscriptions'
import { googleStatus, scopeMissing, sheetInspect, sheetSub } from '@/test/sheetSubscriptions'
import { PickerError } from '@/composables/useGooglePicker'
import SheetLinkForm from './SheetLinkForm.vue'

const picker = vi.hoisted(() => ({ pick: vi.fn() }))
vi.mock('@/composables/useGooglePicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useGooglePicker')>()
  return { ...actual, pickSpreadsheet: picker.pick, isPickerConfigured: () => true }
})
const redirectTo = vi.hoisted(() => vi.fn())
vi.mock('@/utils/navigation', () => ({ redirectTo }))

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

/** `fetch` por URL (el estado de Google y el formulario van en paralelo). */
function routes(map: Record<string, Handler>) {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    for (const [suffix, h] of Object.entries(map)) if (url.includes(suffix)) return h(init)
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function bodyOf(fn: ReturnType<typeof routes>, suffix: string) {
  const call = fn.mock.calls.find(([u]) => String(u).includes(suffix))
  return call ? JSON.parse(String(call[1]?.body)) : null
}

async function mountForm(props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tour', name: 'tour', component: { template: '<div />' } },
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
    ],
  })
  await router.push('/tour')
  await router.isReady()
  const w = mount(SheetLinkForm, {
    props: { tourUuid: 'T1', returnTo: '/tour?import=sheets&tour=T1', ...props } as {
      tourUuid: string | null
      returnTo: string
    },
    global: { plugins: [i18n, router] },
  })
  await flushPromises()
  return Object.assign(w, { router })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  picker.pick.mockReset()
  redirectTo.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SheetLinkForm', () => {
  it('sin el permiso de hojas pinta "Conectar Google Sheets" con el returnTo; sin campo de URL', async () => {
    const fn = routes({
      '/google/status/': () => jsonResponse(googleStatus(false)),
      '/google/authorize/': () =>
        jsonResponse({ authorization_url: 'https://accounts.google.com/x', state: 'S', scopes: [] }),
    })
    const w = await mountForm()
    expect(w.find('[data-testid="google-connect-cta-sheets"]').exists()).toBe(true)
    expect(w.find('input[type="url"]').exists()).toBe(false)
    expect(w.find('[data-test="sheet-choose-btn"]').exists()).toBe(false)
    await w.get('[data-testid="google-connect-sheets"]').trigger('click')
    await flushPromises()
    expect(bodyOf(fn, '/google/authorize/')).toMatchObject({
      purpose: 'sheets',
      return_to: '/tour?import=sheets&tour=T1',
    })
    expect(redirectTo).toHaveBeenCalledWith('https://accounts.google.com/x')
  })

  it('elegir hoja → inspect con el id; primera visible marcada, ocultas etiquetadas, tope de 5', async () => {
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'Gira 2027' })
    const fn = routes({
      '/google/status/': () => jsonResponse(googleStatus(true)),
      '/inspect/': () => jsonResponse(sheetInspect()),
    })
    const w = await mountForm()
    expect(w.find('input[type="url"]').exists()).toBe(false)
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    expect(picker.pick).toHaveBeenCalledOnce()
    expect(bodyOf(fn, '/inspect/')).toEqual({ tour: 'T1', spreadsheet_id: 'SHEET-ID' })
    expect(w.get('[data-test="sheet-title"]').text()).toBe('Gira 2027 · Producción')

    const rows = w.findAll('[data-test="sheet-tab"]')
    expect(rows.map((r) => r.attributes('data-gid'))).toEqual(['11', '0', '22', '33', '44', '55', '66'])
    expect(rows[0].find('[data-test="sheet-tab-hidden"]').text()).toBe('Oculta')
    const checks = () => w.findAll<HTMLInputElement>('[data-test="sheet-tab-check"]')
    expect(checks().map((c) => c.element.checked)).toEqual([false, true, false, false, false, false, false])
    expect(w.text()).toContain('Hasta 5 pestañas.')

    for (const i of [2, 3, 4, 5]) await checks()[i].setValue(true)
    expect(checks().filter((c) => c.element.checked)).toHaveLength(5)
    expect(checks()[0].element.disabled).toBe(true)
    expect(checks()[6].element.disabled).toBe(true)
    expect(checks()[1].element.disabled).toBe(false)
  })

  it('"Elegir otra" vuelve a abrir el selector', async () => {
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'Gira 2027' })
    routes({
      '/google/status/': () => jsonResponse(googleStatus(true)),
      '/inspect/': () => jsonResponse(sheetInspect()),
    })
    const w = await mountForm()
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="sheet-choose-other"]').trigger('click')
    await flushPromises()
    expect(picker.pick).toHaveBeenCalledTimes(2)
  })

  it('cancelar el selector no es un error; script_failed pinta el error y la pista de móvil', async () => {
    picker.pick
      .mockRejectedValueOnce(new PickerError('cancelled'))
      .mockRejectedValueOnce(new PickerError('script_failed'))
    const fn = routes({ '/google/status/': () => jsonResponse(googleStatus(true)) })
    const w = await mountForm()
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sheet-choose-error"]').exists()).toBe(false)
    expect(w.find('[data-test="sheet-choose"]').exists()).toBe(true)

    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="sheet-choose-error"]').text()).toBe(
      'No hemos podido abrir el selector de Google. Inténtalo de nuevo.'
    )
    expect(w.get('[data-test="sheet-mobile-hint"]').text()).toBe(
      'Si no se abre el selector, vincula la hoja desde el ordenador.'
    )
    expect(fn.mock.calls.some(([u]) => String(u).includes('/inspect/'))).toBe(false)
  })

  it('mobile_unsupported: dice que vincules la hoja desde el ordenador', async () => {
    picker.pick.mockRejectedValueOnce(new PickerError('mobile_unsupported'))
    routes({ '/google/status/': () => jsonResponse(googleStatus(true)) })
    const w = await mountForm()
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="sheet-choose-error"]').text()).toBe(
      'No hemos podido abrir el selector de Google en este dispositivo. Vincula la hoja desde el ordenador.'
    )
    expect(w.find('[data-test="sheet-mobile-hint"]').exists()).toBe(false)
    expect(w.find('[data-test="sheet-choose"]').exists()).toBe(true)
  })

  it('errores de inspect por código; 403 google_scope_missing vuelve a "Conectar"', async () => {
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'x' })
    let n = 0
    routes({
      '/google/status/': () => jsonResponse(googleStatus(true)),
      '/inspect/': () =>
        ++n === 1
          ? jsonResponse(icalApiError('no_access'), 400)
          : jsonResponse(scopeMissing(), 403),
    })
    const w = await mountForm()
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="sheet-choose-error"]').text()).toBe(
      'Tu cuenta de Google no tiene acceso a esa hoja. Pide que te la compartan y vuelve a elegirla.'
    )
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="google-connect-cta-sheets"]').exists()).toBe(true)
  })

  it('already_subscribed: aviso con enlace y sin "Vincular hoja"', async () => {
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'x' })
    routes({
      '/google/status/': () => jsonResponse(googleStatus(true)),
      '/inspect/': () => jsonResponse(sheetInspect({ already_subscribed: 'G0' })),
    })
    const w = await mountForm()
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="sheet-already"]').text()).toContain(
      'Esta gira ya tiene vinculada esta hoja.'
    )
    expect(w.find('[data-test="sheet-submit"]').exists()).toBe(false)
  })

  it('crea con pestañas y rango, sondea y "Revisar ahora" emite review y navega', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'x' })
    const job = { uuid: 'J9', status: 'ready' as const, created_at: '', new: 3, changed: 1, removed: 0 }
    let reads = 0
    const fn = routes({
      '/google/status/': () => jsonResponse(googleStatus(true)),
      '/inspect/': () => jsonResponse(sheetInspect()),
      '/sheet-subscriptions/G1/': () =>
        jsonResponse(++reads === 1 ? sheetSub({ last_status: 'pending' }) : sheetSub({ pending_job: job })),
      '/sheet-subscriptions/': (init) =>
        init?.method === 'POST' ? jsonResponse(sheetSub({ last_status: 'pending' }), 201) : jsonResponse({}, 404),
    })
    const w = await mountForm()
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="sheet-tab-range-toggle"]').trigger('click')
    await w.get('[data-test="sheet-tab-range"]').setValue('a2:h300')
    await w.get('[data-test="sheet-name"]').setValue('Producción')
    await w.get('form').trigger('submit')
    await flushPromises()
    const create = fn.mock.calls.find(
      ([u, init]) => String(u).endsWith('/sheet-subscriptions/') && init?.method === 'POST'
    )
    expect(JSON.parse(String(create?.[1]?.body))).toEqual({
      tour: 'T1',
      spreadsheet_id: 'SHEET-ID',
      tabs: [{ gid: 0, range: 'A2:H300' }],
      name: 'Producción',
    })
    expect(w.emitted('created')).toHaveLength(1)
    expect(w.find('[data-test="sheet-reading"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(3100)
    await flushPromises()
    expect(w.get('[data-test="sheet-found"]').text()).toBe('Hemos encontrado 4 filas para revisar')
    await w.get('[data-test="sheet-review"]').trigger('click')
    await flushPromises()
    expect(w.emitted('review')?.[0]).toEqual(['J9'])
    expect(w.router.currentRoute.value.params.jobUuid).toBe('J9')
  })

  it('sin borrador: "No hay nada nuevo"; con error, el texto traducido', async () => {
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'x' })
    routes({
      '/google/status/': () => jsonResponse(googleStatus(true)),
      '/inspect/': () => jsonResponse(sheetInspect()),
      '/sheet-subscriptions/G1/': () =>
        jsonResponse(sheetSub({ stats: { last_new: 0, last_changed: 0, last_removed: 0 } })),
      '/sheet-subscriptions/': () => jsonResponse(sheetSub({ last_status: 'pending' }), 201),
    })
    const w = await mountForm()
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-test="sheet-done-text"]').text()).toBe(
      'No hay nada nuevo que importar. Te avisaremos cuando cambie la hoja.'
    )
  })

  it('error del alta por código (too_many_subscriptions)', async () => {
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'x' })
    routes({
      '/google/status/': () => jsonResponse(googleStatus(true)),
      '/inspect/': () => jsonResponse(sheetInspect()),
      '/sheet-subscriptions/': () =>
        jsonResponse(icalApiError('too_many_subscriptions', 400, { max: 3 }), 400),
    })
    const w = await mountForm()
    await w.get('[data-test="sheet-choose-btn"]').trigger('click')
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-test="sheet-form-error"]').text()).toBe(
      'Esta gira ya tiene 3 hojas vinculadas.'
    )
  })
})
