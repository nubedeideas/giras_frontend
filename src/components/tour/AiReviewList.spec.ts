import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { group, stubFetch, wrappedError, type Handler } from '@/test/reminders'
import type { ActivityListItem } from '@/composables/useActivities'
import type { RecipientOverride } from '@/composables/useRecipientOverrides'
import AiReviewList from './AiReviewList.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

function activity(overrides: Partial<ActivityListItem> = {}): ActivityListItem {
  return {
    uuid: 'A1',
    title: 'Ensayo general',
    scheduled_at: '2026-12-01T10:00:00Z',
    end_at: null,
    timezone: 'Europe/Madrid',
    local_start_time: null,
    status: 'scheduled',
    priority: 'normal',
    all_day: false,
    location_name: '',
    destination_name: '',
    activity_type_name: 'Ensayo',
    activity_type_code: 'rehearsal',
    activity_type_icon: '',
    activity_type_color: '',
    category: 'production',
    ai_review: { status: 'pending', type_code: 'rehearsal', source: 'calendar', at: '2026-11-21T10:00:00Z' },
    ...overrides,
  }
}

function suggestion(overrides: Partial<RecipientOverride> = {}): RecipientOverride {
  return {
    uuid: 'S1',
    activity: {
      uuid: 'A1',
      title: 'Ensayo general',
      scheduled_at: '2026-12-01T10:00:00Z',
      activity_type_code: 'rehearsal',
    },
    action: 'add',
    group: group({ uuid: 'g-band', name: 'Banda', system_key: 'band', is_default: false }),
    contact: null,
    status: 'suggested',
    source: 'ai',
    reason: 'Es un ensayo de la banda',
    created_at: '2026-11-21T10:00:00Z',
    ...overrides,
  }
}

const TYPES = [
  { uuid: 'type-reh', code: 'rehearsal', name: 'Ensayo', category: 'production', icon: '', color: '', has_destination: false, has_duration: true, is_system: true },
  { uuid: 'type-snd', code: 'soundcheck', name: 'Prueba de sonido', category: 'production', icon: '', color: '', has_destination: false, has_duration: true, is_system: true },
]

interface State {
  activities: ActivityListItem[]
  suggestions: RecipientOverride[]
}

function handler(
  state: State,
  actions: Record<string, (body: Record<string, unknown>) => Response> = {}
): Handler {
  return (url, init) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    for (const [suffix, fn] of Object.entries(actions)) {
      if (url.pathname.endsWith(suffix) && method !== 'GET') return fn(body)
    }
    if (url.pathname.endsWith('/events/activity-types/')) return jsonResponse(TYPES)
    if (url.pathname.endsWith('/events/activities/') && method === 'GET') {
      return jsonResponse({ count: state.activities.length, next: null, previous: null, results: state.activities })
    }
    if (url.pathname.endsWith('/recipient-overrides/') && method === 'GET') {
      return jsonResponse({ count: state.suggestions.length, next: null, previous: null, results: state.suggestions })
    }
    return jsonResponse({}, 404)
  }
}

