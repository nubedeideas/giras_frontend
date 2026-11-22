import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { activityRow, importJob, notificationsPreview, teamRow } from '@/test/importJobs'
import { stubMatchMedia } from '@/test/reminders'
import { useActivitiesStore } from '@/stores/activities'
import { useContactsStore } from '@/stores/contacts'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import { useToursStore } from '@/stores/tours'
import type { ImportJob } from '@/composables/useImportJobs'
import type { Tour } from '@/types'
import ImportReviewView from './ImportReviewView.vue'

type Call = { method: string; path: string; body: Record<string, unknown> | null }
type Handler = (call: Call) => Response | undefined

const ROLES = { count: 1, next: null, previous: null, results: [{ uuid: 'R1', name: 'Sound Engineer', is_active: true }] }
const JOB_PATH = '/integrations/import-jobs/J1/'

/** `fetch` por URL: la vista pide el job y los roles en paralelo. */
function setupFetch(job: ImportJob | Response, extra: Handler = () => undefined) {
  const log: Call[] = []
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/api/, '')
    const method = init?.method ?? 'GET'
    const call = { method, path, body: init?.body ? JSON.parse(String(init.body)) : null }
    log.push(call)
    const res = extra(call)
    if (res) return res
    if (path === '/contacts/roles/') return jsonResponse(ROLES)
    if (path === JOB_PATH && method === 'GET') return job instanceof Response ? job.clone() : jsonResponse(job)
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return log
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
      { path: '/tour', name: 'tour', component: { template: '<div />' } },
      { path: '/contacts', name: 'contacts', component: { template: '<div />' } },
      { path: '/events', name: 'events', component: { template: '<div />' } },
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
    ],
  })
  await router.push('/tour/import/J1')
  await router.isReady()
  const w = mount(ImportReviewView, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return Object.assign(w, { router })
}

/** Fila de equipo que no entra al grupo: "Confirmar" directo, sin paso de avisos (como F1). */
const outOfGroup = teamRow({ in_group: false })

const wrapped = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  jsonResponse(
    { success: false, error: { message: 'x', status_code: status, details: { code: [code], ...extra } } },
    status
  )

const pending = teamRow({ client_id: 't2', display_name: 'Marta', needs_action: true, confidence: 0.5 })

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

