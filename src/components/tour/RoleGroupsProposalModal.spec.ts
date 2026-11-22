import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { group, stubFetch, wrappedError, type Handler } from '@/test/reminders'
import type { RoleGroupsProposal } from '@/composables/useRoleGroups'
import RoleGroupsProposalModal from './RoleGroupsProposalModal.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

function proposal(overrides: Partial<RoleGroupsProposal> = {}): RoleGroupsProposal {
  return {
    ai_used: true,
    buckets: [
      {
        key: 'band',
        name: 'Banda',
        existing_group: null,
        contacts: [
          { uuid: 'c-band', name: 'Marta', role_text: 'Banda', selected: true, source: 'role', confidence: null },
          { uuid: 'c-artist', name: 'Rosalía', role_text: 'Artista', selected: false, source: 'role', confidence: null },
        ],
      },
      {
        key: 'technicians',
        name: 'Técnicos',
        existing_group: group({ uuid: 'g-tech', name: 'Técnicos', system_key: 'technicians', is_default: false }),
        contacts: [
          { uuid: 'c-sound', name: 'Pau', role_text: 'Técnico de sonido', selected: true, source: 'role', confidence: null },
          { uuid: 'c-backline', name: 'Iker', role_text: 'Backline', selected: true, source: 'ai', confidence: 0.8 },
        ],
      },
      { key: 'drivers', name: 'Conductores', existing_group: null, contacts: [] },
      { key: 'production', name: 'Producción', existing_group: null, contacts: [] },
    ],
    unassigned: [{ uuid: 'c-x', name: 'Javi', role_text: 'Chófer de furgo' }],
    type_destinations: [
      { activity_type_code: 'soundcheck', buckets: ['band', 'technicians'], include_team: false },
      { activity_type_code: 'rehearsal', buckets: ['band', 'technicians'], include_team: false },
      { activity_type_code: 'load_in', buckets: ['technicians', 'production'], include_team: false },
      { activity_type_code: 'security_meeting', buckets: ['production'], include_team: false },
      { activity_type_code: 'transport', buckets: ['drivers'], include_team: true },
    ],
    ...overrides,
  }
}

const applyResult = { groups: [group({ uuid: 'g-band', name: 'Banda' })], reminder_settings_updated: 3 }

function handler(
  data: RoleGroupsProposal = proposal(),
  onApply: (body: Record<string, unknown>) => Response = () => jsonResponse(applyResult)
): Handler {
  return (url, init) => {
    if (url.pathname.endsWith('/role-groups/propose/')) return jsonResponse(data)
    if (url.pathname.endsWith('/role-groups/apply/')) return onApply(JSON.parse(String(init!.body)))
    return jsonResponse({}, 404)
  }
}

async function mountModal() {
  const w = mount(RoleGroupsProposalModal, {
    props: {
      show: true,
      tourUuid: 'T1',
      typeNames: { soundcheck: 'Prueba de sonido', rehearsal: 'Ensayo', load_in: 'Carga' },
    },
    global: { plugins: [i18n] },
  })
  await flushPromises()
  return w
}

function applyBodies(fn: ReturnType<typeof stubFetch>) {
  return fn.mock.calls
    .filter(([u]) => String(u).endsWith('/role-groups/apply/'))
    .map(([, init]) => JSON.parse(String(init!.body)))
}

