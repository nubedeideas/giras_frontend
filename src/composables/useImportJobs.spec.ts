import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { API_BASE } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { importJob, importListItem, notificationsPreview } from '@/test/importJobs'
import {
  confirmImportJob,
  createImportJob,
  discardImportJob,
  getImportJob,
  listImportJobs,
  patchImportDraft,
  previewImportNotifications,
  useImportJobs,
  type ImportActivityRow,
  type ImportDraftPatch,
  type ImportNotificationsPreview,
  type ImportJob,
  type ImportJobListItem,
  type ImportResult,
  type ImportTeamRow,
  type ImportWhatsappEstimate,
} from './useImportJobs'

const BASE = `${API_BASE}/integrations/import-jobs/`

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useImportJobs', () => {
  it('createImportJob manda multipart con tour, varios files, text y entry_point', async () => {
    const fn = mockFetch(jsonResponse(importJob({ status: 'uploaded' }), 202))
    const a = new File(['a'], 'Crew.xlsx')
    const b = new File(['b'], 'Lista.pdf', { type: 'application/pdf' })
    const job = await createImportJob({
      tourUuid: 'T1',
      files: [a, b],
      text: '  Juan (FOH) 655 44 33 22 ',
      entryPoint: 'onboarding',
    })
    expect(job.status).toBe('uploaded')
    const { url, init } = callAt(fn, 0)
    expect(url).toBe(BASE)
    expect(init.method).toBe('POST')
    const body = init.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('tour')).toBe('T1')
    expect(body.getAll('files').map((f) => (f as File).name)).toEqual(['Crew.xlsx', 'Lista.pdf'])
    expect(body.get('text')).toBe('Juan (FOH) 655 44 33 22')
    expect(body.get('entry_point')).toBe('onboarding')
  })

  it('sin texto no manda el campo text', async () => {
    const fn = mockFetch(jsonResponse(importJob(), 202))
    await createImportJob({ tourUuid: 'T1', files: [new File(['a'], 'a.csv')], entryPoint: 'tour' })
    expect((callAt(fn, 0).init.body as FormData).has('text')).toBe(false)
  })

  it('createImportJob manda expected salvo con any', async () => {
    const fn = mockFetch(jsonResponse(importJob(), 202), jsonResponse(importJob(), 202))
    const files = [new File(['a'], 'Itinerario.pdf')]
    await createImportJob({ tourUuid: 'T1', files, entryPoint: 'activities', expected: 'itinerary' })
    await createImportJob({ tourUuid: 'T1', files, entryPoint: 'tour', expected: 'any' })
    const first = callAt(fn, 0).init.body as FormData
    expect(first.get('entry_point')).toBe('activities')
    expect(first.get('expected')).toBe('itinerary')
    expect((callAt(fn, 1).init.body as FormData).has('expected')).toBe(false)
  })

  it('confirm y preview-notifications mandan pause_notifications y activate_tour', async () => {
    const fn = mockFetch(
      jsonResponse(notificationsPreview()),
      jsonResponse(importJob({ status: 'done' }))
    )
    const preview = await previewImportNotifications('J1', {
      pause_notifications: true,
      activate_tour: true,
    })
    expect(preview.totals.whatsapp).toBe(311)
    await confirmImportJob('J1', { pause_notifications: true, activate_tour: true })
    expect(callAt(fn, 0).url).toBe(`${BASE}J1/preview-notifications/`)
    expect(callAt(fn, 0).init.method).toBe('POST')
    expect(JSON.parse(String(callAt(fn, 0).init.body))).toEqual({
      pause_notifications: true,
      activate_tour: true,
    })
    expect(callAt(fn, 1).url).toBe(`${BASE}J1/confirm/`)
    expect(JSON.parse(String(callAt(fn, 1).init.body))).toEqual({
      pause_notifications: true,
      activate_tour: true,
    })
  })

  it('PATCH de actividades y supuestos', async () => {
    const fn = mockFetch(jsonResponse(importJob()))
    const body: ImportDraftPatch = {
      rows: [
        { client_id: 'a3', action: 'replace' },
        { client_id: 'a4', fields: { start_time: '21:00', all_day: false } },
      ],
      assumptions: { year: 2027, date_order: 'mdy', cities: { 'madrid|es': 'Europe/Madrid' } },
    }
    await patchImportDraft('J1', body)
    expect(JSON.parse(String(callAt(fn, 0).init.body))).toEqual(body)
  })

  it('detalle, lista filtrada, PATCH, confirm y discard van a sus URLs', async () => {
    const fn = mockFetch(
      jsonResponse(importJob()),
      jsonResponse({ count: 1, next: null, previous: null, results: [importListItem()] }),
      jsonResponse(importJob()),
      jsonResponse(importJob({ status: 'done' })),
      jsonResponse(importJob({ status: 'discarded' })),
      jsonResponse(importJob({ status: 'discarded' }))
    )
    await getImportJob('J1')
    const list = await listImportJobs('T1', 'ready')
    await patchImportDraft('J1', {
      rows: [{ client_id: 't1', action: 'skip' }],
      assumptions: { default_region: 'MX' },
    })
    await confirmImportJob('J1')
    await discardImportJob('J1', { deleteDocuments: true })
    await discardImportJob('J1')

    expect(list).toHaveLength(1)
    expect(callAt(fn, 0).url).toBe(`${BASE}J1/`)
    expect(callAt(fn, 1).url).toBe(`${BASE}?tour=T1&status=ready`)
    expect(callAt(fn, 2).url).toBe(`${BASE}J1/draft/`)
    expect(callAt(fn, 2).init.method).toBe('PATCH')
    expect(JSON.parse(String(callAt(fn, 2).init.body))).toEqual({
      rows: [{ client_id: 't1', action: 'skip' }],
      assumptions: { default_region: 'MX' },
    })
    expect(callAt(fn, 3).url).toBe(`${BASE}J1/confirm/`)
    expect(callAt(fn, 3).init.method).toBe('POST')
    expect(JSON.parse(String(callAt(fn, 3).init.body))).toEqual({})
    expect(callAt(fn, 4).url).toBe(`${BASE}J1/discard/`)
    expect(JSON.parse(String(callAt(fn, 4).init.body))).toEqual({ delete_documents: true })
    expect(JSON.parse(String(callAt(fn, 5).init.body))).toEqual({ delete_documents: false })
  })

  it('el composable expone loading y guarda el error', async () => {
    mockFetch(jsonResponse({ detail: 'No encontrado.' }, 404))
    const api = useImportJobs()
    const p = api.getImportJob('J9')
    expect(api.loading.value).toBe(true)
    await expect(p).rejects.toMatchObject({ status: 404 })
    expect(api.loading.value).toBe(false)
    expect(api.error.value).toMatchObject({ status: 404 })
  })
})

