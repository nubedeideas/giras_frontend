import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { jsonResponse } from '@/test/http'
import { stubFetch } from '@/test/reminders'
import { notice, noticeDetail } from '@/test/notices'
import type { Notice } from '@/composables/useNotices'
import { noticeVersion, useNoticesStore } from './notices'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

const page = (results: Notice[]) => ({ count: results.length, next: null, previous: null, results })

describe('useNoticesStore', () => {
  it('separa pendientes e historial de un único listado y cuenta pendientes', async () => {
    const fn = stubFetch(() =>
      jsonResponse(page([notice(), notice({ uuid: 'N2', status: 'sent' })]))
    )
    const store = useNoticesStore()
    await store.load('T1')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.pending.map((n) => n.uuid)).toEqual(['N1'])
    expect(store.history.map((n) => n.uuid)).toEqual(['N2'])
    expect(store.pendingCount).toBe(1)
  })

  it('con 50 pendientes pide el historial aparte por estado', async () => {
    const pendings = Array.from({ length: 50 }, (_, i) => notice({ uuid: `P${i}` }))
    const fn = stubFetch((url) => {
      const status = url.searchParams.get('status')
      if (!status) return jsonResponse(page(pendings))
      if (status === 'sent,discarded,expired,superseded') {
        return jsonResponse(page([notice({ uuid: 'S1', status: 'sent' })]))
      }
      return jsonResponse(page([]))
    })
    const store = useNoticesStore()
    await store.load('T1')
    const statuses = fn.mock.calls
      .map(([u]) => new URL(String(u)).searchParams.get('status'))
      .filter(Boolean)
    expect(statuses).toEqual(['sent,discarded,expired,superseded'])
    expect(store.history.map((n) => n.uuid)).toEqual(['S1'])
  })

  it('invalida el detalle si cambia la versión del aviso en el listado', async () => {
    let list = [notice()]
    stubFetch((url) =>
      url.pathname.endsWith('/notices/') ? jsonResponse(page(list)) : jsonResponse(noticeDetail())
    )
    const store = useNoticesStore()
    await store.load('T1')
    await store.ensureDetail('N1')
    expect(store.details.has('N1')).toBe(true)
    await store.load('T1')
    expect(store.details.has('N1')).toBe(true)
    list = [notice({ updated_at: '2026-11-21T12:00:00Z' })]
    await store.load('T1')
    expect(store.details.has('N1')).toBe(false)
  })

  it('ensureDetail comparte la petición en curso', async () => {
    const fn = stubFetch(() => jsonResponse(noticeDetail()))
    const store = useNoticesStore()
    store.reset('T1')
    await Promise.all([store.ensureDetail('N1'), store.ensureDetail('N1')])
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('noticeVersion usa updated_at si llega', () => {
    expect(noticeVersion(notice({ updated_at: 'X' }))).toBe('X')
    expect(noticeVersion(notice())).not.toBe(noticeVersion(notice({ status: 'sent' })))
  })

  it('un error deja el contador sin dato', async () => {
    stubFetch(() => jsonResponse({}, 500))
    const store = useNoticesStore()
    await expect(store.load('T1')).rejects.toBeTruthy()
    expect(store.pendingCount).toBeNull()
  })

  it('fetchDetail con force ignora la caché y comparte la petición en curso', async () => {
    const fn = stubFetch(() => jsonResponse(noticeDetail()))
    const store = useNoticesStore()
    await store.fetchDetail('N1')
    await store.fetchDetail('N1')
    expect(fn).toHaveBeenCalledTimes(1)
    await Promise.all([store.fetchDetail('N1', { force: true }), store.fetchDetail('N1', { force: true })])
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
