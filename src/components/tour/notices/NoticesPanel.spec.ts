import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch, stubMatchMedia, type Handler } from '@/test/reminders'
import { notice, noticeDetail } from '@/test/notices'
import type { Notice } from '@/composables/useNotices'
import { useNoticesStore } from '@/stores/notices'
import NoticesPanel from './NoticesPanel.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

// Paneles de tests anteriores seguirían escuchando `visibilitychange` y con su polling.
enableAutoUnmount(afterEach)

afterEach(() => {
  vi.useRealTimers()
})

const page = (results: Notice[]) => ({ count: results.length, next: null, previous: null, results })

function handler(pending: Notice[], history: Notice[] = []): Handler {
  return (url) => {
    if (url.pathname.endsWith('/notices/')) {
      const status = url.searchParams.get('status')
      const all = [...pending, ...history]
      return jsonResponse(page(status ? all.filter((n) => n.status === status) : all))
    }
    const m = url.pathname.match(/\/notices\/([^/]+)\/$/)
    if (m) return jsonResponse(noticeDetail({ uuid: m[1] }))
    if (url.pathname.includes('/tours/')) return jsonResponse(page([]))
    return jsonResponse({}, 404)
  }
}

async function mountPanel(props: Record<string, unknown> = {}) {
  const w = mount(NoticesPanel, {
    props: { tourUuid: 'T1', ...props },
    global: { plugins: [i18n], stubs: { NoticeSheet: true } },
  })
  await flushPromises()
  return w
}

