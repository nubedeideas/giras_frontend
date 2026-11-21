import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import { rule, ruleOptions, wrappedError } from '@/test/rules'
import {
  allowedChannels,
  allowedRecipientTypes,
  compatibleTemplates,
  inUseErrorMessage,
  offsetLimits,
  offsetToParts,
  outcomeLabel,
  partsToOffset,
  ruleErrorLabel,
  ruleSummary,
  ruleWarningsLabel,
  type Translate,
} from './notificationRules'

const t: Translate = (key, named) => i18n.global.t(key, named ?? {})

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('offsetToParts / partsToOffset', () => {
  it.each([
    [0, { value: 0, unit: 'minutes' }],
    [45, { value: 45, unit: 'minutes' }],
    [180, { value: 3, unit: 'hours' }],
    [1440, { value: 1, unit: 'days' }],
    [20160, { value: 14, unit: 'days' }],
    [90, { value: 90, unit: 'minutes' }],
  ])('%i minutos ida y vuelta', (minutes, parts) => {
    expect(offsetToParts(minutes)).toEqual(parts)
    expect(partsToOffset(offsetToParts(minutes))).toBe(minutes)
  })

  it('convierte unidades a minutos', () => {
    expect(partsToOffset({ value: 2, unit: 'days' })).toBe(2880)
    expect(partsToOffset({ value: 1.5, unit: 'hours' })).toBe(90)
    expect(partsToOffset({ value: Number.NaN, unit: 'hours' })).toBe(0)
  })
})

describe('offsetLimits', () => {
  it('usa los del catálogo y, sin catálogo, los del backend', () => {
    expect(offsetLimits('activity_upcoming', ruleOptions())).toEqual({
      min: 15,
      max: 20160,
      direction: 'before',
    })
    expect(offsetLimits('notification_unconfirmed', null)).toEqual({
      min: 60,
      max: 4320,
      direction: 'after',
    })
    expect(offsetLimits('activity_created', null).max).toBe(0)
  })
})

describe('allowedChannels y allowedRecipientTypes (tabla de B5)', () => {
  it('activity_updated no admite WhatsApp', () => {
    expect(allowedChannels('activity_updated')).toEqual(['email', 'in_app'])
  })

  it('notification_unconfirmed es solo WhatsApp y destinatarios originales', () => {
    expect(allowedChannels('notification_unconfirmed')).toEqual(['whatsapp'])
    expect(allowedRecipientTypes('notification_unconfirmed')).toEqual(['original_recipients'])
  })

  it('in_app solo con administradores o todo el equipo', () => {
    expect(allowedChannels('activity_created', 'group')).toEqual(['whatsapp', 'email'])
    expect(allowedChannels('activity_upcoming', 'default_group')).toEqual(['whatsapp', 'email'])
    expect(allowedChannels('activity_created', 'tour_admins')).toEqual([
      'whatsapp',
      'email',
      'in_app',
    ])
    expect(allowedRecipientTypes('activity_created', 'in_app')).toEqual([
      'tour_admins',
      'tour_members',
    ])
    expect(allowedRecipientTypes('activity_upcoming')).toEqual([
      'group',
      'default_group',
      'tour_admins',
      'tour_members',
    ])
  })

  it('un disparador antiguo no tiene opciones', () => {
    expect(allowedChannels('event_created')).toEqual([])
    expect(allowedRecipientTypes('event_created')).toEqual([])
  })
})

describe('compatibleTemplates', () => {
  it('filtra por canal y disparador y pone primero las recomendadas', () => {
    const list = compatibleTemplates(ruleOptions(), 'activity_upcoming', 'whatsapp', ['flight'])
    expect(list.map((x) => x.uuid)).toEqual(['tpl-wa-flight', 'tpl-wa-generic', 'tpl-wa-nosid'])
  })

  it('sin tipos elegidos no hay recomendada y las aprobadas van antes', () => {
    const list = compatibleTemplates(ruleOptions(), 'activity_upcoming', 'whatsapp', [])
    expect(list.map((x) => x.uuid)).toEqual(['tpl-wa-generic', 'tpl-wa-flight', 'tpl-wa-nosid'])
  })

  it('activity_updated solo ve las de cambio', () => {
    expect(
      compatibleTemplates(ruleOptions(), 'activity_updated', 'email', []).map((x) => x.uuid)
    ).toEqual(['tpl-email-changed'])
    expect(compatibleTemplates(null, 'activity_updated', 'email', [])).toEqual([])
  })
})