describe('ImportReviewView', () => {
  it('ready: detectado, PDF mixto con "páginas 3-8", grupo y gira activa', async () => {
    const tours = useToursStore()
    tours.tours = [{ id: 1, uuid: 'T1', name: 'Gira' } as Tour, { id: 2, uuid: 'T2', name: 'Otra' } as Tour]
    tours.setActiveTour(2)
    setupFetch(
      importJob({
        detected: {
          sources: [
            {
              ref: 'd1',
              document_uuid: 'D1',
              filename: 'Dossier_MAD.pdf',
              kind: 'pdf_text',
              sheet: null,
              doc_kind: 'mixed',
              processed: true,
              deferred: false,
              deferred_reason: null,
              pages: { total: 8, text: [1, 2, 3, 4, 5, 6, 7, 8], scanned: [], team: [1, 2] },
              deferred_pages: [{ pages: [3, 4, 5, 6, 7, 8], reason: 'itinerary_coming_soon' }],
              rows_scanned: 96,
              truncated: false,
              people_found: 14,
            },
          ],
        },
        team_group: { uuid: 'G1', name: 'Equipo de la gira', exists: true, is_default: false, default_group_name: 'Todos' },
      })
    )
    const w = await mountView()
    expect(w.get('[data-test="import-detected"]').text()).toContain('Dossier_MAD.pdf → Equipo (14)')
    expect(w.get('[data-test="import-deferred"]').text()).toContain(
      'Dossier_MAD.pdf, páginas 3-8: itinerario; la importación de actividades llegará pronto.'
    )
    expect(w.get('[data-test="import-group-line"]').text()).toBe(
      'Equipo de la gira → 1 persona entra en el grupo'
    )
    expect(w.get('[data-test="import-group-not-default"]').text()).toContain('«Todos»')
    expect(w.findAll('tr[data-row]')).toHaveLength(1)
    expect(tours.activeTour?.uuid).toBe('T1')
  })

  it('404 y 403 con su mensaje', async () => {
    setupFetch(jsonResponse({ detail: 'No encontrado.' }, 404))
    let w = await mountView()
    expect(w.get('[data-test="import-load-error"]').text()).toBe(
      'Esta importación no existe o no tienes acceso.'
    )
    setupFetch(jsonResponse({ detail: 'Prohibido.' }, 403))
    w = await mountView()
    expect(w.get('[data-test="import-load-error"]').text()).toBe(
      'Solo un administrador de la gira puede revisar importaciones.'
    )
  })

  it('cambio de región → PATCH assumptions y sustituye el job', async () => {
    const log = setupFetch(importJob(), (c) =>
      c.method === 'PATCH'
        ? jsonResponse(
            importJob({
              draft: {
                team: [teamRow({ phone: '+525512345678' })],
                warnings: [],
                assumptions: { default_region: 'MX', default_region_source: 'user' },
              },
            })
          )
        : undefined
    )
    const w = await mountView()
    await w.get('[data-test="import-region"]').setValue('MX')
    await flushPromises()
    const patch = log.find((c) => c.method === 'PATCH')
    expect(patch?.path).toBe('/integrations/import-jobs/J1/draft/')
    expect(patch?.body).toEqual({ assumptions: { default_region: 'MX' } })
    expect(w.get('tr[data-row="t1"]').text()).toContain('+525512345678')
    expect((w.get('[data-test="import-region"]').element as HTMLSelectElement).value).toBe('MX')
  })

  it('Confirmar desactivado con needs_action > 0', async () => {
    setupFetch(importJob({ draft: { team: [teamRow(), pending] } }))
    const w = await mountView()
    expect(w.get('[data-test="import-to-resolve"]').text()).toBe('1 cosa por resolver')
    expect(w.get('[data-test="import-confirm"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="import-confirm-reason"]').exists()).toBe(true)
  })

  it('confirmar → resumen, fetchContacts e invalidate del catálogo', async () => {
    const fetchContacts = vi.spyOn(useContactsStore(), 'fetchContacts').mockResolvedValue()
    const invalidate = vi.spyOn(useReminderCatalogStore(), 'invalidate').mockResolvedValue()
    const done = importJob({
      status: 'done',
      result: {
        contacts_created: 1,
        contacts_linked: 0,
        linked_late: 0,
        already_in_tour: 0,
        added_to_group: 1,
        skipped: 0,
        team_group_uuid: 'G1',
        team_group_is_default: true,
        contact_uuids: ['C9'],
      },
    })
    const log = setupFetch(importJob(), (c) => {
      if (c.path === `${JOB_PATH}preview-notifications/`) return jsonResponse(notificationsPreview())
      if (c.method === 'POST' && c.path === `${JOB_PATH}confirm/`) return jsonResponse(done)
      return undefined
    })
    const w = await mountView()
    // Entra gente al Equipo de la gira: "Confirmar" pasa por "Qué se va a enviar y a quién".
    await w.get('[data-test="import-confirm"]').trigger('click')
    await flushPromises()
    expect(w.router.currentRoute.value.query.step).toBe('notices')
    await w.get('[data-test="import-notices-confirm"]').trigger('click')
    await flushPromises()
    expect(log.find((c) => c.path === `${JOB_PATH}confirm/`)?.body).toEqual({
      pause_notifications: false,
      activate_tour: true,
    })
    expect(w.router.currentRoute.value.query.step).toBeUndefined()
    expect(w.get('[data-test="import-result-summary"]').text()).toBe(
      'Contactos nuevos: 1 · Vinculados: 0 · En el Equipo de la gira: 1'
    )
    expect(fetchContacts).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith('T1')
  })

  it('unresolved_rows al confirmar marca las filas de details.rows', async () => {
    setupFetch(importJob({ draft: { team: [outOfGroup] } }), (c) =>
      c.path === `${JOB_PATH}confirm/` ? wrapped(400, 'unresolved_rows', { rows: ['t1'] }) : undefined
    )
    const w = await mountView()
    await w.get('[data-test="import-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="import-confirm-error"]').text()).toBe('Quedan filas por resolver.')
    expect(w.get('tr[data-row="t1"] [data-test="import-row-error"]').text()).toBe(
      'Resuelve u omite esta fila para poder confirmar.'
    )
  })

  it('error de un PATCH de fila se muestra en la fila (nunca el código)', async () => {
    setupFetch(importJob(), (c) =>
      c.method === 'PATCH' ? wrapped(400, 'invalid_role', { rows: ['t1'] }) : undefined
    )
    const w = await mountView()
    await w.get('tr[data-row="t1"] [data-test="import-row-skip"]').trigger('click')
    await flushPromises()
    expect(w.get('tr[data-row="t1"] [data-test="import-row-error"]').text()).toBe(
      'Ese rol no está disponible.'
    )
  })

  it('descartar con la casilla de borrar archivos', async () => {
    const log = setupFetch(importJob(), (c) =>
      c.path === `${JOB_PATH}discard/` ? jsonResponse(importJob({ status: 'discarded', documents: [] })) : undefined
    )
    const w = await mountView()
    await w.get('[data-test="import-discard"]').trigger('click')
    await w.get('[data-test="import-discard-docs"]').setValue(true)
    await w.get('[data-test="import-discard-confirm"]').trigger('click')
    await flushPromises()
    expect(log.find((c) => c.path === `${JOB_PATH}discard/`)?.body).toEqual({ delete_documents: true })
    expect(w.get('[data-test="import-closed"]').text()).toBe('Importación descartada. No se ha creado nada.')
  })

  it('failed con ai_unavailable', async () => {
    setupFetch(importJob({ status: 'failed', error_code: 'ai_unavailable' }))
    const w = await mountView()
    expect(w.get('[data-test="import-failed"]').text()).toBe(
      'La lectura automática no está disponible ahora. Inténtalo en unos minutos.'
    )
    expect(w.find('[data-test="import-retry"]').exists()).toBe(true)
  })

  it('purged_at → caducado', async () => {
    setupFetch(importJob({ purged_at: '2026-12-22T00:00:00Z' }))
    const w = await mountView()
    expect(w.get('[data-test="import-closed"]').text()).toBe(
      'Este borrador ha caducado (30 días). Vuelve a importar el archivo.'
    )
  })

  it('"En el grupo" vuelve a marcada si el PATCH falla', async () => {
    setupFetch(importJob(), (c) => (c.method === 'PATCH' ? wrapped(500, 'internal_error') : undefined))
    const w = await mountView()
    const box = () => w.get('tr[data-row="t1"] [data-test="import-row-ingroup"]')
    ;(box().element as HTMLInputElement).checked = false
    await box().trigger('change')
    await flushPromises()
    expect((box().element as HTMLInputElement).checked).toBe(true)
    expect(w.find('tr[data-row="t1"] [data-test="import-row-error"]').exists()).toBe(true)
  })

  it('grupo sin crear: "queda como grupo por defecto" solo si la gira no tiene otro', async () => {
    const group = (default_group_name: string | null) => ({
      uuid: null,
      name: 'Equipo de la gira',
      exists: false,
      is_default: false,
      default_group_name,
    })
    setupFetch(importJob({ team_group: group(null) }))
    let w = await mountView()
    expect(w.get('[data-test="import-group-line"]').text()).toBe(
      'Equipo de la gira → se crea y queda como grupo por defecto'
    )
    setupFetch(importJob({ team_group: group('Todos') }))
    w = await mountView()
    expect(w.get('[data-test="import-group-line"]').text()).toBe(
      'Equipo de la gira → se crea con 1 persona'
    )
    expect(w.get('[data-test="import-group-not-default"]').text()).toContain('«Todos»')
  })

  it('al cambiar de job se limpian los errores de confirmar del anterior', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
        { path: '/tour', name: 'tour', component: { template: '<div />' } },
      ],
    })
    setupFetch(importJob({ draft: { team: [outOfGroup] } }), (c) => {
      if (c.path === `${JOB_PATH}confirm/`) return wrapped(400, 'tour_closed')
      if (c.path === '/integrations/import-jobs/J2/') return jsonResponse(importJob({ uuid: 'J2' }))
      return undefined
    })
    await router.push('/tour/import/J1')
    await router.isReady()
    const w = mount(ImportReviewView, { global: { plugins: [i18n, router] } })
    await flushPromises()
    await w.get('[data-test="import-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="import-confirm-error"]').exists()).toBe(true)
    await router.push('/tour/import/J2')
    await flushPromises()
    expect(w.find('[data-test="import-confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="import-confirm-error"]').exists()).toBe(false)
  })

  it('la gira del job se fija como activa una sola vez (aunque cambie el listado)', async () => {
    const tours = useToursStore()
    setupFetch(importJob())
    await mountView()
    expect(tours.activeTour).toBeNull()
    // Llega el listado: se aplica la gira del job.
    tours.tours = [{ id: 1, uuid: 'T1', name: 'Gira' } as Tour, { id: 2, uuid: 'T2', name: 'Otra' } as Tour]
    await flushPromises()
    expect(tours.activeTour?.uuid).toBe('T1')
    // El usuario cambia de gira y el listado se recarga con otra longitud: no se le impone otra vez.
    tours.setActiveTour(2)
    tours.tours = [...tours.tours, { id: 3, uuid: 'T3', name: 'Nueva' } as Tour]
    await flushPromises()
    expect(tours.activeTour?.uuid).toBe('T2')
  })

  it('D11: estimación de WhatsApp junto a Confirmar, con aviso si no caben', async () => {
    setupFetch(
      importJob({
        whatsapp_estimate: { per_person: 6, people: 7, total: 42, remaining: 30, plan_limit: 100, exceeds: true },
      })
    )
    const w = await mountView()
    const bar = w.get('[data-test="import-confirm-bar"]')
    expect(bar.get('[data-test="import-wa-estimate-line"]').text()).toBe(
      'Unos 42 WhatsApp durante la gira · te quedan 30 en tu plan'
    )
    expect(bar.get('[data-test="import-wa-estimate-exceeds"]').text()).toBe(
      'No caben todos en tu plan: los recordatorios que no quepan saldrán por email y en la app.'
    )
  })

  it('D11: sin estimación (null o people 0) no se muestra nada', async () => {
    setupFetch(importJob({ whatsapp_estimate: null }))
    let w = await mountView()
    expect(w.find('[data-test="import-wa-estimate"]').exists()).toBe(false)
    setupFetch(
      importJob({
        whatsapp_estimate: { per_person: 6, people: 0, total: 0, remaining: 30, plan_limit: 100, exceeds: false },
      })
    )
    w = await mountView()
    expect(w.find('[data-test="import-wa-estimate"]').exists()).toBe(false)
  })

  describe('F2: paso de avisos y estado final', () => {
    const actJob = () =>
      importJob({
        // Con una fila de equipo fuera del grupo: `canConfirm` del lote 1 aún exige alguna de equipo.
        draft: {
          team: [outOfGroup],
          activities: [activityRow()],
          warnings: [],
          assumptions: { default_region: 'ES', default_region_source: 'tour_timezone' },
        },
        summary: {
          total: 1,
          to_create: 1,
          to_link: 0,
          to_skip: 0,
          in_group: 0,
          needs_action: 0,
          without_phone: 0,
          not_mobile: 0,
          activities: {
            total: 1,
            to_create: 1,
            to_replace: 0,
            to_skip: 0,
            needs_action: 0,
            duplicates: 0,
            possible_duplicates: 0,
            outside_tour: 0,
            in_past: 0,
            by_type: { flight: 1 },
            days: 1,
          },
        },
      })
    const doneJob = () =>
      importJob({
        status: 'done',
        draft: { team: [] },
        result: {
          contacts_created: 0,
          contacts_linked: 0,
          linked_late: 0,
          already_in_tour: 0,
          added_to_group: 0,
          skipped: 0,
          team_group_uuid: '',
          team_group_is_default: true,
          contact_uuids: [],
          activities_created: 1,
          activities_replaced: 0,
          activities_skipped: 0,
          flights_to_enrich: 1,
          tour_activated: true,
          notifications_paused: true,
          post_import: { status: 'done', reminders_created: 3, first_send_at: '2026-12-02T09:30:00Z' },
        },
      })

    it('"Ver avisos" → ?step=notices; pausar y confirmar → estado final y recargas', async () => {
      const tours = useToursStore()
      tours.tours = [{ id: 1, uuid: 'T1', name: 'Gira', status: 'draft', timezone: 'Europe/Madrid' } as Tour]
      const loadTours = vi.spyOn(tours, 'loadTours').mockResolvedValue()
      const loadActivities = vi.spyOn(useActivitiesStore(), 'loadActivities').mockResolvedValue()
      const invalidate = vi.spyOn(useReminderCatalogStore(), 'invalidate').mockResolvedValue()
      const fetchContacts = vi.spyOn(useContactsStore(), 'fetchContacts').mockResolvedValue()
      const log = setupFetch(actJob(), (c) => {
        if (c.path === `${JOB_PATH}preview-notifications/`) return jsonResponse(notificationsPreview())
        if (c.path === `${JOB_PATH}confirm/`) return jsonResponse(doneJob())
        return undefined
      })
      const w = await mountView()
      expect(w.get('[data-test="import-confirm"]').text()).toBe('Ver avisos')
      await w.get('[data-test="import-confirm"]').trigger('click')
      await flushPromises()
      expect(w.router.currentRoute.value.query.step).toBe('notices')
      expect(w.find('[data-test="import-confirm-bar"]').exists()).toBe(false)
      expect(w.get('[data-test="import-notices"]').text()).toContain('Qué se va a enviar y a quién')
      expect(log.find((c) => c.path === `${JOB_PATH}preview-notifications/`)?.body).toEqual({
        pause_notifications: false,
        activate_tour: true,
      })
      await w.get('[data-test="import-notices-pause"]').setValue(true)
      await flushPromises()
      const previews = log.filter((c) => c.path === `${JOB_PATH}preview-notifications/`)
      expect(previews).toHaveLength(2)
      expect(previews[1].body).toEqual({ pause_notifications: true, activate_tour: true })
      await w.get('[data-test="import-notices-confirm"]').trigger('click')
      await flushPromises()
      expect(log.find((c) => c.path === `${JOB_PATH}confirm/`)?.body).toEqual({
        pause_notifications: true,
        activate_tour: true,
      })
      expect(w.get('[data-test="import-result-activities"]').text()).toBe(
        '1 actividad creada, 0 sustituidas, 0 omitidas'
      )
      expect(w.router.currentRoute.value.query.step).toBeUndefined()
      expect(invalidate).toHaveBeenCalledWith('T1')
      expect(loadTours).toHaveBeenCalled()
      expect(loadActivities).toHaveBeenCalled()
      expect(fetchContacts).toHaveBeenCalled()
    })

    it('"Volver" sale del paso; unresolved_rows desde el paso vuelve con el filtro', async () => {
      setupFetch(actJob(), (c) => {
        if (c.path === `${JOB_PATH}preview-notifications/`) return jsonResponse(notificationsPreview())
        if (c.path === `${JOB_PATH}confirm/`) return wrapped(400, 'unresolved_rows', { rows: ['a1'] })
        return undefined
      })
      const w = await mountView()
      await w.router.push({ query: { step: 'notices' } })
      await flushPromises()
      await w.get('[data-test="import-notices-back"]').trigger('click')
      await flushPromises()
      expect(w.router.currentRoute.value.query.step).toBeUndefined()
      expect(w.find('[data-test="import-confirm-bar"]').exists()).toBe(true)

      await w.get('[data-test="import-confirm"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="import-notices-confirm"]').trigger('click')
      await flushPromises()
      expect(w.router.currentRoute.value.query.step).toBeUndefined()
      expect(w.get('[data-test="import-confirm-error"]').text()).toBe('Quedan filas por resolver.')
      expect(w.find('[data-test="import-notices"]').exists()).toBe(false)
    })

    it('preview con 409 job_not_ready sale del paso y recarga el job', async () => {
      const log = setupFetch(actJob(), (c) =>
        c.path === `${JOB_PATH}preview-notifications/` ? wrapped(409, 'job_not_ready') : undefined
      )
      const w = await mountView()
      await w.get('[data-test="import-confirm"]').trigger('click')
      await flushPromises()
      expect(w.router.currentRoute.value.query.step).toBeUndefined()
      expect(log.filter((c) => c.path === JOB_PATH && c.method === 'GET')).toHaveLength(2)
    })
  })
})