describe('NoticesPanel', () => {
  it('pendientes con resumen, destinatarios y coste; historial con quién', async () => {
    const sent = notice({
      uuid: 'N9',
      status: 'sent',
      sent_by_name: 'Oscar',
      sent_at: new Date().toISOString(),
    })
    stubFetch(handler([notice()], [sent]))
    const w = await mountPanel()
    const cards = w.findAll('[data-test="notice-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('IB3456 · MAD → BCN')
    expect(w.get('[data-test="notice-card-summary"]').text()).toBe('Sale con 45 min de retraso.')
    const meta = w.get('[data-test="notice-card-meta"]').text()
    expect(meta).toContain('Caduca')
    expect(meta).toContain('1 destinatario')
    expect(meta).toContain('0,30 USD')
    expect(w.get('[data-test="notice-history-status"]').text()).toBe('Enviado por Oscar Ahora')
    expect(useNoticesStore().pendingCount).toBe(1)
  })

  it('vacío', async () => {
    stubFetch(handler([]))
    const w = await mountPanel()
    expect(w.get('[data-test="notices-empty"]').text()).toBe('No tienes avisos pendientes.')
  })

  it('error con reintentar', async () => {
    let fail = true
    stubFetch((url, init) => (fail ? jsonResponse({}, 500) : handler([notice()])(url, init)))
    const w = await mountPanel()
    expect(w.get('[data-test="notices-error"]').text()).toContain('No se han podido cargar')
    fail = false
    await w.get('[data-test="notices-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test="notice-card"]')).toHaveLength(1)
  })

  it('403: mensaje de no admin sin reintentar', async () => {
    stubFetch((url) => (url.pathname.endsWith('/notices/') ? jsonResponse({}, 403) : jsonResponse(page([]))))
    const w = await mountPanel()
    expect(w.get('[data-test="notices-error"]').text()).toBe(
      'Solo los administradores de la gira pueden gestionar sus avisos.'
    )
    expect(w.find('[data-test="notices-retry"]').exists()).toBe(false)
  })

  it('deep link: abre la hoja del aviso y avisa de que lo ha consumido', async () => {
    stubFetch(handler([notice()]))
    const w = await mountPanel({ initialNotice: 'N1' })
    const sheet = w.findComponent({ name: 'NoticeSheet' })
    expect(sheet.props('noticeUuid')).toBe('N1')
    expect(sheet.props('show')).toBe(true)
    expect(w.emitted('initial-consumed')).toBeTruthy()
  })

  it('recarga cada 60 s mientras hay pendientes', async () => {
    vi.useFakeTimers()
    const fn = stubFetch(handler([notice()]))
    await mountPanel()
    const lists = () =>
      fn.mock.calls.filter(([u]) => new URL(String(u)).pathname.endsWith('/notices/')).length
    const before = lists()
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    // Una sola petición por recarga.
    expect(lists()).toBe(before + 1)
  })

  it('sin pendientes no hace polling', async () => {
    vi.useFakeTimers()
    const fn = stubFetch(handler([]))
    await mountPanel()
    const before = fn.mock.calls.length
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fn.mock.calls.length).toBe(before)
  })

  it('una sola petición de listado sin status, con page_size 50', async () => {
    const fn = stubFetch(handler([notice()]))
    await mountPanel()
    const lists = fn.mock.calls
      .map(([u]) => new URL(String(u)))
      .filter((u) => u.pathname.endsWith('/notices/'))
    expect(lists).toHaveLength(1)
    expect(lists[0].searchParams.get('page_size')).toBe('50')
    expect(lists[0].searchParams.has('status')).toBe(false)
  })

  it('no repite la carga si TourView ya la ha hecho', async () => {
    const fn = stubFetch(handler([notice()]))
    await useNoticesStore().load('T1')
    await mountPanel()
    const lists = fn.mock.calls.filter(([u]) => new URL(String(u)).pathname.endsWith('/notices/'))
    expect(lists).toHaveLength(1)
  })

  it('reutiliza el detalle en caché para la hoja y conserva borradores por uuid', async () => {
    const fn = stubFetch(handler([notice()]))
    const w = await mountPanel()
    const details = () =>
      fn.mock.calls.filter(([u]) => /\/notices\/N1\/$/.test(new URL(String(u)).pathname)).length
    expect(details()).toBe(1)
    await w.get('[data-test="notice-card"]').trigger('click')
    const sheet = w.findComponent({ name: 'NoticeSheet' })
    expect(useNoticesStore().details.get('N1')?.uuid).toBe('N1')
    sheet.vm.$emit('update:drafts', 'N1', { flight_status: 'Borrador' })
    sheet.vm.$emit('close')
    await flushPromises()
    await w.get('[data-test="notice-card"]').trigger('click')
    expect(w.findComponent({ name: 'NoticeSheet' }).props('drafts')).toEqual({
      flight_status: 'Borrador',
    })
    expect(details()).toBe(1)
  })

  it('onChanged no recarga el listado si aún no ha cargado (deep link)', async () => {
    let resolveList: (r: Response) => void = () => {}
    const fn = stubFetch((url) =>
      url.pathname.endsWith('/notices/')
        ? new Promise<Response>((r) => (resolveList = r))
        : jsonResponse(noticeDetail())
    )
    const w = await mountPanel({ initialNotice: 'N1' })
    w.findComponent({ name: 'NoticeSheet' }).vm.$emit(
      'changed',
      noticeDetail({ status: 'sent', preview: null })
    )
    await flushPromises()
    const lists = () =>
      fn.mock.calls.filter(([u]) => new URL(String(u)).pathname.endsWith('/notices/')).length
    expect(lists()).toBe(1)
    resolveList(jsonResponse(page([])))
    await flushPromises()
  })

  it('volver a la pestaña del navegador recarga como mucho cada 15 s', async () => {
    vi.useFakeTimers()
    const fn = stubFetch(handler([notice()]))
    await mountPanel()
    await vi.advanceTimersByTimeAsync(1_000)
    const lists = () =>
      fn.mock.calls.filter(([u]) => new URL(String(u)).pathname.endsWith('/notices/')).length
    const before = lists()
    expect(before).toBe(1)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(10)
    expect(lists()).toBe(before)
    await vi.advanceTimersByTimeAsync(15_000)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(10)
    expect(lists()).toBe(before + 1)
  })
})
