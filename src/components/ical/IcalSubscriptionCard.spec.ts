import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { useToursStore } from '@/stores/tours'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { adminTour, icalApiError, icalSub } from '@/test/icalSubscriptions'
import type { IcalSubscription } from '@/composables/useIcalSubscriptions'
import IcalSubscriptionCard from './IcalSubscriptionCard.vue'

async function mountCard(sub: IcalSubscription) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
    ],
  })
  await router.push('/settings')
  await router.isReady()
  return mount(IcalSubscriptionCard, {
    props: { sub },
    global: { plugins: [i18n, router] },
  })
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

  it('sincronizar ahora: 202 y refresco; 429 con los minutos', async () => {
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
    expect(w.emitted('changed')?.[0][0]).toMatchObject({ last_attempt_at: '2026-11-23T11:00:00Z' })
    expect(w.get('[data-test="ical-notice"]').text()).toContain('Sincronización en marcha')

    await w.get('[data-test="ical-sync"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="ical-action-error"]').text()).toBe(
      'Acabamos de sincronizar. Vuelve a probar en 4 min.'
    )
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
