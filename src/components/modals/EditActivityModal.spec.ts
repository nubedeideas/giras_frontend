import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { DateTime } from 'luxon'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch } from '@/test/reminders'
import { useToursStore } from '@/stores/tours'
import type { Activity } from '@/composables/useActivities'
import type { Tour } from '@/types'
import EditActivityModal from './EditActivityModal.vue'

function activity(over: Record<string, unknown> = {}): Activity {
  return {
    uuid: 'A1',
    tour: 'T1',
    title: 'Concierto',
    activity_type: { uuid: 'type-1', name: 'Concierto', code: 'concert', category: 'show' },
    status: 'scheduled',
    priority: 'normal',
    // 21:00 en Madrid (invierno, UTC+1).
    scheduled_at: '2026-12-01T20:00:00Z',
    end_at: '2026-12-01T22:30:00Z',
    timezone: 'Europe/Madrid',
    all_day: false,
    location_name: '',
    destination_name: '',
    notes: '',
    description: '',
    ...over,
  } as unknown as Activity
}

function setup() {
  const bodies: Record<string, unknown>[] = []
  stubFetch((url, init) => {
    if (url.pathname.endsWith('/activity-types/')) {
      return jsonResponse({ count: 0, next: null, previous: null, results: [] })
    }
    if (url.pathname.endsWith('/events/activities/A1/') && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body))
      bodies.push(body)
      return jsonResponse({ ...activity(), ...body })
    }
    return jsonResponse({}, 404)
  })
  return bodies
}

async function mountOpen(act: Activity) {
  const w = mount(EditActivityModal, {
    props: { show: false, activity: act },
    global: { plugins: [i18n] },
  })
  await w.setProps({ show: true })
  await flushPromises()
  return w
}

function inputs(w: Awaited<ReturnType<typeof mountOpen>>) {
  return w.findAll<HTMLInputElement>('input[type="datetime-local"]')
}

async function save(w: Awaited<ReturnType<typeof mountOpen>>) {
  await w.findAll('button').find((b) => b.text() === 'Guardar cambios')!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EditActivityModal: zona horaria (F0 §4.3)', () => {
  it('muestra scheduled_at y end_at en la zona de la actividad', async () => {
    setup()
    const w = await mountOpen(activity())
    const [start, end] = inputs(w)
    expect(start.element.value).toBe('2026-12-01T21:00')
    expect(end.element.value).toBe('2026-12-01T23:30')
    expect(w.get('[data-testid="edit-activity-zone"]').text()).toBe('Hora local (Europe/Madrid)')
  })

  it('guarda la conversión inversa (hora de Madrid → UTC)', async () => {
    const bodies = setup()
    const w = await mountOpen(activity())
    const [start, end] = inputs(w)
    await start.setValue('2026-12-01T10:00')
    await end.setValue('2026-12-01T11:15')
    await save(w)
    expect(bodies).toHaveLength(1)
    expect(bodies[0].scheduled_at).toBe('2026-12-01T09:00:00.000Z')
    expect(bodies[0].end_at).toBe('2026-12-01T10:15:00.000Z')
  })

  it('sin tocar las horas, reenvía el mismo instante', async () => {
    const bodies = setup()
    const w = await mountOpen(activity())
    await save(w)
    expect(bodies[0].scheduled_at).toBe('2026-12-01T20:00:00.000Z')
    expect(bodies[0].end_at).toBe('2026-12-01T22:30:00.000Z')
  })

  it('actividad sin zona válida: usa la de la gira activa', async () => {
    const store = useToursStore()
    store.tours = [{ id: 1, uuid: 'T1', name: 'Gira', timezone: 'America/Bogota' } as Tour]
    store.setActiveTourByUuid('T1')
    setup()
    const w = await mountOpen(activity({ timezone: '' }))
    // 20:00Z en Bogotá (UTC-5) son las 15:00.
    expect(inputs(w)[0].element.value).toBe('2026-12-01T15:00')
    expect(w.get('[data-testid="edit-activity-zone"]').text()).toBe('Hora local (America/Bogota)')
  })

  it('todo el día en Bogotá: manda la fecha en la zona y la zona en el PATCH', async () => {
    const bodies = setup()
    // 1-dic todo el día en Bogotá: 05:00Z a 04:59:59Z del día siguiente.
    const w = await mountOpen(
      activity({
        timezone: 'America/Bogota',
        all_day: true,
        scheduled_at: '2026-12-01T05:00:00Z',
        end_at: '2026-12-02T04:59:59Z',
      })
    )
    await save(w)
    expect(bodies[0]).toMatchObject({ all_day: true, timezone: 'America/Bogota', end_at: null })
    const sent = DateTime.fromISO(String(bodies[0].scheduled_at)).setZone('America/Bogota')
    expect(sent.toISODate()).toBe('2026-12-01')
  })

  it('el PATCH incluye la zona de la actividad también con hora', async () => {
    const bodies = setup()
    const w = await mountOpen(activity())
    await save(w)
    expect(bodies[0].timezone).toBe('Europe/Madrid')
  })
})
