import { beforeEach, describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch, stubMatchMedia } from '@/test/reminders'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import CreateActivityModal from './CreateActivityModal.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

const TYPE = {
  uuid: 'type-urgent',
  code: 'urgent_meeting',
  name: 'Reunión urgente',
  category: 'meetings',
  is_active: true,
  has_duration: true,
}

function setTour(isAdmin: boolean) {
  const store = useToursStore()
  store.tours = [{ id: 1, uuid: 'T1', name: 'Gira', current_user_is_admin: isAdmin } as Tour]
  store.setActiveTourByUuid('T1')
}

function handler(code = 'urgent_meeting', status = 'scheduled') {
  return stubFetch((url, init) => {
    if (url.pathname.endsWith('/activity-types/')) {
      return jsonResponse({ count: 1, next: null, previous: null, results: [{ ...TYPE, code }] })
    }
    if (url.pathname.endsWith('/events/activities/') && init?.method === 'POST') {
      return jsonResponse({
        uuid: 'A1',
        title: 'Reunión urgente',
        status,
        activity_type: { ...TYPE, code },
      }, 201)
    }
    if (url.pathname.endsWith('/notices/urgent/')) return jsonResponse({}, 500)
    return jsonResponse({}, 404)
  })
}

async function createUrgent() {
  const w = mount(CreateActivityModal, {
    props: { show: false },
    global: { plugins: [i18n], stubs: { UrgentNoticeModal: true } },
  })
  await w.setProps({ show: true })
  await flushPromises()
  await w.get('select').setValue('type-urgent')
  const create = w.findAll('button').find((b) => b.text() === 'Crear Actividad')!
  await create.trigger('click')
  await flushPromises()
  return w
}

describe('CreateActivityModal: oferta de aviso urgente', () => {
  it('al crear una reunión urgente siendo admin ofrece avisar y abre el aviso', async () => {
    setTour(true)
    handler()
    const w = await createUrgent()
    expect(w.emitted('close')).toBeTruthy()
    expect(w.get('[data-test="urgent-offer"]').text()).toContain(
      '¿Quieres avisar ahora al equipo de esta reunión urgente?'
    )
    await w.get('[data-test="urgent-offer-accept"]').trigger('click')
    const modal = w.findComponent({ name: 'UrgentNoticeModal' })
    expect(modal.props('show')).toBe(true)
    expect(modal.props('activityUuid')).toBe('A1')
  })

  it('no lo ofrece a quien no es admin ni para otros tipos', async () => {
    setTour(false)
    handler()
    let w = await createUrgent()
    expect(w.find('[data-test="urgent-offer"]').exists()).toBe(false)
    setActivePinia(createPinia())
    setTour(true)
    handler('team_meeting')
    w = await createUrgent()
    expect(w.find('[data-test="urgent-offer"]').exists()).toBe(false)
  })
})

