import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse, mockFetch, callAt } from '@/test/http'
import { TOUR, rule, ruleOptions, wrappedError } from '@/test/rules'
import type { Rule, RuleOptions } from '@/composables/useNotificationRules'
import RuleBuilder from './RuleBuilder.vue'

function mountBuilder(opts: { options?: RuleOptions; rule?: Rule | null } = {}) {
  return mount(RuleBuilder, {
    props: { tourUuid: TOUR, options: opts.options ?? ruleOptions(), rule: opts.rule ?? null },
    global: { plugins: [i18n], stubs: { RouterLink: true, RulePreviewPanel: true } },
  })
}

const disabled = (w: VueWrapper, step: string) =>
  w.find(`[data-test="step-${step}"]`).attributes('disabled') !== undefined

async function click(w: VueWrapper, sel: string) {
  await w.find(`[data-test="${sel}"]`).trigger('click')
  await flushPromises()
}

async function check(w: VueWrapper, sel: string) {
  await w.find(`[data-test="${sel}"]`).setValue(true)
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

describe('RuleBuilder', () => {
  it('pasos encadenados: Avisar a… deshabilitado sin trigger', async () => {
    const w = mountBuilder()
    expect(disabled(w, 'notify')).toBe(true)
    expect(disabled(w, 'via')).toBe(true)
    expect(disabled(w, 'with')).toBe(true)
    expect(w.find('[data-test="save-rule"]').attributes('disabled')).toBeDefined()

    await click(w, 'trigger-activity_created')
    expect(disabled(w, 'notify')).toBe(false)
    expect(disabled(w, 'via')).toBe(true)

    await check(w, 'recipients-tour_admins')
    expect(disabled(w, 'via')).toBe(false)
    expect(disabled(w, 'with')).toBe(true)

    await click(w, 'channel-in_app')
    expect(disabled(w, 'with')).toBe(false)
    await check(w, 'template-tpl-in-app')
    expect(w.find('[data-test="offset-immediately"]').text()).toBe('Al momento')
    // El nombre se prerrellena con la frase.
    expect((w.find('[data-test="rule-name"]').element as HTMLInputElement).value).toContain(
      'Cuando se cree cualquier actividad'
    )
    expect(w.find('[data-test="save-rule"]').attributes('disabled')).toBeUndefined()
  })

  it('cambiar a activity_updated quita WhatsApp y limpia la plantilla', async () => {
    const w = mountBuilder()
    await click(w, 'trigger-activity_created')
    await check(w, 'recipients-tour_members')
    await click(w, 'channel-whatsapp')
    await check(w, 'template-tpl-wa-generic')
    expect(disabled(w, 'offset')).toBe(false)

    await click(w, 'trigger-activity_updated')
    expect(w.find('[data-test="channel-whatsapp"]').exists()).toBe(false)
    expect(w.find('[data-test="channel-email"]').exists()).toBe(true)
    expect(w.find('[data-test="channel-whatsapp"]').exists()).toBe(false)
    // Canal y plantilla limpios: el paso Con… vuelve a estar deshabilitado.
    expect(disabled(w, 'with')).toBe(true)
    await click(w, 'channel-email')
    expect(w.find('[data-test="template-tpl-wa-generic"]').exists()).toBe(false)
    const radios = w.findAll('[data-test="template-list"] input')
    expect(radios.map((r) => (r.element as HTMLInputElement).checked)).toEqual([false])
  })

  it('in_app solo con miembros: elegir un grupo lo quita', async () => {
    const w = mountBuilder()
    await click(w, 'trigger-activity_created')
    await check(w, 'recipients-group')
    expect(w.find('[data-test="channel-in_app"]').exists()).toBe(false)
  })

  it('unconfirmed oculta plantilla y destinatarios', async () => {
    const w = mountBuilder()
    await click(w, 'trigger-notification_unconfirmed')
    expect(w.find('[data-test="original-recipients"]').text()).toContain('como máximo 2 veces')
    expect(w.find('[data-test="recipients-group"]').exists()).toBe(false)
    expect(w.find('[data-test="same-template"]').exists()).toBe(true)
    expect(w.find('[data-test="template-list"]').exists()).toBe(false)
    expect(w.find('[data-test="channel-email"]').exists()).toBe(false)
    // 3 horas por defecto, "después".
    expect((w.find('[data-test="offset-value"]').element as HTMLInputElement).value).toBe('3')
    expect(w.find('[data-test="step-offset"]').text()).toContain('después')
    expect(w.find('[data-test="save-rule"]').attributes('disabled')).toBeUndefined()
  })

  it('replaces visible solo en upcoming con tipos que tienen recordatorios', async () => {
    const w = mountBuilder()
    await click(w, 'trigger-activity_created')
    expect(w.find('[data-test="replaces"]').exists()).toBe(false)

    await click(w, 'trigger-activity_upcoming')
    expect(w.find('[data-test="replaces"]').exists()).toBe(true)
    // Solo "Día libre" (sin recordatorios por defecto): la casilla desaparece.
    await click(w, 'type-day_off')
    expect(w.find('[data-test="replaces"]').exists()).toBe(false)
    await click(w, 'type-flight')
    expect(w.find('[data-test="replaces"]').exists()).toBe(true)
    expect(w.find('[data-test="replaces-hint"]').text()).toBe(
      'Sustituye los recordatorios automáticos de 1 tipo de actividad: Vuelo. La vista previa te dice cuántos tiene cada actividad.'
    )
  })

  const replacesChecked = (w: VueWrapper) =>
    (w.find('[data-test="replaces"] input').element as HTMLInputElement).checked

  it('replaces desmarcada por defecto con "Todos los tipos" aunque el canal sea WhatsApp', async () => {
    const w = mountBuilder()
    await click(w, 'trigger-activity_upcoming')
    await check(w, 'recipients-tour_members')
    await click(w, 'channel-whatsapp')
    expect(replacesChecked(w)).toBe(false)
  })

  it('replaces desmarcada por defecto con tipos elegidos y canal email', async () => {
    const w = mountBuilder()
    await click(w, 'trigger-activity_upcoming')
    await click(w, 'type-flight')
    await check(w, 'recipients-tour_members')
    await click(w, 'channel-email')
    expect(replacesChecked(w)).toBe(false)
  })

  it('replaces marcada por defecto con tipos elegidos y canal WhatsApp, y respeta al usuario', async () => {
    const w = mountBuilder()
    await click(w, 'trigger-activity_upcoming')
    await click(w, 'type-flight')
    await check(w, 'recipients-tour_members')
    expect(replacesChecked(w)).toBe(false)
    await click(w, 'channel-whatsapp')
    expect(replacesChecked(w)).toBe(true)

    // Si el usuario la desmarca, cambiar después de paso no la vuelve a marcar.
    await w.find('[data-test="replaces"] input').setValue(false)
    await click(w, 'channel-email')
    await click(w, 'channel-whatsapp')
    expect(replacesChecked(w)).toBe(false)
  })

  it('límites de antelación', async () => {
    const w = mountBuilder()
    await click(w, 'trigger-activity_upcoming')
    await check(w, 'recipients-tour_members')
    await click(w, 'channel-email')
    await check(w, 'template-tpl-email')
    const save = () => w.find('[data-test="save-rule"]').attributes('disabled')
    // 1 día por defecto: válido.
    expect((w.find('[data-test="offset-value"]').element as HTMLInputElement).value).toBe('1')
    expect(save()).toBeUndefined()

    await w.find('[data-test="offset-unit"]').setValue('minutes')
    await w.find('[data-test="offset-value"]').setValue(10)
    await flushPromises()
    expect(save()).toBeDefined()
    expect(w.find('[data-test="offset-range"]').classes()).toContain('text-red-400')
    expect(w.find('[data-test="offset-range"]').text()).toBe(
      'Elige entre 15 minutos y 14 días.'
    )

    await w.find('[data-test="offset-unit"]').setValue('days')
    await w.find('[data-test="offset-value"]').setValue(15)
    await flushPromises()
    expect(save()).toBeDefined()

    await w.find('[data-test="offset-value"]').setValue(14)
    await flushPromises()
    expect(save()).toBeUndefined()
  })

  it('WhatsApp deshabilitado si no hay plantilla aprobada compatible', async () => {
    const options = ruleOptions()
    options.templates = options.templates.filter((x) => x.channel !== 'whatsapp' || !x.approved)
    const w = mountBuilder({ options })
    await click(w, 'trigger-activity_upcoming')
    await check(w, 'recipients-tour_members')
    expect(w.find('[data-test="channel-whatsapp"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="no-approved-whatsapp"]').exists()).toBe(true)
  })

  it('crea con el payload del contrato', async () => {
    const fn = mockFetch(jsonResponse(rule(), 201))
    const w = mountBuilder()
    await click(w, 'trigger-activity_upcoming')
    await click(w, 'type-flight')
    await check(w, 'recipients-group')
    await w.find('[data-test="group-select"]').setValue('g-1')
    await flushPromises()
    await click(w, 'channel-whatsapp')
    // La recomendada para vuelos va primero.
    const first = w.findAll('[data-test="template-list"] input')[0]
    expect(first.attributes('data-test')).toBe('template-tpl-wa-flight')
    await check(w, 'template-tpl-wa-flight')
    await click(w, 'save-rule')

    const { url, init } = callAt(fn, 0)
    expect(url).toBe('http://api.test/api/notifications/rules/')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      name: '1 día antes de Vuelo → avisar al grupo «Técnicos» por WhatsApp con «Vuelo»',
      description: '',
      tour: TOUR,
      trigger: 'activity_upcoming',
      activity_type_codes: ['flight'],
      recipients_type: 'group',
      group: 'g-1',
      channel: 'whatsapp',
      template: 'tpl-wa-flight',
      offset_minutes: 1440,
      replaces_default_reminders: true,
    })
    expect(w.emitted('saved')?.[0]?.[0]).toMatchObject({ uuid: 'rule-1' })
  })

  it('edita con PATCH sin tour', async () => {
    const fn = mockFetch(jsonResponse(rule({ name: 'Otro' })))
    const w = mountBuilder({ rule: rule() })
    expect((w.find('[data-test="rule-name"]').element as HTMLInputElement).value).toBe(
      'Vuelos 24 h'
    )
    await w.find('[data-test="rule-name"]').setValue('Otro')
    await click(w, 'save-rule')
    const { url, init } = callAt(fn, 0)
    expect(url).toBe('http://api.test/api/notifications/rules/rule-1/')
    expect(init.method).toBe('PATCH')
    const sent = JSON.parse(String(init.body))
    expect(sent.tour).toBeUndefined()
    expect(sent.name).toBe('Otro')
    expect(sent.offset_minutes).toBe(1440)
  })

  it('pinta el error de campo del backend en su paso', async () => {
    mockFetch(
      jsonResponse(
        wrappedError(400, {
          template: ['La plantilla no tiene SID.'],
          code: ['template_not_approved'],
        }),
        400
      )
    )
    const w = mountBuilder({ rule: rule() })
    await click(w, 'save-rule')
    const err = w.find('[data-test="error-with"]')
    expect(err.text()).toBe('La plantilla de WhatsApp aún no está aprobada.')
    expect(w.find('[data-test="error-general"]').exists()).toBe(false)
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('sin code conocido usa el mensaje del campo', async () => {
    mockFetch(
      jsonResponse(wrappedError(400, { offset_minutes: ['Fuera de rango.'] }), 400)
    )
    const w = mountBuilder({ rule: rule() })
    await click(w, 'save-rule')
    expect(w.find('[data-test="error-offset"]').text()).toBe('Fuera de rango.')
  })

  it('vista previa al editar manda la regla para no contar sus propias notificaciones', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const w = mountBuilder({ rule: rule() })
    expect(w.findComponent({ name: 'RulePreviewPanel' }).exists()).toBe(false)
    await click(w, 'open-preview')
    const panel = w.findComponent({ name: 'RulePreviewPanel' })
    expect(panel.exists()).toBe(true)
    expect(panel.props('draft')).toMatchObject({
      trigger: 'activity_upcoming',
      tour: TOUR,
      rule: 'rule-1',
    })
  })

  it('vista previa al crear no manda rule', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const w = mountBuilder()
    await click(w, 'trigger-activity_created')
    await check(w, 'recipients-tour_admins')
    await click(w, 'channel-in_app')
    await check(w, 'template-tpl-in-app')
    await click(w, 'open-preview')
    const draft = w.findComponent({ name: 'RulePreviewPanel' }).props('draft')
    expect(draft).not.toHaveProperty('rule')
  })

  it('plantilla y grupo de otro admin (fuera del catálogo) siguen valiendo al editar', async () => {
    const fn = mockFetch(jsonResponse(rule({ name: 'Renombrada' })))
    const options = ruleOptions()
    // Sin ninguna plantilla de WhatsApp aprobada en el catálogo de este co-admin.
    options.templates = options.templates.filter((x) => x.channel !== 'whatsapp')
    const foreign = rule({
      template: 'tpl-ajena',
      template_name: 'Plantilla de Marta',
      group: 'g-ajeno',
      group_name: 'Grupo de Marta',
      group_contact_count: 5,
    })
    const w = mountBuilder({ options, rule: foreign })

    const current = w.find('[data-test="template-tpl-ajena"]')
    expect(current.exists()).toBe(true)
    expect((current.element as HTMLInputElement).checked).toBe(true)
    expect(w.find('[data-test="template-list"]').text()).toContain('Actual')
    expect(w.find('[data-test="channel-whatsapp"]').attributes('disabled')).toBeUndefined()
    expect((w.find('[data-test="group-select"]').element as HTMLSelectElement).value).toBe(
      'g-ajeno'
    )
    expect(w.find('[data-test="group-select"]').text()).toContain('Grupo de Marta (5 contactos)')

    // Tocar otro paso (tipos) no borra la plantilla ajena.
    await click(w, 'type-day_off')
    expect((w.find('[data-test="template-tpl-ajena"]').element as HTMLInputElement).checked).toBe(
      true
    )

    await w.find('[data-test="rule-name"]').setValue('Renombrada')
    expect(w.find('[data-test="save-rule"]').attributes('disabled')).toBeUndefined()
    await click(w, 'save-rule')
    const sent = JSON.parse(String(callAt(fn, 0).init.body))
    expect(sent).toMatchObject({ name: 'Renombrada', template: 'tpl-ajena', group: 'g-ajeno' })
  })

  it('cambiar el canal sí descarta la plantilla ajena', async () => {
    const foreign = rule({ template: 'tpl-ajena', template_name: 'Plantilla de Marta' })
    const w = mountBuilder({ rule: foreign })
    await click(w, 'channel-email')
    expect(w.find('[data-test="template-tpl-ajena"]').exists()).toBe(false)
    expect(w.find('[data-test="save-rule"]').attributes('disabled')).toBeDefined()
  })

  it('número de contactos en singular y plural', () => {
    const options = ruleOptions()
    options.groups = [{ uuid: 'g-1', name: 'Uno', tour: TOUR, contact_count: 1 }]
    const w = mountBuilder({ options, rule: rule() })
    expect(w.find('[data-test="group-select"]').text()).toContain('Uno (1 contacto)')
  })
})