describe('RoleGroupsProposalModal', () => {
  it('enseña el estado de carga mientras la IA revisa el equipo', async () => {
    let resolve!: (r: Response) => void
    stubFetch(() => new Promise<Response>((r) => (resolve = r)))
    const w = mount(RoleGroupsProposalModal, {
      props: { show: true, tourUuid: 'T1' },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    expect(w.get('[data-test="role-groups-loading"]').text()).toBe('La IA está revisando tu equipo…')
    resolve(jsonResponse(proposal()))
    await flushPromises()
    expect(w.find('[data-test="role-groups-loading"]').exists()).toBe(false)
  })

  it('pide la propuesta de la gira y pinta grupos, orígenes y "Sin asignar"', async () => {
    const fn = stubFetch(handler())
    const w = await mountModal()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(String(fn.mock.calls[0][0])).toMatch(/\/notifications\/role-groups\/propose\/$/)
    expect(JSON.parse(String(fn.mock.calls[0][1]!.body))).toEqual({ tour: 'T1' })

    const band = w.get('[data-test="bucket-band"]')
    expect((band.get('[data-test="bucket-name"]').element as HTMLInputElement).value).toBe('Banda')
    // `artist` llega sin marcar (D15.2)
    expect((band.get('[data-test="contact-band-c-band"]').element as HTMLInputElement).checked).toBe(true)
    expect((band.get('[data-test="contact-band-c-artist"]').element as HTMLInputElement).checked).toBe(false)
    const tech = w.get('[data-test="bucket-technicians"]')
    expect(tech.findAll('[data-test="contact-source"]').map((x) => x.text())).toEqual([
      'Por rol',
      'Propuesto por la IA',
    ])
    expect(tech.find('[data-test="bucket-existing"]').exists()).toBe(true)
    expect(w.get('[data-test="unassigned"]').text()).toContain('Javi')
  })

  it('aplica solo lo necesario: nombre solo si cambia, sin grupos nuevos vacíos ni destinos', async () => {
    const fn = stubFetch(handler())
    const w = await mountModal()
    await w.get('[data-test="bucket-technicians"] [data-test="bucket-name"]').setValue('Técnicos FOH')
    await w.get('[data-test="contact-technicians-c-backline"]').setValue(false)
    await w.get('[data-test="unassigned-c-x"]').setValue('drivers')
    await w.get('[data-test="role-groups-create"]').trigger('click')
    await flushPromises()

    expect(applyBodies(fn)).toEqual([
      {
        tour: 'T1',
        groups: [
          { key: 'band', contact_uuids: ['c-band'] },
          { key: 'technicians', name: 'Técnicos FOH', contact_uuids: ['c-sound'] },
          { key: 'drivers', contact_uuids: ['c-x'] },
        ],
        apply_type_destinations: false,
      },
    ])
    const emitted = w.emitted('applied')!
    expect(emitted[0]).toEqual([applyResult, false])
  })

  it('con la casilla marcada envía los destinos por tipo de los grupos que se crean', async () => {
    const fn = stubFetch(handler())
    const w = await mountModal()
    // Resumen de D15.1 con los grupos que van a existir (sin Producción ni Conductores)
    const rows = w.findAll('[data-test="destination-row"]').map((r) => r.text())
    expect(rows).toEqual(['Prueba de sonido, Ensayo → Banda, Técnicos', 'Carga → Técnicos'])

    await w.get('[data-test="apply-destinations"]').setValue(true)
    await w.get('[data-test="role-groups-create"]').trigger('click')
    await flushPromises()
    const body = applyBodies(fn)[0]
    expect(body.apply_type_destinations).toBe(true)
    // El backend aplica D15.1 con los grupos vivos tras crearlos: no se envía la tabla.
    expect(body).not.toHaveProperty('type_destinations')
    expect(w.emitted('applied')![0][1]).toBe(true)
  })

  it('un grupo que solo se llena desde "Sin asignar" entra en el resumen de destinos', async () => {
    // La propuesta del backend no trae `transport` porque Conductores no tenía a nadie.
    stubFetch(handler(proposal({ type_destinations: [] })))
    const w = mount(RoleGroupsProposalModal, {
      props: { show: true, tourUuid: 'T1', typeNames: { transport: 'Transporte', soundcheck: 'Prueba de sonido' } },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    const rows = () => w.findAll('[data-test="destination-row"]').map((r) => r.text())
    expect(rows()).toEqual(['Prueba de sonido → Banda, Técnicos'])
    await w.get('[data-test="unassigned-c-x"]').setValue('drivers')
    expect(rows()).toEqual([
      'Prueba de sonido → Banda, Técnicos',
      'Transporte → Equipo de la gira, Conductores',
    ])
  })

  it.each([
    ['contact_not_assignable', 'No puedes añadir ese contacto a esta gira.'],
    ['bucket_unknown', 'Ese grupo por rol no existe.'],
    ['name_too_long', 'El nombre es demasiado largo.'],
  ])('error %s al aplicar: texto propio y borrador intacto para reintentar', async (code, text) => {
    let attempts = 0
    const fn = stubFetch(
      handler(proposal(), () => (++attempts === 1 ? wrappedError(400, code, 'groups', code) : jsonResponse(applyResult)))
    )
    const w = await mountModal()
    await w.get('[data-test="bucket-band"] [data-test="bucket-name"]').setValue('Banda de Marta')
    await w.get('[data-test="role-groups-create"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-test="role-groups-apply-error"]').text()).toBe(text)
    expect(w.text()).not.toContain(code)
    expect(w.emitted('applied')).toBeUndefined()
    expect(
      (w.get('[data-test="bucket-band"] [data-test="bucket-name"]').element as HTMLInputElement).value
    ).toBe('Banda de Marta')

    await w.get('[data-test="role-groups-create"]').trigger('click')
    await flushPromises()
    const bodies = applyBodies(fn)
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toEqual(bodies[0])
    expect(w.emitted('applied')).toHaveLength(1)
    // La propuesta no se vuelve a pedir
    expect(fn.mock.calls.filter(([u]) => String(u).endsWith('/propose/'))).toHaveLength(1)
  })

  it('sin equipo enseña el vacío y no ofrece crear', async () => {
    stubFetch(
      handler(
        proposal({
          buckets: proposal().buckets.map((b) => ({ ...b, contacts: [] })),
          unassigned: [],
        })
      )
    )
    const w = await mountModal()
    expect(w.get('[data-test="role-groups-empty"]').text()).toBe(
      'La gira aún no tiene equipo: añade contactos al Equipo de la gira.'
    )
    expect(w.find('[data-test="role-groups-create"]').exists()).toBe(false)
  })

  it('429 al proponer: mensaje propio y reintentar', async () => {
    let n = 0
    stubFetch((url) => {
      if (url.pathname.endsWith('/propose/')) return ++n === 1 ? jsonResponse({}, 429) : jsonResponse(proposal())
      return jsonResponse({}, 404)
    })
    const w = await mountModal()
    expect(w.get('[data-test="role-groups-error"]').text()).toContain(
      'Has hecho demasiadas solicitudes'
    )
    await w.get('[data-test="role-groups-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="bucket-band"]').exists()).toBe(true)
  })

  it('403 al proponer avisa al padre', async () => {
    stubFetch(() => jsonResponse({}, 403))
    const w = await mountModal()
    expect(w.emitted('forbidden')).toHaveLength(1)
  })

  it('sin IA avisa de los roles sin asignar', async () => {
    stubFetch(handler(proposal({ ai_used: false })))
    const w = await mountModal()
    expect(w.find('[data-test="role-groups-no-ai"]').exists()).toBe(true)
  })

  it('cerrar con cambios pide confirmación; sin cambios cierra directamente', async () => {
    stubFetch(handler())
    const w = await mountModal()
    await w.get('[data-test="role-groups-cancel"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)

    await w.get('[data-test="contact-band-c-artist"]').setValue(true)
    await w.get('[data-test="role-groups-cancel"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.find('[data-test="role-groups-discard"]').exists()).toBe(true)
    await w.get('[data-test="role-groups-discard-confirm"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
  })
})
