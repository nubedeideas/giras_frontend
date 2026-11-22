import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import {
  catalog,
  group,
  stubFetch,
  stubMatchMedia,
  typeSetting,
  wrappedError,
  type Handler,
} from '@/test/reminders'
import { useToursStore } from '@/stores/tours'
import TourRemindersPanel from './TourRemindersPanel.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

/** GET del catálogo con `data` y POST con `onPost`. */
function handler(
  data = catalog(),
  onPost: (body: Record<string, unknown>) => Response = (body) =>
    jsonResponse(typeSetting({ tour_steps: body.steps as never }))
): Handler {
  return (url, init) => {
    if (url.pathname.endsWith('/reminder-settings/') && init?.method === 'POST') {
      return onPost(JSON.parse(String(init.body)))
    }
    if (url.pathname.endsWith('/reminder-settings/')) return jsonResponse(data)
    return jsonResponse({}, 404)
  }
}

async function mountPanel() {
  const w = mount(TourRemindersPanel, {
    props: { tourUuid: 'T1' },
    global: { plugins: [i18n], stubs: { ManageGroupContactsModal: true } },
  })
  await flushPromises()
  return w
}

function posts(fn: ReturnType<typeof stubFetch>) {
  return fn.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init!.body)))
}

describe('TourRemindersPanel', () => {
  it('pide el catálogo con estimación y pinta resumen y cupo', async () => {
    const fn = stubFetch(handler())
    const w = await mountPanel()
    const url = new URL(String(fn.mock.calls[0][0]))
    expect(url.searchParams.get('tour')).toBe('T1')
    expect(url.searchParams.get('estimate')).toBe('1')
    expect(w.get('[data-test="estimate-body"]').text()).toBe(
      'Con la agenda actual se enviarán unos 840 WhatsApp, 240 emails y 18 avisos en la app (≈ 21,00 USD).'
    )
    expect(w.get('[data-test="quota-text"]').text()).toBe('WhatsApp del plan: 100 de 500')
    // 840 > 400 restantes
    expect(w.get('[data-test="estimate-over-quota"]').text()).toContain(
      'Superas el cupo de WhatsApp del plan'
    )
    expect(w.get('[data-test="type-summary"]').text()).toBe(
      '24 h por email · 3 h por WhatsApp · 1 h en la app'
    )
    expect(w.get('[data-test="type-source"]').text()).toBe('De tu plantilla')
    expect(w.get('[data-test="type-groups-empty"]').text()).toBe('Equipo de la gira')
  })

  it('sin sobrecupo, barra ámbar al 80 % y roja al 100 %', async () => {
    const plan80 = { limit: 500, used: 400, remaining: 100, percentage: 80, is_unlimited: false }
    stubFetch(handler(catalog({ plan: plan80, estimate: { ...catalog().estimate!, whatsapp: 50 } })))
    const w = await mountPanel()
    expect(w.find('[data-test="estimate-over-quota"]').exists()).toBe(false)
    expect(w.get('[data-test="quota-bar"]').classes()).toContain('bg-amber-400')

    const plan100 = { limit: 500, used: 500, remaining: 0, percentage: 100, is_unlimited: false }
    stubFetch(handler(catalog({ plan: plan100 })))
    const w2 = await mountPanel()
    expect(w2.get('[data-test="quota-bar"]').classes()).toContain('bg-red-400')
  })

  it('traduce los avisos de audiencia del backend', async () => {
    stubFetch(
      handler(
        catalog({
          types: [
            typeSetting({ warnings: ['in_app_users_only'] }),
            typeSetting({
              activity_type_code: 'soundcheck',
              name: 'Prueba de sonido',
              warnings: ['type_groups_empty', 'no_base_groups'],
            }),
          ],
        })
      )
    )
    const w = await mountPanel()
    const texts = w.findAll('[data-test="type-warning"]').map((x) => x.text())
    expect(texts).toEqual([
      '⚠ El aviso en la app solo llega a quienes tienen cuenta en Giras y son miembros de la gira.',
      '⚠ Los grupos de este tipo no tienen contactos: se avisa a los administradores.',
      '⚠ La gira no tiene Equipo de la gira: se avisa a los administradores.',
    ])
  })

  it('grupos que el coadmin no ve: chip de solo lectura y guarda pasos sin group_uuids', async () => {
    const foreign = group({ uuid: 'g-foreign', name: 'Global de otro', is_default: false })
    const fn = stubFetch(
      handler(catalog({ types: [typeSetting({ groups: [foreign] })] }), (body) =>
        jsonResponse(typeSetting({ groups: [foreign], tour_steps: body.steps as never }))
      )
    )
    const w = await mountPanel()
    await w.get('[data-test="type-configure"]').trigger('click')
    expect(w.get('[data-test="type-group-readonly-g-foreign"]').text()).toContain('Global de otro')
    await w.get('[data-test="type-customize"]').trigger('click')
    await w.findAll('[data-test="step-remove"]')[0].trigger('click')
    await w.get('[data-test="type-save"]').trigger('click')
    await flushPromises()
    expect(posts(fn)[0]).not.toHaveProperty('group_uuids')

    // Si cambian los grupos, se mandan conservando el que no ve.
    await w.get('[data-test="type-configure"]').trigger('click')
    await w.get('[data-test="type-group-g-tech"]').trigger('click')
    await w.get('[data-test="type-save"]').trigger('click')
    await flushPromises()
    expect(posts(fn)[1].group_uuids).toEqual(['g-foreign', 'g-tech'])
  })

  it('sin suscripción (plan null) no pinta cupo ni sobrecupo', async () => {
    stubFetch(handler(catalog({ plan: null })))
    const w = await mountPanel()
    expect(w.find('[data-test="estimate-body"]').exists()).toBe(true)
    expect(w.find('[data-test="quota-bar"]').exists()).toBe(false)
    expect(w.find('[data-test="quota-text"]').exists()).toBe(false)
    expect(w.find('[data-test="estimate-over-quota"]').exists()).toBe(false)
  })

  it('equipo vacío avisa', async () => {
    stubFetch(handler(catalog({ default_group: group({ contact_count: 0 }) })))
    const w = await mountPanel()
    expect(w.get('[data-test="team-empty"]').text()).toContain('El Equipo de la gira está vacío')
    expect(w.get('[data-test="team-count"]').text()).toContain('0 contactos')
  })

  it('personalizar guarda los pasos de la gira y los grupos', async () => {
    const fn = stubFetch(handler())
    const w = await mountPanel()
    await w.get('[data-test="type-configure"]').trigger('click')
    await w.get('[data-test="type-customize"]').trigger('click')
    await w.findAll('[data-test="step-remove"]')[2].trigger('click')
    await w.get('[data-test="type-group-g-tech"]').trigger('click')
    await w.get('[data-test="type-save"]').trigger('click')
    await flushPromises()
    expect(posts(fn)[0]).toEqual({
      tour: 'T1',
      activity_type_code: 'flight',
      steps: [
        { minutes: 1440, channel: 'email' },
        { minutes: 180, channel: 'whatsapp' },
      ],
      group_uuids: ['g-tech'],
    })
  })

  it('sin recordatorios en esta gira manda steps: []', async () => {
    const fn = stubFetch(
      handler(catalog(), () =>
        jsonResponse(typeSetting({ tour_steps: [], effective_steps: [], steps_source: 'tour' }))
      )
    )
    const w = await mountPanel()
    await w.get('[data-test="type-configure"]').trigger('click')
    await w.get('[data-test="type-customize"]').trigger('click')
    await w.get('[data-test="type-no-reminders"]').setValue(true)
    await w.get('[data-test="type-save"]').trigger('click')
    await flushPromises()
    // Sin cambios de grupos no se manda `group_uuids`.
    expect(posts(fn)[0]).toEqual({ tour: 'T1', activity_type_code: 'flight', steps: [] })
    expect(w.get('[data-test="type-source"]').text()).toBe('Sin recordatorios en esta gira')
    expect(w.get('[data-test="type-summary"]').text()).toBe('Sin recordatorios')
  })

  it('apagar el interruptor hereda (steps: null) y revierte si falla', async () => {
    const custom = typeSetting({
      tour_steps: [{ minutes: 120, channel: 'whatsapp' }],
      effective_steps: [{ minutes: 120, channel: 'whatsapp' }],
      steps_source: 'tour',
    })
    let fail = true
    const fn = stubFetch(
      handler(catalog({ types: [custom] }), () =>
        fail ? jsonResponse({}, 500) : jsonResponse(typeSetting())
      )
    )
    const w = await mountPanel()
    expect(w.get('[data-test="type-source"]').text()).toBe('Personalizado en esta gira')
    await w.get('[data-test="type-configure"]').trigger('click')
    const sw = w.get('[data-test="type-customize"]')
    expect(sw.attributes('aria-checked')).toBe('true')
    await sw.trigger('click')
    await flushPromises()
    expect(posts(fn)[0]).toEqual({ tour: 'T1', activity_type_code: 'flight', steps: null })
    expect(w.get('[data-test="type-customize"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-test="type-editor-error"]').text()).toBe(
      'No se ha podido cambiar. Se ha restaurado el valor anterior.'
    )

    fail = false
    await w.get('[data-test="type-customize"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="type-source"]').text()).toBe('De tu plantilla')
  })

  it('error de validación del backend por código', async () => {
    stubFetch(handler(catalog(), () => wrappedError(400, 'group_other_tour', 'group_uuids')))
    const w = await mountPanel()
    await w.get('[data-test="type-configure"]').trigger('click')
    await w.get('[data-test="type-group-g-tech"]').trigger('click')
    await w.get('[data-test="type-save"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="type-editor-error"]').text()).toBe('Ese grupo es de otra gira.')
  })

  it('403 enseña no admin y recarga las giras', async () => {
    stubFetch((url) => {
      if (url.pathname.endsWith('/reminder-settings/')) return jsonResponse({}, 403)
      return jsonResponse({ count: 0, next: null, previous: null, results: [] })
    })
    const loadTours = vi.spyOn(useToursStore(), 'loadTours')
    const w = await mountPanel()
    expect(w.get('[data-test="reminders-not-admin"]').text()).toBe(
      'Solo los administradores de la gira pueden configurar sus recordatorios.'
    )
    expect(loadTours).toHaveBeenCalled()
  })

  it('error de carga con reintentar', async () => {
    let ok = false
    stubFetch(() => (ok ? jsonResponse(catalog()) : jsonResponse({}, 500)))
    const w = await mountPanel()
    expect(w.find('[data-test="reminders-error"]').exists()).toBe(true)
    ok = true
    await w.get('[data-test="reminders-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="reminder-estimate"]').exists()).toBe(true)
  })

  it('grupos por rol: abre la propuesta y, al aplicar, recarga catálogo y revisión', async () => {
    let applied = false
    const proposal = {
      ai_used: true,
      buckets: [
        {
          key: 'band',
          name: 'Banda',
          existing_group: null,
          contacts: [
            { uuid: 'c1', name: 'Marta', role_text: 'Banda', selected: true, source: 'role', confidence: null },
          ],
        },
      ],
      unassigned: [],
      type_destinations: [],
    }
    const band = group({ uuid: 'g-band', name: 'Banda', system_key: 'band', is_default: false })
    const fn = stubFetch((url, init) => {
      const method = init?.method ?? 'GET'
      if (url.pathname.endsWith('/role-groups/propose/')) return jsonResponse(proposal)
      if (url.pathname.endsWith('/role-groups/apply/')) {
        applied = true
        return jsonResponse({ groups: [band], reminder_settings_updated: 0, warnings: ['tour_team_recreated', 'otro_codigo'] })
      }
      if (url.pathname.endsWith('/reminder-settings/') && method === 'GET') {
        return jsonResponse(
          applied
            ? catalog({ types: [typeSetting({ groups: [band], base_source: 'type_groups' })] })
            : catalog()
        )
      }
      if (method === 'GET') return jsonResponse({ count: 0, next: null, previous: null, results: [] })
      return jsonResponse({}, 404)
    })
    const w = await mountPanel()
    expect(w.find('[data-test="ai-review"]').exists()).toBe(false)
    await w.get('[data-test="role-groups-open"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="role-groups-create"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="role-groups-modal"]').exists()).toBe(false)
    expect(w.get('[data-test="role-groups-applied"]').text()).toBe('Grupo guardado.')
    const warnings = w.findAll('[data-test="role-groups-warning"]').map((x) => x.text())
    expect(warnings).toEqual([
      'Se ha vuelto a crear el «Equipo de la gira», que se había borrado. Revisa quién está dentro.',
    ])
    const gets = fn.mock.calls
      .filter(([, i]) => (i?.method ?? 'GET') === 'GET')
      .map(([u]) => new URL(String(u)).pathname)
    expect(gets.filter((p) => p.endsWith('/reminder-settings/'))).toHaveLength(2)
    expect(gets.filter((p) => p.endsWith('/recipient-overrides/'))).toHaveLength(2)
    expect(w.text()).toContain('Banda')
  })
})
