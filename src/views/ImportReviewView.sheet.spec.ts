import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import {
  jobSheet,
  sheetActivityRow,
  sheetChangedRow,
  sheetJob,
  sheetLinkRow,
  sheetRemovedRow,
} from '@/test/importActivities'
import { stubMatchMedia } from '@/test/reminders'
import type { ImportJob } from '@/composables/useImportJobs'
import ImportReviewView from './ImportReviewView.vue'

// Revisión de un job de una hoja de Google (F4 §4.4, §6.4). `fetch` por URL: job, roles y tipos en
// paralelo.

type Call = { method: string; path: string; body: Record<string, unknown> | null }
type Handler = (call: Call) => Response | Promise<Response> | undefined

const JOB_PATH = '/integrations/import-jobs/J1/'
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results })

function setupFetch(job: ImportJob, extra: Handler = () => undefined) {
  const log: Call[] = []
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/api/, '')
    const method = init?.method ?? 'GET'
    const call = { method, path, body: init?.body ? JSON.parse(String(init.body)) : null }
    log.push(call)
    const res = await extra(call)
    if (res) return res
    if (path === '/contacts/roles/') return jsonResponse(page([]))
    if (path === '/events/activity-types/') return jsonResponse(page([]))
    if (path === JOB_PATH && method === 'GET') return jsonResponse(job)
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return log
}

let router: Router

async function mountView() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
      { path: '/tour', name: 'tour', component: { template: '<div />' } },
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
      { path: '/events', name: 'events', component: { template: '<div />' } },
      { path: '/contacts', name: 'contacts', component: { template: '<div />' } },
    ],
  })
  await router.push('/tour/import/J1')
  await router.isReady()
  const w = mount(ImportReviewView, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ImportReviewView · hoja de Google', () => {
  it('cabecera con recuentos y "Ver vinculación"; textos de hoja y retirada por resolver', async () => {
    setupFetch(sheetJob([sheetActivityRow(), sheetChangedRow({ client_id: 's4' }), sheetRemovedRow()]))
    const w = await mountView()
    const header = w.get('[data-test="import-sheet-header"]')
    expect(header.text()).toContain(
      'Cambios de la hoja Gira 2027 · Producción: 2 nuevas · 1 cambiada · 1 ya no está'
    )
    expect(w.get('[data-test="import-sheet-link"]').attributes('href')).toBe('/settings?tab=calendars')
    expect(w.find('[data-test="import-calendar-header"]').exists()).toBe(false)
    expect(w.get('[data-test="import-to-resolve"]').text()).toBe('1 cosa por resolver')
    expect(w.get('[data-test="import-confirm"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-row="s2"] [data-test="resolver-calendar-cancel"]').text()).toContain(
      'Ya no está en la hoja'
    )
    expect(w.get('[data-row="s4"] [data-test="import-activity-status"]').text()).toBe(
      'Cambió en la hoja → se actualizará'
    )
    expect(w.get('[data-row="s1"]').text()).toContain('Hoja de Google · Itinerario · fila 14')
  })

  it('"Ver origen" enlaza a la celda solo si el job trae open_url', async () => {
    setupFetch(sheetJob([sheetActivityRow()]))
    let w = await mountView()
    await w.get('[data-row="s1"] [data-test="import-activity-peek"]').trigger('click')
    expect(w.get('[data-test="import-source-sheet-open"]').attributes('href')).toBe(
      'https://docs.google.com/spreadsheets/d/abc123/edit#gid=123&range=A14'
    )
    w.unmount()
    setupFetch(sheetJob([sheetActivityRow()], { sheet: jobSheet({ open_url: null }) }))
    w = await mountView()
    await w.get('[data-row="s1"] [data-test="import-activity-peek"]').trigger('click')
    expect(w.get('[data-test="import-source-where"]').text()).toBe(
      'Gira 2027 · Producción · Itinerario · fila 14'
    )
    expect(w.find('[data-test="import-source-sheet-open"]').exists()).toBe(false)
  })

  it('solo vincular y mantener: se confirma directo (sin paso de avisos) y lo cuenta', async () => {
    const job = sheetJob([sheetLinkRow(), sheetChangedRow({ client_id: 's4', action: 'skip' })])
    job.summary = { ...job.summary!, to_create: 0, to_link: 0, in_group: 0, to_skip: 0 }
    const done = { ...job, status: 'done' as const, result: { activities_linked: 1 } }
    const log = setupFetch(job, (c) => {
      if (c.method === 'POST' && c.path === `${JOB_PATH}confirm/`) return jsonResponse(done)
      return undefined
    })
    const w = await mountView()
    expect(w.get('[data-test="import-confirm-summary-all"]').text()).toContain('· se vinculará 1')
    expect(w.find('[data-test="import-confirm-reviewed-only"]').exists()).toBe(false)
    const confirm = w.get('[data-test="import-confirm"]')
    expect(confirm.attributes('disabled')).toBeUndefined()
    expect(confirm.attributes('data-mode')).toBe('confirm')
    expect(confirm.text()).toContain('Confirmar (1)')
    expect(w.get('[data-row="s3"] [data-test="import-activity-status"]').text()).toBe(
      'Ya está en la gira → se vinculará a la hoja'
    )
    await confirm.trigger('click')
    await flushPromises()
    expect(log.some((c) => c.method === 'POST' && c.path === `${JOB_PATH}confirm/`)).toBe(true)
    expect(w.get('[data-test="import-result-linked"]').text()).toBe('1 actividad vinculada a la hoja')
  })

  it('todo "Mantener": confirmar sin cambios con el texto de la hoja', async () => {
    const job = sheetJob([sheetChangedRow({ action: 'skip' })])
    job.summary = { ...job.summary!, to_create: 0, to_link: 0, in_group: 0, to_skip: 0 }
    setupFetch(job)
    const w = await mountView()
    expect(w.get('[data-test="import-confirm-reviewed-only"]').text()).toBe(
      'Confirmar sin cambios: se da por revisada la hoja.'
    )
    expect(w.get('[data-test="import-confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('"No vincular" → PATCH create reviewed', async () => {
    const link = sheetLinkRow()
    const after = sheetJob([{ ...link, action: 'create', reviewed: true }])
    const log = setupFetch(sheetJob([link]), (c) => {
      if (c.method === 'PATCH') return jsonResponse(after)
      return undefined
    })
    const w = await mountView()
    await w.get('[data-row="s3"] [data-test="resolver-sheet-unlink"]').trigger('click')
    await flushPromises()
    expect(log.find((c) => c.method === 'PATCH')?.body).toEqual({
      rows: [{ client_id: 's3', action: 'create', reviewed: true }],
    })
    expect(
      w.get('[data-row="s3"] [data-test="resolver-sheet-unlink"]').attributes('aria-pressed')
    ).toBe('true')
  })
})