describe('CreateActivityModal: zona horaria (F0 §4.3)', () => {
  function captureCreate() {
    const bodies: Record<string, unknown>[] = []
    stubFetch((url, init) => {
      if (url.pathname.endsWith('/activity-types/')) {
        return jsonResponse({ count: 1, next: null, previous: null, results: [TYPE] })
      }
      if (url.pathname.endsWith('/events/activities/') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        bodies.push(body)
        return jsonResponse({ uuid: 'A1', title: body.title, status: 'scheduled' }, 201)
      }
      return jsonResponse({}, 404)
    })
    return bodies
  }

  async function mountOpen() {
    const w = mount(CreateActivityModal, {
      props: { show: false },
      global: { plugins: [i18n], stubs: { UrgentNoticeModal: true } },
    })
    await w.setProps({ show: true })
    await flushPromises()
    return w
  }

  function setZonedTour(timezone: string) {
    const store = useToursStore()
    store.tours = [
      { id: 1, uuid: 'T1', name: 'Gira', current_user_is_admin: false, timezone } as Tour,
    ]
    store.setActiveTourByUuid('T1')
  }

  it('propone la zona de la gira activa', async () => {
    setZonedTour('America/Bogota')
    captureCreate()
    const w = await mountOpen()
    expect(w.get<HTMLSelectElement>('[data-testid="activity-timezone"]').element.value).toBe(
      'America/Bogota'
    )
  })

  it('una zona de gira fuera de la lista común se añade como opción', async () => {
    setZonedTour('Asia/Tokyo')
    captureCreate()
    const w = await mountOpen()
    const select = w.get<HTMLSelectElement>('[data-testid="activity-timezone"]')
    expect(select.element.value).toBe('Asia/Tokyo')
    expect(select.findAll('option')[0].text()).toBe('Asia/Tokyo')
  })

  it('10:00 en Madrid (invierno) se envía como 09:00Z, con la zona', async () => {
    setZonedTour('Europe/Madrid')
    const bodies = captureCreate()
    const w = await mountOpen()
    await w.get('select').setValue('type-urgent')
    await w.get('input[type="date"]').setValue('2026-12-01')
    const [start, end] = w.findAll('input[type="time"]')
    await start.setValue('10:00')
    await end.setValue('11:30')
    await w.findAll('button').find((b) => b.text() === 'Crear Actividad')!.trigger('click')
    await flushPromises()
    expect(bodies).toHaveLength(1)
    expect(bodies[0].timezone).toBe('Europe/Madrid')
    expect(bodies[0].scheduled_at).toBe('2026-12-01T09:00:00.000Z')
    expect(bodies[0].end_at).toBe('2026-12-01T10:30:00.000Z')
  })

  it('cambiar la zona cambia el instante enviado (verano en Madrid → UTC+2)', async () => {
    setZonedTour('UTC')
    const bodies = captureCreate()
    const w = await mountOpen()
    await w.get('select').setValue('type-urgent')
    await w.get('[data-testid="activity-timezone"]').setValue('Europe/Madrid')
    await w.get('input[type="date"]').setValue('2026-07-01')
    const [start, end] = w.findAll('input[type="time"]')
    await start.setValue('22:00')
    await end.setValue('23:00')
    await w.findAll('button').find((b) => b.text() === 'Crear Actividad')!.trigger('click')
    await flushPromises()
    expect(bodies[0].scheduled_at).toBe('2026-07-01T20:00:00.000Z')
    expect(bodies[0].end_at).toBe('2026-07-01T21:00:00.000Z')
    expect(bodies[0].timezone).toBe('Europe/Madrid')
  })

  it('todo el día en Bogotá: la fecha enviada cae en el mismo día en esa zona', async () => {
    setZonedTour('America/Bogota')
    const bodies = captureCreate()
    const w = await mountOpen()
    await w.get('select').setValue('type-urgent')
    await w.get('input[type="date"]').setValue('2026-12-01')
    await w.get('label.cursor-pointer div').trigger('click')
    await w.findAll('button').find((b) => b.text() === 'Crear Actividad')!.trigger('click')
    await flushPromises()
    expect(bodies[0]).toMatchObject({ all_day: true, timezone: 'America/Bogota' })
    // Lo que hace el backend: `astimezone(zona).date()` → 1-dic, no 30-nov.
    const day = (iso: unknown) =>
      DateTime.fromISO(String(iso)).setZone('America/Bogota').toISODate()
    expect(day(bodies[0].scheduled_at)).toBe('2026-12-01')
    expect(day(bodies[0].end_at)).toBe('2026-12-01')
    expect(bodies[0].scheduled_at).toBe('2026-12-01T17:00:00.000Z')
  })
})

describe('CreateActivityModal: pista del importador (F2 A7)', () => {
  async function mountWith(canImport: boolean) {
    setTour(true)
    handler()
    const w = mount(CreateActivityModal, {
      props: { show: false, canImport },
      global: { plugins: [i18n], stubs: { UrgentNoticeModal: true } },
    })
    await w.setProps({ show: true })
    await flushPromises()
    return w
  }

  it('solo con canImport, y el botón emite openImport', async () => {
    const off = await mountWith(false)
    expect(off.find('[data-test="create-import-hint"]').exists()).toBe(false)

    const w = await mountWith(true)
    expect(w.get('[data-test="create-import-hint"]').text()).toContain(
      '¿Tienes el itinerario en un PDF, un Excel o una foto?'
    )
    const cta = w.get('[data-test="create-import-hint-cta"]')
    expect(cta.text()).toBe('Impórtalo de una vez')
    expect(cta.classes()).toContain('min-h-[44px]')
    await cta.trigger('click')
    expect(w.emitted('openImport')).toHaveLength(1)
  })
})