describe('ruleSummary', () => {
  const options = ruleOptions()

  it('activity_created', () => {
    const s = ruleSummary(
      rule({
        trigger: 'activity_created',
        activity_type_codes: [],
        recipients_type: 'tour_admins',
        channel: 'in_app',
        template_name: 'Actividad (app)',
        offset_minutes: 0,
      }),
      options,
      t
    )
    expect(s).toBe(
      'Cuando se cree cualquier actividad → avisar a los administradores de la gira por aviso en la app con «Actividad (app)»'
    )
  })

  it('activity_updated', () => {
    const s = ruleSummary(
      rule({
        trigger: 'activity_updated',
        recipients_type: 'default_group',
        channel: 'email',
        template_name: 'Cambio (email)',
      }),
      options,
      t
    )
    expect(s).toBe(
      'Cuando cambie Vuelo → avisar al grupo «Equipo» por email con «Cambio (email)»'
    )
  })

  it('activity_upcoming', () => {
    expect(ruleSummary(rule(), options, t)).toBe(
      '1 día antes de Vuelo → avisar al grupo «Técnicos» por WhatsApp con «Vuelo»'
    )
  })

  it('notification_unconfirmed', () => {
    const s = ruleSummary(
      rule({
        trigger: 'notification_unconfirmed',
        activity_type_codes: [],
        recipients_type: 'original_recipients',
        template_name: null,
        offset_minutes: 180,
      }),
      options,
      t
    )
    expect(s).toBe('Si alguien no confirma un WhatsApp en 3 horas → recordárselo por WhatsApp')
  })

  it('regla antigua con etiqueta legible del disparador', () => {
    const legacy = rule({
      trigger: 'event_created',
      recipients_type: 'tour_members',
      channel: 'email',
      is_editable: false,
    })
    expect(ruleSummary(legacy, options, t)).toBe(
      'Regla antigua: al crear un evento → avisar a todo el equipo de la gira por email'
    )
    expect(ruleSummary({ ...legacy, trigger: 'otro_raro' }, options, t)).toContain(
      'Regla antigua: disparador antiguo'
    )
  })
})

describe('outcomeLabel, avisos y errores', () => {
  it('traduce el último disparo, también skipped:<reason>', () => {
    expect(outcomeLabel('', t)).toBe('Aún no se ha disparado')
    expect(outcomeLabel('queued', t)).toBe('Enviado')
    expect(outcomeLabel('skipped:no_recipients', t)).toBe(
      'No se envió: Nadie tenía teléfono o email para este canal.'
    )
    expect(outcomeLabel('skipped:motivo_nuevo', t)).toBe('No se envió: motivo_nuevo')
    expect(outcomeLabel('otro', t)).toBe('otro')
  })

  it('avisos y códigos de error conocidos y desconocidos', () => {
    expect(ruleWarningsLabel('group_empty', t)).toBe('El grupo no tiene contactos.')
    expect(ruleWarningsLabel('raro', t)).toBe('raro')
    expect(ruleErrorLabel('too_many_rules', t)).toBe(
      'Has llegado al máximo de reglas de esta gira.'
    )
    expect(ruleErrorLabel('desconocido', t)).toBeNull()
    expect(ruleErrorLabel(null, t)).toBeNull()
  })
})

describe('inUseErrorMessage', () => {
  it('saca el mensaje del campo en un 409 sin depender del orden', () => {
    const e = new ApiError(
      409,
      wrappedError(409, {
        code: ['group_in_use'],
        rules: ['r-1'],
        group: ['Lo usan 1 reglas activas. Desactívalas antes de borrarlo.'],
      })
    )
    expect(inUseErrorMessage(e, 'group', 'x')).toBe(
      'Lo usan 1 reglas activas. Desactívalas antes de borrarlo.'
    )
  })

  it('otros errores usan su mensaje', () => {
    const e = new ApiError(403, null)
    expect(inUseErrorMessage(e, 'template', 'x')).toBe(e.message)
    expect(inUseErrorMessage('raro', 'template', 'fallback')).toBe('fallback')
  })
})
