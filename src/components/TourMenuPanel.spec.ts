import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import { jsonResponse } from '@/test/http'
import { defaultTourZone } from '@/utils/timezones'
import TourMenuPanel from './TourMenuPanel.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function tour(uuid: string, id: number): Tour {
  return {
    id,
    uuid,
    name: `Gira ${uuid}`,
    artist_name: 'Artista',
    start_date: '2026-12-01',
    end_date: '2026-12-31',
    status: 'active',
    currency: 'EUR',
    color: '#a8d800',
    owner_email: 'a@b.c',
    timezone: 'Europe/Madrid',
    enable_notifications: true,
    notifications_paused_at: null,
  }
}

function full(uuid: string, time: string | null) {
  return {
    uuid,
    name: `Gira ${uuid}`,
    artist_name: 'Artista',
    start_date: '2026-12-01',
    end_date: '2026-12-31',
    status: 'active',
    currency: 'EUR',
    settings: {},
    notes: '',
    show_day_alert_enabled: true,
    show_day_alert_time: time,
    show_day_alert_default_time: '09:00',
    show_day_alert_available: false,
  }
}

const empty = { count: 0, next: null, previous: null, results: [] }

/** fetch por URL; el detalle de la gira A se resuelve a mano para simular que llega tarde. */
function setupFetch() {
  let resolveA: (r: Response) => void = () => {}
  const fn = vi.fn<typeof fetch>((input, init) => {
    const url = String(input)
    if (init?.method === 'PATCH') return Promise.resolve(jsonResponse(full('B', null)))
    if (url.endsWith('/tours/A/')) return new Promise<Response>((r) => (resolveA = r))
    if (url.endsWith('/tours/B/')) return Promise.resolve(jsonResponse(full('B', '09:10:00')))
    return Promise.resolve(jsonResponse(empty))
  })
  vi.stubGlobal('fetch', fn)
  return { fn, resolveA: (r: Response) => resolveA(r) }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  useToursStore().tours = [tour('A', 1), tour('B', 2)]
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountPanel() {
  return mount(TourMenuPanel, {
    props: { show: true, mobile: true },
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
}

function editButtons(w: ReturnType<typeof mountPanel>) {
  return w.findAll('button').filter((b) => b.text() === i18n.global.t('tours.edit'))
}

describe('TourMenuPanel: alerta del día de show', () => {
  it('descarta el detalle de una gira que ya no se está editando', async () => {
    const { resolveA } = setupFetch()
    const w = mountPanel()
    await editButtons(w)[0].trigger('click') // A (queda pendiente)
    await w.findAll('button').find((b) => b.text() === i18n.global.t('common.cancel'))!.trigger('click')
    await editButtons(w)[1].trigger('click') // B
    await flushPromises()
    const input = w.find<HTMLInputElement>('#show-day-alert-time')
    expect(input.element.value).toBe('09:10')

    resolveA(jsonResponse(full('A', '20:00:00')))
    await flushPromises()
    expect(w.find<HTMLInputElement>('#show-day-alert-time').element.value).toBe('09:10')
    expect(w.text()).toContain('Pendiente de aprobación de WhatsApp')
  })

  it('una hora antigua fuera de tramo no bloquea el guardado y no se reenvía', async () => {
    const { fn } = setupFetch()
    const w = mountPanel()
    await editButtons(w)[1].trigger('click')
    await flushPromises()
    await w.find('button[role="switch"]').trigger('click') // apaga la alerta
    // Apagada, la hora sigue editable.
    expect(w.find('#show-day-alert-time').attributes('disabled')).toBeUndefined()
    const save = w.findAll('button').find((b) => b.text() === i18n.global.t('common.save'))!
    await save.trigger('click')
    await flushPromises()
    const patch = fn.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patch).toBeDefined()
    const body = JSON.parse(String(patch![1]!.body))
    expect(body.show_day_alert_enabled).toBe(false)
    expect('show_day_alert_time' in body).toBe(false)
  })

  it('una hora nueva fuera de tramo se rechaza en cliente; "Usar hora por defecto" manda null', async () => {
    const { fn } = setupFetch()
    const w = mountPanel()
    await editButtons(w)[1].trigger('click')
    await flushPromises()
    await w.find('#show-day-alert-time').setValue('10:20')
    const save = () => w.findAll('button').find((b) => b.text() === i18n.global.t('common.save'))!
    await save().trigger('click')
    await flushPromises()
    expect(w.text()).toContain('La hora de la alerta debe ir en tramos de 15 minutos.')
    expect(fn.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)

    await w.find('[data-testid="show-day-alert-use-default"]').trigger('click')
    expect(w.find<HTMLInputElement>('#show-day-alert-time').element.value).toBe('')
    await save().trigger('click')
    await flushPromises()
    const patch = fn.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch![1]!.body)).show_day_alert_time).toBeNull()
  })
})

describe('TourMenuPanel: zona horaria y avisos en pausa (F0)', () => {
  it('badge "Avisos en pausa" en la gira activa cuando está en pausa', async () => {
    setupFetch()
    const store = useToursStore()
    store.activeTourId = 1
    const w = mountPanel()
    expect(w.find('[data-testid="tour-menu-paused-badge"]').exists()).toBe(false)
    store.tours[0].enable_notifications = false
    await flushPromises()
    expect(w.find('[data-testid="tour-menu-paused-badge"]').text()).toBe('Avisos en pausa')
  })

  it('editar: muestra la zona de la gira y la manda en el PATCH', async () => {
    const { fn } = setupFetch()
    useToursStore().tours[1].timezone = 'Asia/Tokyo'
    const w = mountPanel()
    await editButtons(w)[1].trigger('click')
    await flushPromises()
    const select = w.find<HTMLSelectElement>('[data-testid="tour-form-timezone"]')
    // Una zona fuera de la lista común se añade como opción.
    expect(select.element.value).toBe('Asia/Tokyo')
    await select.setValue('America/Lima')
    await w.findAll('button').find((b) => b.text() === i18n.global.t('common.save'))!.trigger('click')
    await flushPromises()
    const patch = fn.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch![1]!.body)).timezone).toBe('America/Lima')
  })

  it('crear: propone la zona por defecto y la manda en el POST', async () => {
    const posted: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (_input, init) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body))
          posted.push(body)
          return jsonResponse({ ...full('C', null), ...body, uuid: 'C' }, 201)
        }
        return jsonResponse(empty)
      })
    )
    const w = mountPanel()
    await w.findAll('button').find((b) => b.text().includes(i18n.global.t('tours.newTour')))!.trigger('click')
    const select = w.find<HTMLSelectElement>('[data-testid="tour-form-timezone"]')
    expect(select.element.value).toBe(defaultTourZone())
    await select.setValue('Europe/Lisbon')
    await w.find(`input[placeholder="${i18n.global.t('modal.tourNamePh')}"]`).setValue('Gira C')
    await w.find(`input[placeholder="${i18n.global.t('modal.artistPh')}"]`).setValue('Abc')
    await w.findAll('button').find((b) => b.text() === i18n.global.t('tours.create'))!.trigger('click')
    await flushPromises()
    expect(posted).toHaveLength(1)
    expect(posted[0].timezone).toBe('Europe/Lisbon')
  })
})
