import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { notificationsPreview } from '@/test/importJobs'
import type { ImportNotificationsPreview as Preview } from '@/composables/useImportJobs'
import ImportNotificationsPreview from './ImportNotificationsPreview.vue'

const PATH = '/api/integrations/import-jobs/J1/preview-notifications/'

type Call = { url: string; body: Record<string, unknown> }

/** `fetch` que responde con lo que devuelva `answer` para cada llamada (en orden). */
function setupFetch(answer: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const call = { url: new URL(String(input)).pathname, body: JSON.parse(String(init?.body ?? '{}')) }
    calls.push(call)
    return answer(call, calls.length - 1)
  })
  vi.stubGlobal('fetch', fn)
  return calls
}

function mountPreview(props: Record<string, unknown> = {}) {
  return mount(ImportNotificationsPreview, {
    props: { jobUuid: 'J1', timezone: 'Europe/Madrid', ...props },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
  })
}

const full = (o: Partial<Preview> = {}) =>
  notificationsPreview({
    recipients: {
      group: { uuid: 'G1', name: 'Equipo de la gira', is_tour_team: true, is_default: true },
      people: 9,
      people_from_import: 3,
      with_mobile: 8,
      with_email: 7,
      with_account: 2,
      without_phone: ['Marta Ruiz'],
      type_groups: [{ code: 'flight', group_names: ['Banda'] }],
    },
    reminders_by_type: [
      {
        code: 'flight',
        name: 'Vuelo',
        activities: 6,
        steps: [
          { minutes: 1440, channel: 'email', sends_as: 'email' },
          { minutes: 180, channel: 'whatsapp', sends_as: 'email' },
        ],
        messages: { whatsapp: 0, email: 96, in_app: 0 },
      },
    ],
    rules: [
      { uuid: 'R1', name: 'Nueva actividad (admins)', trigger: 'activity_created', channel: 'in_app', effect: 'skipped_on_import', count: 6 },
      { uuid: 'R2', name: 'Vuelo en 24 h', trigger: 'activity_upcoming', channel: 'whatsapp', effect: 'scheduled', count: 4 },
      { uuid: 'R3', name: 'Sin plantilla', trigger: 'activity_upcoming', channel: 'whatsapp', effect: 'scheduled', count: 4, skip_reason: 'template_not_approved' },
    ],
    show_day_alert: { enabled: true, will_activate: true, days: 8, channel: 'whatsapp', template_ready: true, recipients: 8 },
    existing_activities: { activities: 2, messages: { whatsapp: 0, email: 6, in_app: 0 } },
    replaced: 1,
    past_activities: 2,
    first_send_at: '2026-11-30T08:00:00Z',
    warnings: ['people_without_phone', 'whatsapp_template_missing', 'past_activities'],
    ...o,
  })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ImportNotificationsPreview', () => {
  it('pinta las secciones del contrato', async () => {
    const calls = setupFetch(() => jsonResponse(full()))
    const w = mountPreview()
    expect(w.find('[data-test="import-notices-loading"]').exists()).toBe(true)
    await flushPromises()
    expect(calls[0]).toEqual({ url: PATH, body: { pause_notifications: false, activate_tour: true } })

    expect(w.get('[data-test="import-notices-recipients-line"]').text()).toBe(
      'Equipo de la gira · 9 personas (+3 de esta importación)'
    )
    expect(w.get('[data-test="import-notices-recipients-channels"]').text()).toBe(
      'WhatsApp 8 · Email 7 · App 2'
    )
    expect(w.text()).toContain('Vuelo: a Banda')
    const noPhone = w.get('[data-test="import-notices-without-phone"]').text()
    expect(noPhone).toContain('1 persona sin móvil no recibirá WhatsApp')
    expect(noPhone).toContain('Marta Ruiz')

    // Recordatorios por tipo: el paso de WhatsApp sin plantilla sale por email (`sends_as`).
    const row = w.get('tr[data-type="flight"]').text()
    expect(row).toContain('Vuelo')
    expect(row).toContain('24 h por email · 3 h por email')
    expect(row).toContain('WhatsApp 0 · Email 96 · App 0')
    expect(w.find('[data-type-card="flight"]').exists()).toBe(true)
    expect(w.get('[data-test="import-notices-existing"]').text()).toContain('2 actividades ya guardadas')
    expect(w.get('[data-test="import-notices-past"]').text()).toBe(
      '2 actividades ya han pasado: no tendrán recordatorios.'
    )
    expect(w.get('[data-test="import-notices-replaced"]').text()).toContain('1 actividad cambia')
    expect(w.find('[data-test="import-notices-template-missing"]').exists()).toBe(true)

    expect(w.get('[data-rule="R1"]').text()).toContain('No avisa de cada alta de esta importación')
    expect(w.get('[data-rule="R2"]').text()).toContain('Programará 4 avisos')
    expect(w.get('[data-rule="R3"]').text()).toContain(
      'No enviará nada. La plantilla de WhatsApp aún no está aprobada.'
    )

    expect(w.get('[data-test="import-notices-show-day"]').text()).toBe(
      '8 días con show · se activará con la gira'
    )
    // 08:00 UTC = 09:00 en Madrid, en Space Mono.
    const first = w.get('[data-test="import-notices-first-send"]')
    expect(first.text()).toContain('Primer envío:')
    expect(first.get('.font-time.tnum').text()).toContain('09:00')
    expect(w.get('[data-test="import-notices-quota-line"]').text()).toBe(
      'Unos 311 WhatsApp · te quedan 500 en tu plan'
    )
    expect(w.find('[data-test="import-notices-quota-exceeds"]').exists()).toBe(false)
    expect(w.get('[data-test="import-notices-will-activate"]').text()).toBe('La gira pasará a activa.')
    expect(w.get('[data-test="import-notices-confirm"]').text()).toBe('Confirmar y activar')
    // Sin costes en dinero.
    expect(w.text()).not.toMatch(/[$€]|USD|EUR/)
  })

  it('cupo excedido: badge pendiente, aviso y "Ver planes" sin bloquear', async () => {
    setupFetch(() =>
      jsonResponse(full({ quota: { remaining: 3, plan_limit: 3, pending_whatsapp: 0, exceeds: true, overflow: 308 } }))
    )
    const w = mountPreview()
    await flushPromises()
    const box = w.get('[data-test="import-notices-quota-exceeds"]')
    expect(box.find('[data-status="pending"]').exists()).toBe(true)
    expect(box.text()).toContain('Los que no quepan en tu plan saldrán por email y en la app.')
    expect(w.getComponent(RouterLinkStub).props('to')).toEqual({
      name: 'settings',
      query: { tab: 'subscription' },
    })
    expect(w.get('[data-test="import-notices-confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('WhatsApp ya programados, personas fuera de los grupos por tipo y resumen diario', async () => {
    setupFetch(() =>
      jsonResponse(
        full({
          quota: { remaining: 500, plan_limit: 500, pending_whatsapp: 40, exceeds: false, overflow: 0 },
          outside_type_groups: {
            types: [
              { code: 'flight', name: 'Vuelo', people: 3 },
              { code: 'soundcheck', name: 'Prueba de sonido', people: 2 },
            ],
            people: 3,
          },
          day_sheet: { will_run: true, channels: ['email', 'whatsapp'], whatsapp_ready: true },
          warnings: ['imported_outside_type_groups', 'day_sheet_will_run'],
        })
      )
    )
    const w = mountPreview()
    await flushPromises()
    expect(w.get('[data-test="import-notices-quota-pending"]').text()).toBe(
      'Ya hay 40 WhatsApp programados en la gira'
    )
    expect(w.get('[data-test="import-notices-outside-types"]').text()).toBe(
      '3 personas importadas solo entran en el Equipo de la gira y no recibirán los recordatorios de: Vuelo, Prueba de sonido'
    )
    expect(w.get('[data-test="import-notices-day-sheet"]').text()).toBe(
      'Al activar la gira, cada noche se enviará un resumen del día siguiente por email y por WhatsApp, que gasta cupo.'
    )
  })

  it('sin pendientes ni avisos nuevos no se pintan; resumen solo por email; plurales', async () => {
    setupFetch((_c, n) =>
      jsonResponse(
        n === 0
          ? full()
          : full({
              day_sheet: { will_run: true, channels: ['email'], whatsapp_ready: false },
              warnings: ['day_sheet_will_run'],
            })
      )
    )
    const w = mountPreview()
    await flushPromises()
    expect(w.find('[data-test="import-notices-quota-pending"]').exists()).toBe(false)
    expect(w.find('[data-test="import-notices-outside-types"]').exists()).toBe(false)
    expect(w.find('[data-test="import-notices-day-sheet"]').exists()).toBe(false)
    await w.get('[data-test="import-notices-pause"]').setValue(true)
    await flushPromises()
    expect(w.get('[data-test="import-notices-day-sheet"]').text()).toBe(
      'Al activar la gira, cada noche se enviará un resumen del día siguiente por email.'
    )
    const t = i18n.global.t
    expect(t('importer.notices.quotaPending', { n: 1 }, 1)).toBe('Ya hay 1 WhatsApp programado en la gira')
    expect(t('importer.notices.outsideTypeGroups', { people: 1, types: 'Vuelo' }, 1)).toBe(
      '1 persona importada solo entra en el Equipo de la gira y no recibirá los recordatorios de: Vuelo'
    )
    expect(t('importer.notices.quotaPending', { n: 2 }, { plural: 2, locale: 'en' })).toBe(
      'There are already 2 WhatsApp messages scheduled in the tour'
    )
  })

  it('la casilla de pausa vuelve a pedir la vista previa y confirma con pausa', async () => {
    const calls = setupFetch((c) =>
      jsonResponse(full({ paused: { current: false, after_confirm: !!c.body.pause_notifications } }))
    )
    const w = mountPreview()
    await flushPromises()
    await w.get('[data-test="import-notices-pause"]').setValue(true)
    await flushPromises()
    expect(calls).toHaveLength(2)
    expect(calls[1].body).toEqual({ pause_notifications: true, activate_tour: true })
    await w.get('[data-test="import-notices-confirm"]').trigger('click')
    expect(w.emitted('confirm')).toEqual([[true]])
  })

  it('gira ya en pausa: casilla marcada y deshabilitada; gira activa: "Confirmar"', async () => {
    setupFetch(() =>
      jsonResponse(
        full({ paused: { current: true, after_confirm: true }, tour_will_activate: false })
      )
    )
    const w = mountPreview()
    await flushPromises()
    const box = w.get('[data-test="import-notices-pause"]').element as HTMLInputElement
    expect(box.checked).toBe(true)
    expect(box.disabled).toBe(true)
    expect(w.get('[data-test="import-notices-pause-help"]').text()).toBe(
      'Los avisos de esta gira ya están en pausa.'
    )
    expect(w.find('[data-test="import-notices-will-activate"]').exists()).toBe(false)
    expect(w.get('[data-test="import-notices-confirm"]').text()).toBe('Confirmar')
    await w.get('[data-test="import-notices-confirm"]').trigger('click')
    expect(w.emitted('confirm')).toEqual([[true]])
  })

  it('respuesta atrasada ignorada', async () => {
    let releaseFirst: (r: Response) => void = () => {}
    setupFetch((c) =>
      c.url === PATH
        ? new Promise<Response>((resolve) => (releaseFirst = resolve))
        : jsonResponse(full({ totals: { whatsapp: 7, email: 0, in_app: 0 } }))
    )
    const w = mountPreview()
    await flushPromises()
    // Cambia el job antes de que llegue la primera respuesta.
    await w.setProps({ jobUuid: 'J2' })
    await flushPromises()
    releaseFirst(jsonResponse(full({ totals: { whatsapp: 999, email: 0, in_app: 0 } })))
    await flushPromises()
    expect(w.get('[data-test="import-notices-quota-line"]').text()).toBe(
      'Unos 7 WhatsApp · te quedan 500 en tu plan'
    )
  })

  it('error con "Reintentar"; 409 job_not_ready emite notReady; sin grupo ni envíos', async () => {
    setupFetch((_c, n) =>
      n === 0
        ? jsonResponse({ detail: 'x' }, 500)
        : jsonResponse(
            full({
              recipients: { ...full().recipients, group: null, without_phone: [] },
              first_send_at: null,
              reminders_by_type: [],
              rules: [],
              warnings: ['default_group_empty'],
            })
          )
    )
    const w = mountPreview()
    await flushPromises()
    expect(w.get('[data-test="import-notices-error"]').text()).toBe(i18n.global.t('importer.errors.generic'))
    await w.get('[data-test="import-notices-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="import-notices-no-group"]').exists()).toBe(true)
    expect(w.get('[data-test="import-notices-no-sends"]').text()).toBe('No hay nada que enviar por ahora.')
    expect(w.find('[data-test="import-notices-no-reminders"]').exists()).toBe(true)
    expect(w.find('[data-test="import-notices-rules"]').exists()).toBe(false)
    expect(w.find('[data-test="import-notices-group-empty"]').exists()).toBe(true)

    setupFetch(() =>
      jsonResponse(
        { success: false, error: { message: 'x', status_code: 409, details: { code: ['job_not_ready'] } } },
        409
      )
    )
    const w2 = mountPreview()
    await flushPromises()
    expect(w2.emitted('notReady')).toHaveLength(1)
  })
})