async function mountList() {
  const w = mount(AiReviewList, { props: { tourUuid: 'T1' }, global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

function writes(fn: ReturnType<typeof stubFetch>) {
  return fn.mock.calls
    .filter(([, init]) => (init?.method ?? 'GET') !== 'GET')
    .map(([u, init]) => ({
      method: init!.method,
      path: new URL(String(u)).pathname.replace(/^.*\/api/, ''),
      body: init!.body ? JSON.parse(String(init!.body)) : undefined,
    }))
}

describe('AiReviewList', () => {
  it('pide pendientes y sugeridas de la gira y pinta una tarjeta por actividad', async () => {
    const fn = stubFetch(
      handler({
        activities: [activity()],
        suggestions: [
          suggestion(),
          suggestion({
            uuid: 'S2',
            activity: { uuid: 'A2', title: 'Rueda de prensa', scheduled_at: '2026-12-02T10:00:00Z', activity_type_code: 'press_conference' },
            group: group({ uuid: 'g-prod', name: 'Producción', system_key: 'production', is_default: false }),
            reason: '',
          }),
        ],
      })
    )
    const w = await mountList()
    const urls = fn.mock.calls.map(([u]) => new URL(String(u)))
    const acts = urls.find((u) => u.pathname.endsWith('/events/activities/'))!
    expect(acts.searchParams.get('tour')).toBe('T1')
    expect(acts.searchParams.get('ai_review')).toBe('pending')
    const sugg = urls.find((u) => u.pathname.endsWith('/recipient-overrides/'))!
    expect(sugg.searchParams.get('tour')).toBe('T1')
    expect(sugg.searchParams.get('status')).toBe('suggested')

    expect(w.text()).toContain('Por revisar (2)')
    const a1 = w.get('[data-test="ai-card-A1"]')
    expect((a1.get('[data-test="ai-card-type"]').element as HTMLSelectElement).value).toBe('rehearsal')
    expect(a1.get('[data-test="ai-suggestion"]').text()).toContain('Banda')
    expect(a1.get('[data-test="ai-suggestion-reason"]').text()).toBe('Es un ensayo de la banda')
    // Solo sugerencias (sin tipo por revisar): sin selector
    const a2 = w.get('[data-test="ai-card-A2"]')
    expect(a2.find('[data-test="ai-card-type"]').exists()).toBe(false)
    expect(a2.find('[data-test="ai-card-confirm"]').exists()).toBe(true)
  })

  it('"Confirmar" sin cambiar el tipo llama a confirm-ai-review, recarga y avisa', async () => {
    const state: State = { activities: [activity()], suggestions: [] }
    const fn = stubFetch(
      handler(state, {
        '/confirm-ai-review/': () => {
          state.activities = []
          return jsonResponse({})
        },
      })
    )
    const w = await mountList()
    await w.get('[data-test="ai-card-confirm"]').trigger('click')
    await flushPromises()
    expect(writes(fn)).toEqual([{ method: 'POST', path: '/events/activities/A1/confirm-ai-review/', body: {} }])
    expect(w.emitted('changed')).toHaveLength(1)
    // Sin nada pendiente, la sección desaparece
    expect(w.find('[data-test="ai-review"]').exists()).toBe(false)
  })

  it('sin nada pendiente no pinta la sección (ni esqueleto)', async () => {
    let resolve!: () => void
    const gate = new Promise<void>((r) => (resolve = r))
    stubFetch(async (url, init) => {
      await gate
      return handler({ activities: [], suggestions: [] })(url, init)
    })
    const w = mount(AiReviewList, { props: { tourUuid: 'T1' }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('[data-test="ai-review"]').exists()).toBe(false)
    resolve()
    await flushPromises()
    expect(w.find('[data-test="ai-review"]').exists()).toBe(false)
  })

  it('fechas en la zona de la actividad (y de la sugerencia si la trae)', async () => {
    stubFetch(
      handler({
        activities: [activity({ timezone: 'America/Mexico_City' })],
        suggestions: [
          suggestion({
            uuid: 'S9',
            activity: {
              uuid: 'A9',
              title: 'Rueda',
              scheduled_at: '2026-12-05T10:00:00Z',
              activity_type_code: 'press_conference',
              timezone: 'Asia/Tokyo',
            },
          }),
        ],
      })
    )
    const w = await mountList()
    expect(w.get('[data-test="ai-card-A1"]').text()).toContain('1 dic 2026 · 04:00 (GMT-6)')
    expect(w.get('[data-test="ai-card-A9"]').text()).toContain('5 dic 2026 · 19:00 (GMT+9)')
  })

  it('"Confirmar" de una tarjeta acepta también sus sugerencias por uuid', async () => {
    const state: State = { activities: [activity()], suggestions: [suggestion()] }
    const fn = stubFetch(
      handler(state, {
        '/S1/accept/': () => jsonResponse(suggestion({ status: 'active' })),
        '/confirm-ai-review/': () => {
          state.activities = []
          state.suggestions = []
          return jsonResponse({})
        },
      })
    )
    const w = await mountList()
    await w.get('[data-test="ai-card-confirm"]').trigger('click')
    await flushPromises()
    expect(writes(fn).map((x) => x.path)).toEqual([
      '/notifications/recipient-overrides/S1/accept/',
      '/events/activities/A1/confirm-ai-review/',
    ])
  })

  it('cambiar el tipo y confirmar envía solo el tipo nuevo por PATCH', async () => {
    const fn = stubFetch(handler({ activities: [activity()], suggestions: [] }, { '/activities/A1/': () => jsonResponse({}) }))
    const w = await mountList()
    await w.get('[data-test="ai-card-type"]').setValue('soundcheck')
    await w.get('[data-test="ai-card-confirm"]').trigger('click')
    await flushPromises()
    expect(writes(fn)).toEqual([
      { method: 'PATCH', path: '/events/activities/A1/', body: { activity_type_id: 'type-snd' } },
    ])
  })

  it('aceptar y rechazar una sugerencia', async () => {
    const state: State = { activities: [], suggestions: [suggestion(), suggestion({ uuid: 'S2', group: group({ uuid: 'g-tech', name: 'Técnicos', is_default: false }) })] }
    const fn = stubFetch(
      handler(state, {
        '/S1/accept/': () => {
          state.suggestions = state.suggestions.filter((s) => s.uuid !== 'S1')
          return jsonResponse(suggestion({ status: 'active' }))
        },
        '/S2/reject/': () => {
          state.suggestions = []
          return jsonResponse(suggestion({ uuid: 'S2', status: 'rejected' }))
        },
      })
    )
    const w = await mountList()
    await w.findAll('[data-test="ai-suggestion-accept"]')[0].trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test="ai-suggestion"]')).toHaveLength(1)
    await w.get('[data-test="ai-suggestion-reject"]').trigger('click')
    await flushPromises()
    expect(writes(fn).map((x) => x.path)).toEqual([
      '/notifications/recipient-overrides/S1/accept/',
      '/notifications/recipient-overrides/S2/reject/',
    ])
    expect(w.emitted('changed')).toHaveLength(2)
  })

  it('409 not_suggested: texto propio (nunca el código) y recarga el estado real', async () => {
    const fn = stubFetch(
      handler({ activities: [], suggestions: [suggestion()] }, {
        '/accept/': () => wrappedError(409, 'not_suggested', 'status', 'not_suggested'),
      })
    )
    const w = await mountList()
    const gets = () => fn.mock.calls.filter(([, i]) => (i?.method ?? 'GET') === 'GET').length
    const before = gets()
    await w.get('[data-test="ai-suggestion-accept"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="ai-card-error"]').text()).toBe('Esta sugerencia ya se ha revisado.')
    expect(w.text()).not.toContain('not_suggested')
    expect(gets()).toBeGreaterThan(before)
  })

  it('409 no_pending_review al confirmar: texto propio', async () => {
    stubFetch(
      handler({ activities: [activity()], suggestions: [] }, {
        '/confirm-ai-review/': () => wrappedError(409, 'no_pending_review', 'ai_review', 'no_pending_review'),
      })
    )
    const w = await mountList()
    await w.get('[data-test="ai-card-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="ai-card-error"]').text()).toBe(
      'Esta actividad no tiene revisión pendiente.'
    )
  })

  it('429 al aceptar: mensaje de demasiadas solicitudes', async () => {
    stubFetch(handler({ activities: [], suggestions: [suggestion()] }, { '/accept/': () => jsonResponse({}, 429) }))
    const w = await mountList()
    await w.get('[data-test="ai-suggestion-accept"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="ai-card-error"]').text()).toContain('Has hecho demasiadas solicitudes')
  })

  it('"Confirmar todo" pide confirmación, acepta por uuid las visibles y confirma cada tipo', async () => {
    const state: State = {
      activities: [activity(), activity({ uuid: 'A3', title: 'Prueba', scheduled_at: '2026-12-03T10:00:00Z' })],
      suggestions: [suggestion()],
    }
    const fn = stubFetch(
      handler(state, {
        '/S1/accept/': () => wrappedError(409, 'not_suggested', 'status', 'not_suggested'),
        '/confirm-ai-review/': () => jsonResponse({}),
        '/activities/A3/': () => jsonResponse({}),
      })
    )
    const w = await mountList()
    await w.get('[data-test="ai-card-A3"] [data-test="ai-card-type"]').setValue('soundcheck')
    await w.get('[data-test="ai-review-confirm-all"]').trigger('click')
    expect(writes(fn)).toEqual([])
    expect(w.get('[data-test="ai-review-confirm-all-prompt"]').text()).toContain(
      'Se aceptarán los grupos sugeridos (1) y se confirmarán los tipos de actividad (2)'
    )
    await w.get('[data-test="ai-review-confirm-all-go"]').trigger('click')
    await flushPromises()
    expect(writes(fn)).toEqual([
      { method: 'POST', path: '/notifications/recipient-overrides/S1/accept/', body: {} },
      { method: 'POST', path: '/events/activities/A1/confirm-ai-review/', body: {} },
      { method: 'PATCH', path: '/events/activities/A3/', body: { activity_type_id: 'type-snd' } },
    ])
    // Nunca `accept-all` de la gira; el 409 de una ya revisada no cuenta como fallo
    expect(w.find('[data-test="ai-review-bulk-error"]').exists()).toBe(false)
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('error de carga con reintentar', async () => {
    let n = 0
    stubFetch((url, init) => {
      if (++n <= 2) return jsonResponse({}, 500)
      return handler({ activities: [], suggestions: [] })(url, init)
    })
    const w = await mountList()
    expect(w.get('[data-test="ai-review-error"]').text()).toContain(
      'No se ha podido cargar lo que hay por revisar.'
    )
    await w.get('[data-test="ai-review-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="ai-review"]').exists()).toBe(false)
  })

  it('el selector usa los tipos de la gira y traduce activity_type_invalid', async () => {
    const fn = stubFetch(
      handler({ activities: [activity()], suggestions: [] }, {
        '/activities/A1/': () => wrappedError(400, 'activity_type_invalid', 'activity_type_id', 'activity_type_invalid'),
      })
    )
    const w = await mountList()
    const typesUrl = fn.mock.calls
      .map(([u]) => new URL(String(u)))
      .find((u) => u.pathname.endsWith('/events/activity-types/'))!
    expect(typesUrl.searchParams.get('tour')).toBe('T1')
    await w.get('[data-test="ai-card-type"]').setValue('soundcheck')
    await w.get('[data-test="ai-card-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="ai-card-error"]').text()).toBe(
      'Ese tipo de actividad no está disponible en esta gira. Elige otro.'
    )
  })
})
