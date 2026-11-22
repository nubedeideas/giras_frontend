import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { activityRow, importJob, notificationsPreview, teamRow } from '@/test/importJobs'
import { activityJob } from '@/test/importActivities'
import { stubMatchMedia } from '@/test/reminders'
import { useActivitiesStore } from '@/stores/activities'
import { useContactsStore } from '@/stores/contacts'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import { useToursStore } from '@/stores/tours'
import type { ImportJob } from '@/composables/useImportJobs'
import type { Tour } from '@/types'
import ImportReviewView from './ImportReviewView.vue'

// Revisión de actividades (F2 §4.3, §6.4). `fetch` por URL: job, roles y tipos van en paralelo.

type Call = { method: string; path: string; search: string; body: Record<string, unknown> | null }
type Handler = (call: Call) => Response | Promise<Response> | undefined

const JOB_PATH = '/integrations/import-jobs/J1/'
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results })
const TYPES = page([
  { uuid: 'TY1', code: 'flight', name: 'Vuelo', color: '#3b82f6', is_active: true, display_order: 1 },
  { uuid: 'TY2', code: 'show', name: 'Show', color: '#ef4444', is_active: true, display_order: 2 },
])

function setupFetch(job: ImportJob, extra: Handler = () => undefined) {
  const log: Call[] = []
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/api/, '')
    const method = init?.method ?? 'GET'
    const call = { method, path, search: url.search, body: init?.body ? JSON.parse(String(init.body)) : null }
    log.push(call)
    const res = await extra(call)
    if (res) return res
    if (path === '/contacts/roles/') return jsonResponse(page([]))
    if (path === '/events/activity-types/') return jsonResponse(TYPES)
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
      { path: '/contacts', name: 'contacts', component: { template: '<div />' } },
      { path: '/events', name: 'events', component: { template: '<div />' } },
    ],
  })
  await router.push('/tour/import/J1')
  await router.isReady()
  const w = mount(ImportReviewView, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return w
}

const blockOrder = (w: Awaited<ReturnType<typeof mountView>>) =>
  w.findAll('[data-block]').map((b) => b.attributes('data-block'))

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