// vue-tsc comprueba estas aserciones de tipo (en ejecución no hacen nada).
describe('tipos del contrato', () => {
  it('la fila no expone user_action ni phone_edited; created_by_name admite null', () => {
    expectTypeOf<ImportTeamRow>().not.toHaveProperty('user_action')
    expectTypeOf<ImportTeamRow>().not.toHaveProperty('phone_edited')
    expectTypeOf<ImportJobListItem['created_by_name']>().toEqualTypeOf<string | null>()
    expectTypeOf<NonNullable<ImportJob['whatsapp_estimate']>>().toEqualTypeOf<ImportWhatsappEstimate>()
    expectTypeOf<ImportResult['confirmer_in_team']>().toEqualTypeOf<boolean | undefined>()
  })

  it('F2: fila de actividad, resultado ampliado y vista previa', () => {
    expectTypeOf<ImportActivityRow['scheduled_at']>().toEqualTypeOf<string | null>()
    expectTypeOf<ImportActivityRow>().not.toHaveProperty('raw')
    expectTypeOf<ImportActivityRow>().not.toHaveProperty('user_fields')
    expectTypeOf<NonNullable<ImportResult['post_import']>['status']>().toEqualTypeOf<
      'pending' | 'done' | 'failed'
    >()
    expectTypeOf<ImportNotificationsPreview['quota']['exceeds']>().toEqualTypeOf<boolean>()
  })
})
