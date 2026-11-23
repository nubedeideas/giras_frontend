import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useToursStore } from '@/stores/tours'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { adminTour, icalApiError, icalSub } from '@/test/icalSubscriptions'
import type { IcalSubscription } from '@/composables/useIcalSubscriptions'
import { useImportsStore } from '@/stores/imports'
import IcalSubscriptionCard from './IcalSubscriptionCard.vue'

async function mountCard(sub: IcalSubscription, opts: { follow?: boolean } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
    ],
  })
  await router.push('/settings')
  await router.isReady()
  // `follow`: el padre pasa a la tarjeta cada `changed` (como hace el gestor).
  const w = mount(IcalSubscriptionCard, {
    props: {
      sub,
      ...(opts.follow ? { onChanged: (next: IcalSubscription) => w.setProps({ sub: next }) } : {}),
    },
    global: { plugins: [i18n, router] },
  })
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  useToursStore().tours = [adminTour()]
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IcalSubscriptionCard', () => {
  it('estado, gira con punto, url_display y fechas en font-time tnum', async () => {
    const w = await mountCard(icalSub())
    expect(w.get('[data-test="ical-status"]').text()).toBe('Al día')
    expect(w.get('[data-test="ical-status"]').attributes('data-status')).toBe('sent')
    expect(w.get('[data-test="ical-tour-dot"]').attributes('style')).toContain('rgb(255, 0, 0)')
    expect(w.text()).toContain('Gira 2027')
    expect(w.get('[data-test="ical-url-display"]').text()).toBe('p52-caldav.icloud.com/…/K7f2')
    const last = w.get('[data-test="ical-last-sync"]')
    expect(last.text()).toMatch(/^Última sincronización: 23 nov/)
    expect(last.get('.font-time').classes()).toContain('tnum')
    expect(w.get('[data-test="ical-next-sync"] .font-time').classes()).toContain('tnum')
    expect(w.find('[data-test="ical-error"]').exists()).toBe(false)
    w.unmount()

    const never = await mountCard(
      icalSub({ last_synced_at: null, last_status: 'pending', sync_enabled: false })
    )
    expect(never.get('[data-test="ical-last-sync"]').text()).toBe('Aún no se ha sincronizado')
    expect(never.find('[data-test="ical-next-sync"]').exists()).toBe(false)
    expect(never.get('[data-test="ical-status"]').text()).toBe('Sincronizando')
  })

  it('error traducido, freno de retiradas y enlace a los cambios por revisar', async () => {
    const job = { uuid: 'J3', status: 'ready' as const, created_at: '', new: 2, changed: 1, cancelled: 1 }
    const w = await mountCard(
      icalSub({
        last_status: 'error',
        last_error_code: 'http_410',
        stats: { removal_guard: true },
        pending_job: job,
      })
    )
    expect(w.get('[data-test="ical-status"]').attributes('data-status')).toBe('failed')
    expect(w.get('[data-test="ical-error"]').text()).toBe(
      'El calendario ya no está publicado o la dirección ha cambiado.'
    )
    expect(w.text()).not.toContain('http_410')
    expect(w.get('[data-test="ical-removal-guard"]').text()).toContain('perdido muchos eventos')
    expect(w.get('[data-test="ical-review-badge"]').text()).toBe('Cambios por revisar')
    const link = w.get('[data-test="ical-review-link"]')
    expect(link.text()).toBe('Cambios por revisar (4)')
    expect(link.attributes('href')).toBe('/tour/import/J3')
  })

  it('sincronizar ahora: 202 y sondeo hasta el final; 429 con los minutos', async () => {
    const fn = mockFetch(
      jsonResponse({ status: 'queued' }, 202),
      jsonResponse(icalSub({ last_attempt_at: '2026-11-23T11:00:00Z' })),
      jsonResponse(icalApiError('sync_too_soon', 429, { retry_after_seconds: 200 }), 429)
    )
    const w = await mountCard(icalSub())
    await w.get('[data-test="ical-sync"]').trigger('click')
    await flushPromises()
    expect(callAt(fn, 0).url).toContain('/ical-subscriptions/S1/sync/')
    expect(callAt(fn, 0).init.method).toBe('POST')
    // Sincronización normal: sin `full`.
    expect(JSON.parse(String(callAt(fn, 0).init.body))).toEqual({})
    expect(callAt(fn, 1).url).toContain('/ical-subscriptions/S1/')
    expect(w.emitted('changed')?.[0][0]).toMatchObject({ last_attempt_at: '2026-11-23T11:00:00Z' })
    // Ya ha terminado: sin "en marcha".
    expect(w.find('[data-test="ical-notice"]').exists()).toBe(false)

    await w.get('[data-test="ical-sync"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="ical-action-error"]').text()).toBe(
      'Acabamos de sincronizar. Vuelve a probar en 4 min.'
    )
  })

  it('tras sincronizar sondea cada 3 s: "Sincronizando" → "Cambios por revisar (n)" sin recargar', async () => {
    vi.useFakeTimers()
    try {
      const job = {
        uuid: 'J4',
        status: 'ready' as const,
        created_at: '',
        new: 2,
        changed: 1,
        cancelled: 0,
      }
      const processing = { ...job, status: 'extracting' as const }
      const fn = mockFetch(
        jsonResponse({ status: 'queued' }, 202),
        jsonResponse(icalSub({ last_status: 'pending' })),
        jsonResponse(icalSub({ last_status: 'ok', pending_job: processing })),
        jsonResponse(icalSub({ last_status: 'ok', pending_job: job }))
      )
      const imports = useImportsStore()
      const w = await mountCard(icalSub(), { follow: true })
      await w.get('[data-test="ical-sync"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="ical-status"]').text()).toBe('Sincronizando')
      expect(w.get('[data-test="ical-notice"]').text()).toContain('Sincronización en marcha')
      expect(w.get('[data-test="ical-sync"]').attributes('disabled')).toBeDefined()
      await vi.advanceTimersByTimeAsync(3000)
      await flushPromises()
      expect(fn).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(3000)
      await flushPromises()
      expect(fn).toHaveBeenCalledTimes(4)
      expect(w.get('[data-test="ical-review-link"]').text()).toBe('Cambios por revisar (3)')
      expect(w.get('[data-test="ical-status"]').text()).toBe('Al día')
      expect(w.find('[data-test="ical-notice"]').exists()).toBe(false)
      expect(w.get('[data-test="ical-sync"]').attributes('disabled')).toBeUndefined()
      expect(w.emitted('changed')).toHaveLength(3)
      // Mi Gira recarga su aviso de borradores pendientes.
      expect(imports.version).toBe(1)
      expect(imports.lastTour).toBe('T1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('"Volver a leer todo el calendario" manda full: true, con su ayuda', async () => {
    const fn = mockFetch(jsonResponse({ status: 'queued' }, 202), jsonResponse(icalSub()))
    const w = await mountCard(icalSub())
    expect(w.text()).toContain('Vuelve a proponer lo que descartaste o mantuviste.')
    const full = w.get('[data-test="ical-sync-full"]')
    expect(full.text()).toBe('Volver a leer todo el calendario')
    await full.trigger('click')
    await flushPromises()
    expect(callAt(fn, 0).url).toContain('/ical-subscriptions/S1/sync/')
    expect(JSON.parse(String(callAt(fn, 0).init.body))).toEqual({ full: true })
  })

  it('gira terminada o cerrada: sin "Reanudar" y explica por qué no se sincroniza', async () => {
    for (const last_status of ['tour_ended', 'tour_closed'] as const) {
      const fn = mockFetch()
      const w = await mountCard(icalSub({ last_status, sync_enabled: false }))
      expect(w.get('[data-test="ical-status"]').text()).toBe('Gira terminada')
      expect(w.find('[data-test="ical-toggle"]').exists()).toBe(false)
      expect(w.find('[data-test="ical-sync-full"]').exists()).toBe(false)
      const sync = w.get('[data-test="ical-sync"]')
      expect(sync.attributes('disabled')).toBeDefined()
      const ended = w.get('[data-test="ical-ended"]')
      expect(ended.text()).toContain('La gira ha terminado o está cerrada')
      expect(sync.attributes('aria-describedby')).toBe(ended.attributes('id'))
      expect(w.find('[data-test="ical-delete"]').exists()).toBe(true)
      expect(fn).not.toHaveBeenCalled()
      w.unmount()
    }
  })

  it('reanudar: si queda "Sincronizando", sondea hasta el final', async () => {
    const fn = mockFetch(
      jsonResponse(icalSub({ sync_enabled: true, last_status: 'pending' })),
      jsonResponse(icalSub({ sync_enabled: true, last_status: 'ok' }))
    )
    const w = await mountCard(icalSub({ sync_enabled: false, last_status: 'paused' }))
    await w.get('[data-test="ical-toggle"]').trigger('click')
    await flushPromises()
    expect(callAt(fn, 0).init.method).toBe('PATCH')
    expect(callAt(fn, 1).init.method ?? 'GET').toBe('GET')
    const changed = w.emitted('changed')!.map((e) => (e[0] as IcalSubscription).last_status)
    expect(changed).toEqual(['pending', 'ok'])
    expect(w.find('[data-test="ical-notice"]').exists()).toBe(false)
  })

  it('pausar y reanudar con PATCH sync_enabled', async () => {
    const fn = mockFetch(
      jsonResponse(icalSub({ sync_enabled: false, last_status: 'paused' })),
      jsonResponse(icalSub({ sync_enabled: true }))
    )
    const w = await mountCard(icalSub())
    expect(w.get('[data-test="ical-toggle"]').text()).toBe('Pausar')
    await w.get('[data-test="ical-toggle"]').trigger('click')
    await flushPromises()
    expect(callAt(fn, 0).init.method).toBe('PATCH')
    expect(JSON.parse(String(callAt(fn, 0).init.body))).toEqual({ sync_enabled: false })
    const paused = w.emitted('changed')![0][0] as IcalSubscription
    await w.setProps({ sub: paused })
    expect(w.get('[data-test="ical-toggle"]').text()).toBe('Reanudar')
    expect(w.get('[data-test="ical-sync"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="ical-status"]').text()).toBe('En pausa')
    await w.get('[data-test="ical-toggle"]').trigger('click')
    await flushPromises()
    expect(JSON.parse(String(callAt(fn, 1).init.body))).toEqual({ sync_enabled: true })
  })

  it('eliminar pide confirmación; cancelar no llama a la API', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }))
    const w = await mountCard(icalSub())
    await w.get('[data-test="ical-delete"]').trigger('click')
    expect(w.get('[data-test="ical-delete-confirm"]').text()).toContain(
      'Las actividades ya importadas se quedan en la gira.'
    )
    await w.get('[data-test="ical-delete-no"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="ical-delete-confirm"]').exists()).toBe(false)
    expect(fn).not.toHaveBeenCalled()

    await w.get('[data-test="ical-delete"]').trigger('click')
    await w.get('[data-test="ical-delete-yes"]').trigger('click')
    await flushPromises()
    expect(callAt(fn, 0).init.method).toBe('DELETE')
    expect(w.emitted('deleted')).toEqual([['S1']])
  })

  it('404 al actuar: pide recargar la lista', async () => {
    mockFetch(jsonResponse({ detail: 'No encontrado.' }, 404))
    const w = await mountCard(icalSub())
    await w.get('[data-test="ical-toggle"]').trigger('click')
    await flushPromises()
    expect(w.emitted('stale')).toHaveLength(1)
  })
})