describe('ImportReviewView · actividades', () => {
  it('job solo de actividades: detectado, supuestos, días y tipos de la gira (sin bloque Equipo)', async () => {
    const log = setupFetch(
      activityJob([activityRow(), activityRow({ client_id: 'a2', date: '2026-12-04', scheduled_at: '2026-12-04T19:00:00Z' })], {
        detected: {
          expected: 'itinerary',
          sources: [
            {
              ref: 'd2',
              document_uuid: 'D2',
              filename: 'Itinerario_MAD.pdf',
              kind: 'pdf_text',
              sheet: null,
              doc_kind: 'itinerary',
              processed: true,
              deferred: false,
              deferred_reason: null,
              rows_scanned: 40,
              truncated: false,
              people_found: 0,
              activities_found: 2,
            },
          ],
        },
      })
    )
    const w = await mountView()
    expect(w.get('[data-test="import-detected"]').text()).toContain('Itinerario_MAD.pdf → 2 actividades')
    expect(blockOrder(w)).toEqual(['activities'])
    expect(w.find('[data-test="import-region"]').exists()).toBe(false)
    expect(w.find('[data-test="import-assumptions"]').exists()).toBe(true)
    expect(w.findAll('[data-test="import-activity-day"]')).toHaveLength(2)
    expect(log.find((c) => c.path === '/events/activity-types/')?.search).toContain('tour=T1')
    expect(w.get('[data-row="a1"] [data-test="import-activity-dot"]').attributes('style')).toContain('background')
    // Sin equipo que entre al grupo pero con actividades: la barra lleva a los avisos.
    expect(w.get('[data-test="import-confirm"]').attributes('data-mode')).toBe('notices')
  })

  it('orden de bloques según expected', async () => {
    const team = [teamRow()]
    const acts = [activityRow()]
    const job = (expected: 'team' | 'itinerary' | 'any', o: Partial<ImportJob> = {}) =>
      activityJob(acts, {
        ...o,
        draft: { ...activityJob(acts).draft, team: o.draft?.team ?? team, activities: o.draft?.activities ?? acts },
        detected: { sources: [], expected },
      })
    setupFetch(job('itinerary'))
    expect(blockOrder(await mountView())).toEqual(['activities', 'team'])
    setupFetch(job('team'))
    expect(blockOrder(await mountView())).toEqual(['team', 'activities'])
    // any: el que tenga más por resolver; a igualdad, Equipo.
    setupFetch(job('any'))
    expect(blockOrder(await mountView())).toEqual(['team', 'activities'])
    setupFetch(job('any', { draft: { team, activities: [activityRow({ needs_action: true })] } }))
    expect(blockOrder(await mountView())).toEqual(['activities', 'team'])
  })

  it('"N cosas por resolver" cuenta equipo y actividades y bloquea Confirmar', async () => {
    const j = activityJob([activityRow({ needs_action: true }), activityRow({ client_id: 'a2', scheduled_at: null, start_time: null })])
    j.draft.team = [teamRow({ needs_action: true })]
    setupFetch(j)
    const w = await mountView()
    expect(w.get('[data-test="import-to-resolve"]').text()).toBe('3 cosas por resolver')
    expect(w.get('[data-test="import-confirm"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="import-activities-pending"]').text()).toContain('Por resolver (2)')
  })

  it('un supuesto bloquea la lista con "Recalculando…" hasta la respuesta, que sustituye el job', async () => {
    let release: (r: Response) => void = () => {}
    const recalculated = activityJob([activityRow({ timezone: 'Europe/Lisbon', timezone_source: 'user' })])
    const log = setupFetch(activityJob(), (c) =>
      c.method === 'PATCH' ? new Promise<Response>((res) => (release = res)) : undefined
    )
    const w = await mountView()
    await w.get('[data-test="assumption-timezone"]').setValue('Europe/Lisbon')
    await flushPromises()
    expect(log.find((c) => c.method === 'PATCH')?.body).toEqual({ assumptions: { default_timezone: 'Europe/Lisbon' } })
    expect(w.find('[data-test="import-activities-recalculating"]').exists()).toBe(true)
    expect(w.get('[data-test="import-activity-list"]').attributes('aria-busy')).toBe('true')
    expect(w.get('[data-test="import-confirm"]').attributes('disabled')).toBeDefined()
    release(jsonResponse(recalculated))
    await flushPromises()
    expect(w.find('[data-test="import-activities-recalculating"]').exists()).toBe(false)
    expect(w.find('[data-row="a1"] [data-test="import-activity-zone"]').exists()).toBe(true)
  })

  it('resolutor en la vista: posible duplicado → PATCH de la fila', async () => {
    const dup = activityRow({
      needs_action: true,
      match: {
        status: 'possible_duplicate',
        by: 'type_time_title',
        activity_uuid: 'ACT1',
        activity_title: 'Vuelo IB3456',
        activity_scheduled_at: '2026-12-03T09:30:00Z',
        activity_type_code: 'flight',
        activity_external_source: null,
      },
    })
    const log = setupFetch(activityJob([dup]), (c) =>
      c.method === 'PATCH' ? jsonResponse(activityJob([{ ...dup, action: 'replace', reviewed: true, needs_action: false }])) : undefined
    )
    const w = await mountView()
    await w.get('[data-row="a1"] [data-test="resolver-dup-replace"]').trigger('click')
    await flushPromises()
    expect(log.find((c) => c.method === 'PATCH')?.body).toEqual({
      rows: [{ client_id: 'a1', action: 'replace', reviewed: true }],
    })
    expect(w.get('[data-row="a1"] [data-test="import-activity-status"]').text()).toBe('Sustituirá a la existente')
  })

  it('error de un supuesto: mensaje junto a la barra, nunca el código', async () => {
    setupFetch(activityJob(), (c) =>
      c.method === 'PATCH'
        ? jsonResponse({ success: false, error: { message: 'x', status_code: 400, details: { code: ['unknown_city'] } } }, 400)
        : undefined
    )
    const w = await mountView()
    await w.get('[data-test="assumption-cities-toggle"]').trigger('click')
    await w.get('[data-test="assumption-city-zone"]').setValue('Europe/Lisbon')
    await flushPromises()
    expect(w.get('[data-test="assumption-error"]').text()).toBe('Ciudad desconocida.')
  })

  it('"Ver avisos" → ?step=notices; confirmar recarga actividades, giras y catálogo', async () => {
    const tours = useToursStore()
    tours.tours = [{ id: 1, uuid: 'T1', name: 'Gira', timezone: 'Europe/Madrid', start_date: '2026-12-01' } as Tour]
    const loadActivities = vi.spyOn(useActivitiesStore(), 'loadActivities').mockResolvedValue()
    const loadTours = vi.spyOn(tours, 'loadTours').mockResolvedValue()
    const invalidate = vi.spyOn(useReminderCatalogStore(), 'invalidate').mockResolvedValue()
    const fetchContacts = vi.spyOn(useContactsStore(), 'fetchContacts').mockResolvedValue()
    const done = activityJob([activityRow()], {
      status: 'done',
      result: {
        contacts_created: 0,
        contacts_linked: 0,
        linked_late: 0,
        already_in_tour: 0,
        added_to_group: 0,
        skipped: 0,
        team_group_uuid: '',
        team_group_is_default: false,
        contact_uuids: [],
        activities_created: 1,
        activities_replaced: 0,
        activities_skipped: 0,
        tour_activated: true,
        post_import: { status: 'pending', reminders_created: null, first_send_at: null },
      },
    })
    const log = setupFetch(activityJob(), (c) => {
      if (c.path === `${JOB_PATH}preview-notifications/`) return jsonResponse(notificationsPreview())
      if (c.method === 'POST' && c.path === `${JOB_PATH}confirm/`) return jsonResponse(done)
      return undefined
    })
    const w = await mountView()
    await w.get('[data-test="import-confirm"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.step).toBe('notices')
    expect(w.find('[data-test="import-notices"]').exists()).toBe(true)
    expect(log.some((c) => c.path === `${JOB_PATH}confirm/`)).toBe(false)
    await w.get('[data-test="import-notices-confirm"]').trigger('click')
    await flushPromises()
    expect(log.find((c) => c.path === `${JOB_PATH}confirm/`)?.body).toEqual({
      pause_notifications: false,
      activate_tour: true,
    })
    expect(router.currentRoute.value.query.step).toBeUndefined()
    expect(loadActivities).toHaveBeenCalled()
    expect(loadTours).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith('T1')
    // Sin equipo no se recargan los contactos.
    expect(fetchContacts).not.toHaveBeenCalled()
  })

  it('editar una actividad en escritorio la despliega con su editor y guarda con un PATCH', async () => {
    const log = setupFetch(activityJob(), (c) =>
      c.method === 'PATCH' ? jsonResponse(activityJob([activityRow({ title: 'IB3456 a Barcelona', edited: true })])) : undefined
    )
    const w = await mountView()
    await w.get('[data-row="a1"] [data-test="import-activity-edit"]').trigger('click')
    const editor = w.get('[data-test="import-activity-editor"]')
    await editor.get('[data-test="activity-editor-title"]').setValue('IB3456 a Barcelona')
    await editor.trigger('submit')
    await flushPromises()
    expect(log.find((c) => c.method === 'PATCH')?.body).toEqual({
      rows: [{ client_id: 'a1', fields: { title: 'IB3456 a Barcelona' } }],
    })
    expect(w.find('[data-test="import-activity-editor"]').exists()).toBe(false)
    expect(w.get('[data-row="a1"] [data-test="import-activity-title"]').text()).toBe('IB3456 a Barcelona')
  })

  it('jobs de F1 (sin actividades) siguen igual: sin supuestos ni bloque Actividades', async () => {
    setupFetch(importJob())
    const w = await mountView()
    expect(blockOrder(w)).toEqual(['team'])
    expect(w.find('[data-test="import-assumptions"]').exists()).toBe(false)
  })

  it('móvil: "Por resolver" primero, "Listas" plegadas y el editor en pantalla completa', async () => {
    stubMatchMedia(true)
    setupFetch(activityJob([activityRow({ client_id: 'a1' }), activityRow({ client_id: 'a2', needs_action: true })]))
    const w = await mountView()
    expect(w.get('[data-test="import-activities-pending"]').find('[data-row="a2"]').exists()).toBe(true)
    const toggle = w.get('[data-test="import-activities-ready-toggle"]')
    expect(toggle.text()).toBe('Listas (1)')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.find('[data-row="a1"]').exists()).toBe(false)
    await toggle.trigger('click')
    expect(w.find('[data-row="a1"]').exists()).toBe(true)
    await w.get('[data-row="a2"] [data-test="import-activity-edit"]').trigger('click')
    await flushPromises()
    // Sin editor desplegado en la lista: va en el overlay (teleport al body).
    expect(w.find('[data-test="import-activity-expanded"]').exists()).toBe(false)
    expect(document.body.querySelector('[data-test="import-activity-editor"]')).not.toBeNull()
    w.unmount()
  })
})
