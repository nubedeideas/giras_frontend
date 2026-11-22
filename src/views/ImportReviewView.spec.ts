import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { importJob, teamRow } from '@/test/importJobs'
import { stubMatchMedia } from '@/test/reminders'
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
    ],
  })
  await router.push('/tour/import/J1')
  await router.isReady()
  const w = mount(ImportReviewView, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return w
}

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
    const log = setupFetch(importJob(), (c) =>
      c.method === 'POST' && c.path === `${JOB_PATH}confirm/` ? jsonResponse(done) : undefined
    )
    const w = await mountView()
    await w.get('[data-test="import-confirm"]').trigger('click')
    await flushPromises()
    expect(log.some((c) => c.method === 'POST' && c.path === `${JOB_PATH}confirm/`)).toBe(true)
    expect(w.get('[data-test="import-result-summary"]').text()).toBe(
      'Contactos nuevos: 1 · Vinculados: 0 · En el Equipo de la gira: 1'
    )
    expect(fetchContacts).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith('T1')
  })

  it('unresolved_rows al confirmar marca las filas de details.rows', async () => {
    setupFetch(importJob(), (c) =>
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
})
