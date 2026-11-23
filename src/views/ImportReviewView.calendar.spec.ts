import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { notificationsPreview } from '@/test/importJobs'
import {
  activityJob,
  activitySummary,
  calendarCancelledRow,
  calendarChangedRow,
} from '@/test/importActivities'
import { stubMatchMedia } from '@/test/reminders'
import type { ImportActivityRow, ImportJob } from '@/composables/useImportJobs'
import ImportReviewView from './ImportReviewView.vue'

// Revisión de un job de calendario (F3 §4.4, §6.4). `fetch` por URL: job, roles y tipos en paralelo.

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
    ],
  })
  await router.push('/tour/import/J1')
  await router.isReady()
  const w = mount(ImportReviewView, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return w
}

function calendarJob(rows: ImportActivityRow[]): ImportJob {
  const base = activityJob(rows)
  return {
    ...base,
    source_kind: 'ical_sync',
    entry_point: 'subscription',
    calendar: { subscription_uuid: 'S1', name: 'Gira 2026', new: 0, changed: 1, cancelled: 1 },
    detected: {
      sources: [],
      expected: 'itinerary',
      ical: {
        subscription_uuid: 'S1',
        name: 'Gira 2026',
        removed: [{ key: 'k2', activity_uuid: 'ACT-2', summary: 'Prueba de sonido' }],
      },
    },
    draft: {
      ...base.draft,
      warnings: [
        { code: 'ics_outside_window', count: 3, source: 'd1' },
        { code: 'ics_classification_unavailable' },
        // Código que el front aún no conoce: no se pinta en crudo.
        { code: 'otro_aviso' as never },
      ],
    },
  }
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

describe('ImportReviewView · calendario', () => {
  it('cabecera de cambios con enlace a la suscripción, avisos ics_* y la retirada por resolver', async () => {
    setupFetch(calendarJob([calendarChangedRow(), calendarCancelledRow()]))
    const w = await mountView()
    const header = w.get('[data-test="import-calendar-header"]')
    expect(header.text()).toContain('Cambios de Gira 2026: 0 nuevas · 1 cambiadas · 1 canceladas')
    expect(w.get('[data-test="import-calendar-link"]').attributes('href')).toBe(
      '/settings?tab=calendars'
    )
    const warnings = w.findAll('[data-test="import-warnings"] li').map((li) => li.text())
    expect(warnings).toEqual([
      '3 eventos fuera de las fechas de la gira no se han importado.',
      'No hemos podido clasificar los eventos: revisa el tipo de cada uno.',
    ])
    expect(w.get('[data-test="import-to-resolve"]').text()).toBe('1 cosa por resolver')
    expect(w.get('[data-test="import-confirm"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-row="a6"] [data-test="import-activity-status"]').text()).toBe(
      'Ya no está en el calendario'
    )
    expect(w.get('[data-row="a6"] [data-test="resolver-calendar-cancel"]').text()).toContain(
      'Ya no está en el calendario'
    )
    expect(w.get('[data-row="a5"] [data-test="import-activity-status"]').text()).toBe(
      'Cambió en el calendario → se actualizará'
    )
  })

  it('"Cancelar actividad" → PATCH cancel; la barra y el paso de avisos cuentan la cancelación', async () => {
    const changed = calendarChangedRow()
    const cancelled = calendarCancelledRow()
    const after = [
      changed,
      { ...cancelled, action: 'cancel' as const, needs_action: false, reviewed: true },
    ]
    const patched = calendarJob(after)
    patched.summary = { ...patched.summary!, activities: { ...activitySummary(after), to_replace: 1 } }
    const log = setupFetch(calendarJob([changed, cancelled]), (c) => {
      if (c.method === 'PATCH') return jsonResponse(patched)
      if (c.path === `${JOB_PATH}preview-notifications/`) return jsonResponse(notificationsPreview())
      return undefined
    })
    const w = await mountView()
    await w.get('[data-row="a6"] [data-test="resolver-calendar-cancel-activity-btn"]').trigger('click')
    await flushPromises()
    expect(log.find((c) => c.method === 'PATCH')?.body).toEqual({
      rows: [{ client_id: 'a6', action: 'cancel', reviewed: true }],
    })
    expect(w.find('[data-test="import-to-resolve"]').exists()).toBe(false)
    expect(w.get('[data-row="a6"] [data-test="import-activity-status"]').text()).toBe('Se cancelará')
    expect(w.get('[data-test="import-confirm-summary-calendar"]').text()).toBe(
      'Se crearán 0 actividades, se actualizarán 1 y se cancelarán 1'
    )
    const confirm = w.get('[data-test="import-confirm"]')
    expect(confirm.attributes('data-mode')).toBe('notices')
    await confirm.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.step).toBe('notices')
    expect(w.get('[data-test="import-notices-will-cancel"]').text()).toBe(
      'Se cancelará 1 actividad y sus avisos pendientes.'
    )
  })
})
