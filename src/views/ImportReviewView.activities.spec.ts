import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { activityRow, importJob, notificationsPreview, teamRow } from '@/test/importJobs'
import { activityJob, calendarCancelledRow, calendarChangedRow } from '@/test/importActivities'
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
type Handler = (call: Call) => Response | Promise<Response | undefined> | undefined

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

async function mountView(attachTo?: HTMLElement) {
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
  const w = mount(ImportReviewView, { global: { plugins: [i18n, router] }, attachTo })
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

describe('ImportReviewView · móvil (F5a)', () => {
  /** Equipo y actividades con una fila por resolver en cada bloque; `expected=team`. */
  function mixedJob(activities = [activityRow({ client_id: 'a1' }), activityRow({ client_id: 'a2', title: 'Show en La Riviera', needs_action: true })]) {
    const base = activityJob(activities)
    return {
      ...base,
      expected: 'team' as const,
      detected: { sources: [], expected: 'team' as const },
      draft: {
        ...base.draft!,
        team: [
          teamRow({ client_id: 't1' }),
          teamRow({ client_id: 't2', display_name: 'Marta', needs_action: true, confidence: 0.5 }),
        ],
      },
    }
  }

  it('"Por resolver (n)" une equipo y actividades arriba; debajo, las "Listas" plegadas', async () => {
    stubMatchMedia(true)
    setupFetch(mixedJob())
    const w = await mountView()
    const section = w.get('[data-test="import-mobile-pending"]')
    expect(section.get('[data-test="import-mobile-to-resolve"]').text()).toBe('Por resolver (2)')
    // Equipo primero con `expected=team`; solo las filas por resolver.
    expect(section.findAll('[data-row]').map((r) => r.attributes('data-row'))).toEqual(['t2', 'a2'])
    // Sin la línea de escritorio "N cosas por resolver · Solo por resolver".
    expect(w.find('[data-test="import-to-resolve"]').exists()).toBe(false)
    // Los bloques solo llevan sus "Listas", plegadas.
    const team = w.get('[data-test="import-block-team"]')
    expect(team.find('[data-row]').exists()).toBe(false)
    expect(team.get('[data-test="import-section-ready"]').attributes('aria-expanded')).toBe('false')
    const acts = w.get('[data-test="import-block-activities"]')
    expect(acts.find('[data-test="import-activities-pending"]').exists()).toBe(false)
    expect(acts.get('[data-test="import-activities-ready-toggle"]').text()).toBe('Listas (1)')
    w.unmount()
  })

  it('"Siguiente" y "Te quedan n por resolver" llevan el foco a una fila por resolver', async () => {
    stubMatchMedia(true)
    setupFetch(mixedJob())
    const w = await mountView(document.body)
    await w.get('[data-test="import-mobile-next"]').trigger('click')
    expect((document.activeElement as HTMLElement | null)?.dataset.row).toBe('t2')
    await w.get('[data-test="import-confirm-pending-left"]').trigger('click')
    expect((document.activeElement as HTMLElement | null)?.dataset.row).toBe('t2')
    w.unmount()
  })

  it('omitir deja "Omitida: {título} · Deshacer" 5 s; Deshacer la devuelve con otro PATCH', async () => {
    stubMatchMedia(true)
    const job = mixedJob()
    const skipped = mixedJob([
      activityRow({ client_id: 'a1' }),
      activityRow({ client_id: 'a2', title: 'Show en La Riviera', action: 'skip' }),
    ])
    const log = setupFetch(job, (call) => {
      if (call.path !== `${JOB_PATH}draft/` || call.method !== 'PATCH') return undefined
      const rows = (call.body?.rows ?? []) as { action?: string }[]
      return jsonResponse(rows[0]?.action === 'skip' ? skipped : job)
    })
    const w = await mountView()
    try {
      await w.get('[data-row="a2"] [data-test="import-activity-skip"]').trigger('click')
      await flushPromises()
      const patches = () => log.filter((c) => c.method === 'PATCH').map((c) => c.body)
      expect(patches()).toEqual([{ rows: [{ client_id: 'a2', action: 'skip' }] }])
      const undo = w.get('[data-test="import-undo"]')
      expect(undo.text()).toContain('Omitida: Show en La Riviera')
      expect(w.get('[data-test="import-undo-region"]').attributes('role')).toBe('status')
      await w.get('[data-test="import-undo-action"]').trigger('click')
      await flushPromises()
      expect(patches()[1]).toEqual({ rows: [{ client_id: 'a2', action: 'create' }] })
      expect(w.find('[data-test="import-undo"]').exists()).toBe(false)

      // Otra vez, sin deshacer: a los 5 s desaparece.
      await w.get('[data-row="a2"] [data-test="import-activity-skip"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="import-undo"]').exists()).toBe(true)
      await new Promise((r) => setTimeout(r, 5100))
      expect(w.find('[data-test="import-undo"]').exists()).toBe(false)
    } finally {
      w.unmount()
    }
  }, 10_000)

  it('un conflicto sin decidir se omite sin "Deshacer" (el backend ya guarda la decisión)', async () => {
    stubMatchMedia(true)
    const conflictRow = calendarChangedRow(
      { client_id: 'a2', title: 'Show Madrid', action: 'replace', needs_action: true },
      { conflict: true }
    )
    const job = mixedJob([activityRow({ client_id: 'a1' }), conflictRow])
    const skipped = mixedJob([activityRow({ client_id: 'a1' }), { ...conflictRow, action: 'skip', needs_action: false }])
    const log = setupFetch(job, (call) =>
      call.path === `${JOB_PATH}draft/` && call.method === 'PATCH' ? jsonResponse(skipped) : undefined
    )
    const w = await mountView()
    try {
      await w.get('[data-row="a2"] [data-test="import-activity-skip"]').trigger('click')
      await flushPromises()
      expect(log.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([
        { rows: [{ client_id: 'a2', action: 'skip' }] },
      ])
      expect(w.get('[data-test="import-undo"]').text()).toBe('Omitida: Show Madrid')
      expect(w.find('[data-test="import-undo-action"]').exists()).toBe(false)
      // "Recuperar" sigue en la tarjeta.
      expect(w.find('[data-row="a2"] [data-test="import-activity-restore"]').exists()).toBe(true)
    } finally {
      w.unmount()
    }
  })

  it('un conflicto ya decidido (sin needs_action) sí ofrece Deshacer', async () => {
    stubMatchMedia(true)
    const decided = calendarChangedRow(
      { client_id: 'a2', title: 'Show Madrid', action: 'replace', needs_action: false, reviewed: true },
      { conflict: true }
    )
    const job = mixedJob([activityRow({ client_id: 'a1' }), decided])
    const log = setupFetch(job, (call) =>
      call.path === `${JOB_PATH}draft/` && call.method === 'PATCH'
        ? jsonResponse(mixedJob([activityRow({ client_id: 'a1' }), { ...decided, action: 'skip' }]))
        : undefined
    )
    const w = await mountView()
    try {
      await w.get('[data-row="a2"] [data-test="import-activity-skip"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="import-undo-action"]').trigger('click')
      await flushPromises()
      expect(log.filter((c) => c.method === 'PATCH').map((c) => c.body)[1]).toEqual({
        rows: [{ client_id: 'a2', action: 'replace', reviewed: true }],
      })
    } finally {
      w.unmount()
    }
  })

  it('Deshacer de una persona vinculada a mano devuelve también el contacto elegido', async () => {
    stubMatchMedia(true)
    const linked = teamRow({
      client_id: 't2',
      display_name: 'Marta',
      action: 'link',
      link_contact_uuid: 'C9',
    })
    const base = mixedJob()
    const job = { ...base, draft: { ...base.draft, team: [teamRow({ client_id: 't1' }), linked] } }
    const skipped = {
      ...base,
      draft: { ...base.draft, team: [teamRow({ client_id: 't1' }), { ...linked, action: 'skip' as const }] },
    }
    const log = setupFetch(job, (call) => {
      if (call.path !== `${JOB_PATH}draft/` || call.method !== 'PATCH') return undefined
      const rows = (call.body?.rows ?? []) as { action?: string }[]
      return jsonResponse(rows[0]?.action === 'skip' ? skipped : job)
    })
    const w = await mountView()
    try {
      // La fila vinculada está en las "Listas" del bloque de equipo.
      const ready = w.find('[data-test="import-block-team"] [data-test="import-section-ready"]')
      if (ready.exists() && ready.attributes('aria-expanded') === 'false') await ready.trigger('click')
      await w.get('[data-row="t2"] [data-test="import-row-skip"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="import-undo-action"]').trigger('click')
      await flushPromises()
      expect(log.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([
        { rows: [{ client_id: 't2', action: 'skip' }] },
        { rows: [{ client_id: 't2', action: 'link', link_contact_uuid: 'C9' }] },
      ])
    } finally {
      w.unmount()
    }
  })

  it('el aviso de Deshacer no sobrevive a un cambio de job', async () => {
    stubMatchMedia(true)
    const job = mixedJob()
    const skipped = mixedJob([
      activityRow({ client_id: 'a1' }),
      activityRow({ client_id: 'a2', title: 'Show en La Riviera', action: 'skip' }),
    ])
    const job2 = { ...job, uuid: 'J2' }
    let release: (() => void) | null = null
    const log = setupFetch(job, async (call) => {
      if (call.path === '/integrations/import-jobs/J2/' && call.method === 'GET') return jsonResponse(job2)
      if (call.path !== `${JOB_PATH}draft/` || call.method !== 'PATCH') return undefined
      if (!release) {
        await new Promise<void>((r) => (release = r))
      }
      return jsonResponse(skipped)
    })
    const w = await mountView()
    try {
      // El PATCH de omitir acaba cuando ya se está en otro job: no sale el aviso.
      await w.get('[data-row="a2"] [data-test="import-activity-skip"]').trigger('click')
      await flushPromises()
      await router.push('/tour/import/J2')
      await flushPromises()
      ;(release as unknown as () => void)()
      await flushPromises()
      expect(w.find('[data-test="import-undo"]').exists()).toBe(false)

      // Con el aviso a la vista, cambiar de job lo quita.
      await router.push('/tour/import/J1')
      await flushPromises()
      await w.get('[data-row="a2"] [data-test="import-activity-skip"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="import-undo"]').exists()).toBe(true)
      await router.push('/tour/import/J2')
      await flushPromises()
      expect(w.find('[data-test="import-undo"]').exists()).toBe(false)
      expect(log.filter((c) => c.method === 'PATCH')).toHaveLength(2)
    } finally {
      w.unmount()
    }
  })

  it('el "Mantener" de un resolutor no ofrece Deshacer; un PATCH fallido tampoco', async () => {
    stubMatchMedia(true)
    const job = mixedJob()
    setupFetch(job, (call) =>
      call.path === `${JOB_PATH}draft/` && call.method === 'PATCH'
        ? jsonResponse({ detail: 'x' }, 500)
        : undefined
    )
    const w = await mountView()
    await w.get('[data-row="a2"] [data-test="import-activity-skip"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="import-undo"]').exists()).toBe(false)
    expect(w.find('[data-row="a2"] [data-test="import-activity-error"]').exists()).toBe(true)
    w.unmount()

    // "Mantener" una cancelación del calendario manda `skip`, pero no es omitir.
    const job2 = mixedJob([activityRow({ client_id: 'a1' }), calendarCancelledRow()])
    const log = setupFetch(job2, (call) =>
      call.path === `${JOB_PATH}draft/` && call.method === 'PATCH' ? jsonResponse(job2) : undefined
    )
    const w2 = await mountView()
    // Sin gesto ni botón Omitir en la cancelación.
    expect(w2.find('[data-row="a6"] [data-test="import-activity-skip"]').exists()).toBe(false)
    await w2.get('[data-row="a6"] [data-test="resolver-calendar-cancel-keep"]').trigger('click')
    await flushPromises()
    expect(log.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([
      { rows: [{ client_id: 'a6', action: 'skip' }] },
    ])
    expect(w2.find('[data-test="import-undo"]').exists()).toBe(false)
    w2.unmount()
  })
})
