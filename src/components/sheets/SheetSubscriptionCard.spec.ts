import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useToursStore } from '@/stores/tours'
import { jsonResponse } from '@/test/http'
import { adminTour, icalApiError } from '@/test/icalSubscriptions'
import { googleStatus, sheetSub } from '@/test/sheetSubscriptions'
import { PickerError } from '@/composables/useGooglePicker'
import type { SheetSubscription } from '@/composables/useSheetSubscriptions'
import SheetSubscriptionCard from './SheetSubscriptionCard.vue'

const picker = vi.hoisted(() => ({ pick: vi.fn() }))
vi.mock('@/composables/useGooglePicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useGooglePicker')>()
  return { ...actual, pickSpreadsheet: picker.pick, isPickerConfigured: () => true }
})

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

function routes(map: Record<string, Handler>) {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    for (const [key, h] of Object.entries(map)) {
      const [method, suffix] = key.includes(' ') ? key.split(' ') : ['', key]
      if (method && (init?.method ?? 'GET') !== method) continue
      if (url.includes(suffix)) return h(init)
    }
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function callsTo(fn: ReturnType<typeof routes>, method: string, suffix: string) {
  return fn.mock.calls.filter(
    ([u, init]) => String(u).includes(suffix) && (init?.method ?? 'GET') === method
  )
}

async function mountCard(sub: SheetSubscription) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
    ],
  })
  await router.push('/settings')
  await router.isReady()
  const w = mount(SheetSubscriptionCard, {
    props: { sub },
    global: { plugins: [i18n, router], stubs: { transition: false } },
    attachTo: document.body,
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  useToursStore().tours = [adminTour()]
  i18n.global.locale.value = 'es'
  picker.pick.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const statusOk = { '/google/status/': () => jsonResponse(googleStatus(true)) }

describe('SheetSubscriptionCard', () => {
  it('estado, gira con punto, pestañas, fechas en font-time tnum y lector "tú"', async () => {
    routes(statusOk)
    const w = await mountCard(
      sheetSub({
        tabs: [
          { gid: 0, title: 'Itinerario', range: '', doc_kind: 'itinerary', missing: false, rows: 2 },
          { gid: 9, title: 'Equipo', range: '', doc_kind: 'team', missing: true, rows: 0 },
        ],
      })
    )
    expect(w.get('[data-test="sheet-status"]').text()).toBe('Al día')
    expect(w.get('[data-test="sheet-status"]').attributes('data-status')).toBe('sent')
    expect(w.get('[data-test="sheet-tour-dot"]').attributes('style')).toContain('rgb(255, 0, 0)')
    expect(w.get('[data-test="sheet-spreadsheet-title"]').text()).toBe('Gira 2027 · Producción')
    expect(w.get('[data-test="sheet-tab-chip"]').text()).toBe('Itinerario')
    const missing = w.get('[data-test="sheet-tab-missing"]')
    expect(missing.text()).toBe('Equipo · ya no existe')
    expect(missing.attributes('data-status')).toBe('failed')
    expect(w.get('[data-test="sheet-last-sync"]').text()).toMatch(/^Última lectura: 23 nov/)
    expect(w.get('[data-test="sheet-last-sync"] .font-time').classes()).toContain('tnum')
    expect(w.get('[data-test="sheet-next-sync"] .font-time').classes()).toContain('tnum')
    expect(w.get('[data-test="sheet-reader"]').text()).toBe('Lee: tú')
    expect(w.get('[data-test="sheet-open"]').attributes('href')).toContain('docs.google.com')
    expect(w.find('[data-test="sheet-account"]').exists()).toBe(false)
  })

  it('otro admin: "Lee: {nombre}" y sin "Abrir en Google Sheets"', async () => {
    routes(statusOk)
    const w = await mountCard(
      sheetSub({ open_url: null, reader: { name: 'Ana', is_me: false, has_access: true } })
    )
    expect(w.get('[data-test="sheet-reader"]').text()).toBe('Lee: Ana')
    expect(w.find('[data-test="sheet-open"]').exists()).toBe(false)
  })

  it('has_access=false → "Usar mi cuenta" abre el selector y manda el id elegido', async () => {
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'x' })
    const fn = routes({
      ...statusOk,
      '/use-my-account/': () =>
        jsonResponse(sheetSub({ reader: { name: 'Yo', is_me: true, has_access: true } })),
      'GET /sheet-subscriptions/G1/': () => jsonResponse(sheetSub()),
    })
    const w = await mountCard(
      sheetSub({ open_url: null, reader: { name: 'Ana', is_me: false, has_access: false } })
    )
    const btn = w.get('[data-test="sheet-use-account"]')
    expect(btn.text()).toBe('Usar mi cuenta')
    await btn.trigger('click')
    await flushPromises()
    expect(picker.pick).toHaveBeenCalledWith({ title: 'Elige la hoja Gira 2027 · Producción' })
    const call = callsTo(fn, 'POST', '/use-my-account/')[0]
    expect(JSON.parse(String(call[1]?.body))).toEqual({ spreadsheet_id: 'SHEET-ID' })
    expect(w.emitted('changed')?.[0][0]).toMatchObject({ reader: { is_me: true } })
  })

  it('el lector con no_access ve "Volver a elegir la hoja"; spreadsheet_mismatch con el nombre', async () => {
    picker.pick.mockResolvedValue({ id: 'OTRA', name: 'x' })
    routes({
      ...statusOk,
      '/use-my-account/': () => jsonResponse(icalApiError('spreadsheet_mismatch'), 400),
    })
    const w = await mountCard(sheetSub({ last_status: 'error', last_error_code: 'no_access' }))
    expect(w.get('[data-test="sheet-error"]').text()).toBe(
      'Ya no podemos leer la hoja: vuelve a elegirla en el selector.'
    )
    const btn = w.get('[data-test="sheet-use-account"]')
    expect(btn.text()).toBe('Volver a elegir la hoja')
    await btn.trigger('click')
    await flushPromises()
    expect(w.get('[data-test="sheet-action-error"]').text()).toBe(
      'Esa no es la hoja vinculada: elige Gira 2027 · Producción.'
    )
  })

  it('sin el permiso de hojas en mi cuenta, ofrece "Conectar Google Sheets"', async () => {
    routes({ '/google/status/': () => jsonResponse(googleStatus(false)) })
    const w = await mountCard(
      sheetSub({ last_status: 'error', last_error_code: 'google_access_lost' })
    )
    expect(w.find('[data-testid="google-connect-cta-sheets"]').exists()).toBe(true)
    expect(w.find('[data-test="sheet-use-account"]').exists()).toBe(false)
  })

  it('cancelar el selector no deja error', async () => {
    picker.pick.mockRejectedValue(new PickerError('cancelled'))
    const fn = routes(statusOk)
    const w = await mountCard(
      sheetSub({ reader: { name: 'Ana', is_me: false, has_access: false } })
    )
    await w.get('[data-test="sheet-use-account"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sheet-action-error"]').exists()).toBe(false)
    expect(callsTo(fn, 'POST', '/use-my-account/')).toHaveLength(0)
  })

  it('sincronizar: 429 con minutos', async () => {
    routes({
      ...statusOk,
      '/sync/': () => jsonResponse(icalApiError('sync_too_soon', 429, { retry_after_seconds: 200 }), 429),
    })
    const w = await mountCard(sheetSub())
    await w.get('[data-test="sheet-sync"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="sheet-action-error"]').text()).toBe(
      'Acabamos de leerla. Vuelve a probar en 4 min.'
    )
  })

  it('volver a leer todo pide confirmación y manda full', async () => {
    const fn = routes({
      ...statusOk,
      '/sync/': () => jsonResponse({ status: 'queued' }, 202),
      'GET /sheet-subscriptions/G1/': () => jsonResponse(sheetSub()),
    })
    const w = await mountCard(sheetSub())
    await w.get('[data-test="sheet-sync-full"]').trigger('click')
    await flushPromises()
    expect(callsTo(fn, 'POST', '/sync/')).toHaveLength(0)
    expect(document.body.textContent).toContain(
      'Volveremos a leer todas las filas y te propondremos también lo que descartaste o mantuviste.'
    )
    ;(document.querySelector('[data-test="sheet-full-yes"]') as HTMLElement).click()
    await flushPromises()
    const call = callsTo(fn, 'POST', '/sync/')[0]
    expect(JSON.parse(String(call[1]?.body))).toEqual({ full: true })
  })

  it('pausar y reanudar', async () => {
    const fn = routes({
      ...statusOk,
      'PATCH /sheet-subscriptions/G1/': (init) => {
        const b = JSON.parse(String(init?.body))
        return jsonResponse(sheetSub({ sync_enabled: b.sync_enabled, last_status: b.sync_enabled ? 'ok' : 'paused' }))
      },
    })
    const w = await mountCard(sheetSub())
    await w.get('[data-test="sheet-toggle"]').trigger('click')
    await flushPromises()
    expect(JSON.parse(String(callsTo(fn, 'PATCH', '/G1/')[0][1]?.body))).toEqual({ sync_enabled: false })
    expect(w.emitted('changed')?.[0][0]).toMatchObject({ sync_enabled: false })
    await w.setProps({ sub: sheetSub({ sync_enabled: false, last_status: 'paused' }) })
    expect(w.get('[data-test="sheet-toggle"]').text()).toBe('Reanudar')
    expect(w.get('[data-test="sheet-status"]').text()).toBe('En pausa')
  })

  it('eliminar con confirmación', async () => {
    const fn = routes({
      ...statusOk,
      'DELETE /sheet-subscriptions/G1/': () => new Response(null, { status: 204 }),
    })
    const w = await mountCard(sheetSub())
    await w.get('[data-test="sheet-delete"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain(
      'Dejaremos de leer esta hoja. Las actividades ya importadas se quedan en la gira.'
    )
    ;(document.querySelector('[data-test="sheet-delete-yes"]') as HTMLElement).click()
    await flushPromises()
    expect(callsTo(fn, 'DELETE', '/G1/')).toHaveLength(1)
    expect(w.emitted('deleted')?.[0]).toEqual(['G1'])
  })

  it('freno de retiradas y cambios por revisar', async () => {
    routes(statusOk)
    const job = { uuid: 'J1', status: 'ready' as const, created_at: '', new: 2, changed: 0, removed: 1 }
    const w = await mountCard(
      sheetSub({ stats: { removal_guard: true }, pending_job: job })
    )
    expect(w.get('[data-test="sheet-removal-guard"]').text()).toBe(
      'Han desaparecido muchas filas de golpe: no te proponemos cancelar nada. Revisa la hoja.'
    )
    expect(w.get('[data-test="sheet-review-link"]').text()).toBe('Cambios por revisar (3)')
    expect(w.get('[data-test="sheet-review-badge"]').attributes('data-status')).toBe('pending')
  })

  it('gira terminada: sin reanudar ni volver a leer', async () => {
    routes(statusOk)
    const w = await mountCard(sheetSub({ last_status: 'tour_ended', sync_enabled: false }))
    expect(w.get('[data-test="sheet-status"]').text()).toBe('Gira terminada')
    expect(w.find('[data-test="sheet-toggle"]').exists()).toBe(false)
    expect(w.find('[data-test="sheet-sync-full"]').exists()).toBe(false)
    expect(w.get('[data-test="sheet-sync"]').attributes('disabled')).toBeDefined()
  })

  it('404 al actuar emite stale', async () => {
    routes({ ...statusOk, '/sync/': () => jsonResponse({ detail: 'No encontrado.' }, 404) })
    const w = await mountCard(sheetSub())
    await w.get('[data-test="sheet-sync"]').trigger('click')
    await flushPromises()
    expect(w.emitted('stale')).toHaveLength(1)
  })
})
