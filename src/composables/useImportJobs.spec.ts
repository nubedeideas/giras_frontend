import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { API_BASE } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { importJob, importListItem } from '@/test/importJobs'
import {
  confirmImportJob,
  createImportJob,
  discardImportJob,
  getImportJob,
  listImportJobs,
  patchImportDraft,
  useImportJobs,
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