describe('IcalSubscriptionCard: creador que ya no es admin (F5a)', () => {
  const paused = () =>
    icalSub({
      last_status: 'error',
      last_error_code: 'owner_not_admin',
      sync_enabled: false,
      owner: { name: 'Ana', is_me: false, is_admin: false },
    })

  it('explica el motivo, sin código crudo, y solo ofrece "Hacerme responsable" y "Eliminar"', async () => {
    const w = await mountCard(paused())
    const box = w.get('[data-test="ical-owner-not-admin"]')
    expect(box.text()).toContain('Quien añadió este calendario ya no es administrador de la gira')
    expect(w.text()).not.toContain('owner_not_admin')
    expect(w.find('[data-test="ical-error"]').exists()).toBe(false)
    expect(w.get('[data-test="ical-take-over"]').text()).toBe('Hacerme responsable')
    expect(w.find('[data-test="ical-sync"]').exists()).toBe(false)
    expect(w.find('[data-test="ical-toggle"]').exists()).toBe(false)
    expect(w.find('[data-test="ical-sync-full"]').exists()).toBe(false)
    expect(w.find('[data-test="ical-delete"]').exists()).toBe(true)
  })

  it('"Hacerme responsable": POST take-over, emite changed, sondea y refresca la campana', async () => {
    const taken = icalSub({
      last_status: 'pending',
      last_error_code: '',
      sync_enabled: true,
      owner: { name: 'Yo', is_me: true, is_admin: true },
    })
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        calls.push(`${method} ${new URL(url).pathname}`)
        if (method === 'POST' && url.includes('/ical-subscriptions/S1/take-over/')) {
          return jsonResponse(taken)
        }
        if (url.includes('/ical-subscriptions/S1/')) return jsonResponse({ ...taken, last_status: 'ok' })
        if (url.includes('/unread-count/')) return jsonResponse({ unread: 0, latest_occurred_at: null })
        return jsonResponse({}, 404)
      })
    )
    const w = await mountCard(paused(), { follow: true })
    await w.get('[data-test="ical-take-over"]').trigger('click')
    await flushPromises()
    expect(calls).toContain('POST /api/integrations/ical-subscriptions/S1/take-over/')
    expect(calls.some((c) => c.endsWith('/unread-count/'))).toBe(true)
    expect(calls).toContain('GET /api/integrations/ical-subscriptions/S1/')
    const changed = w.emitted('changed') as [IcalSubscription][]
    expect(changed[0][0].owner?.is_me).toBe(true)
    expect(w.find('[data-test="ical-owner-not-admin"]').exists()).toBe(false)
    expect(w.find('[data-test="ical-toggle"]').exists()).toBe(true)
  })

  it('error del take-over traducido', async () => {
    mockFetch(jsonResponse({ detail: 'x' }, 403))
    const w = await mountCard(paused())
    await w.get('[data-test="ical-take-over"]').trigger('click')
    await flushPromises()
    const err = w.get('[data-test="ical-action-error"]').text()
    expect(err.length).toBeGreaterThan(0)
    expect(w.get('[data-test="ical-take-over"]').attributes('disabled')).toBeUndefined()
  })
})
