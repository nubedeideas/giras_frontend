import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import {
  apiErrorCode,
  formatOffset,
  minutesToParts,
  nextStepMinutes,
  partsToMinutes,
  reminderErrorMessage,
  sameSteps,
  stepsOfType,
  stepsSummary,
  validateSteps,
} from './reminders'

const t = i18n.global.t

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('formatOffset', () => {
  it('minutos, horas hasta 24 h y días a partir de ahí', () => {
    expect(formatOffset(30, t)).toBe('30 min')
    expect(formatOffset(60, t)).toBe('1 h')
    expect(formatOffset(180, t)).toBe('3 h')
    expect(formatOffset(1440, t)).toBe('24 h')
    expect(formatOffset(2880, t)).toBe('2 días')
    expect(formatOffset(90, t)).toBe('1 h 30 min')
    i18n.global.locale.value = 'en'
    expect(formatOffset(2880, t)).toBe('2 days')
  })
})

describe('stepsSummary', () => {
  it('ordena de mayor a menor y nombra cada canal', () => {
    expect(
      stepsSummary(
        [
          { minutes: 60, channel: 'in_app' },
          { minutes: 1440, channel: 'email' },
          { minutes: 180, channel: 'whatsapp' },
        ],
        t
      )
    ).toBe('24 h por email · 3 h por WhatsApp · 1 h en la app')
  })

  it('sin pasos', () => {
    expect(stepsSummary([], t)).toBe('Sin recordatorios')
    expect(stepsSummary(null, t)).toBe('Sin recordatorios')
  })
})

describe('validateSteps', () => {
  it('acepta pasos válidos', () => {
    const v = validateSteps([
      { minutes: 1440, channel: 'email' },
      { minutes: 60, channel: 'whatsapp' },
    ])
    expect(v).toEqual({ valid: true, code: null, stepErrors: [null, null] })
  })

  it('rango, canal, duplicados y máximo', () => {
    expect(validateSteps([{ minutes: 4, channel: 'email' }]).code).toBe(
      'step_minutes_out_of_range'
    )
    expect(validateSteps([{ minutes: 20161, channel: 'email' }]).code).toBe(
      'step_minutes_out_of_range'
    )
    expect(validateSteps([{ minutes: 60, channel: 'sms' }]).code).toBe('step_channel_invalid')
    const dup = validateSteps([
      { minutes: 60, channel: 'email' },
      { minutes: 60, channel: 'whatsapp' },
    ])
    expect(dup.code).toBe('step_minutes_duplicated')
    expect(dup.stepErrors).toEqual([null, 'step_minutes_duplicated'])
    const six = [5, 10, 15, 20, 25, 30].map((m) => ({ minutes: m, channel: 'email' }))
    expect(validateSteps(six).code).toBe('too_many_steps')
    expect(validateSteps('x').code).toBe('steps_invalid')
    expect(validateSteps([{ minutes: 1.5, channel: 'email' }]).code).toBe('steps_invalid')
    expect(validateSteps([]).valid).toBe(true)
  })

  it('respeta límites propios', () => {
    const limits = { max_steps: 1, min_minutes: 15, max_minutes: 60 }
    expect(validateSteps([{ minutes: 10, channel: 'email' }], limits).valid).toBe(false)
    expect(
      validateSteps(
        [
          { minutes: 30, channel: 'email' },
          { minutes: 20, channel: 'email' },
        ],
        limits
      ).code
    ).toBe('too_many_steps')
  })
})

describe('ayudas del editor', () => {
  it('unidades', () => {
    expect(minutesToParts(1440)).toEqual({ value: 24, unit: 'hours' })
    expect(minutesToParts(2880)).toEqual({ value: 2, unit: 'days' })
    expect(minutesToParts(45)).toEqual({ value: 45, unit: 'minutes' })
    expect(partsToMinutes(3, 'days')).toBe(4320)
  })

  it('siguiente antelación libre', () => {
    expect(nextStepMinutes([])).toBe(60)
    expect(nextStepMinutes([{ minutes: 60, channel: 'email' }])).toBe(1440)
  })

  it('pasos de un tipo legado salen de default_reminder_minutes por WhatsApp', () => {
    expect(stepsOfType({ reminder_steps: null, default_reminder_minutes: [60, 1440] })).toEqual([
      { minutes: 1440, channel: 'whatsapp' },
      { minutes: 60, channel: 'whatsapp' },
    ])
    expect(sameSteps([{ minutes: 5, channel: 'email' }], [{ minutes: 5, channel: 'email' }])).toBe(
      true
    )
    expect(sameSteps(null, [])).toBe(false)
  })
})

describe('errores', () => {
  it('lee el code envuelto y lo traduce', () => {
    const err = new ApiError(400, {
      success: false,
      error: {
        message: 'x',
        status_code: 400,
        details: { steps: ['x'], code: ['step_minutes_duplicated'] },
      },
    })
    expect(apiErrorCode(err)).toBe('step_minutes_duplicated')
    expect(reminderErrorMessage(err, t, 'reminders.errors.save')).toBe(
      'Hay dos recordatorios con la misma antelación.'
    )
    expect(reminderErrorMessage(new ApiError(403, null), t, 'reminders.errors.save')).toBe(
      'Solo los administradores de la gira pueden configurar sus recordatorios.'
    )
    // 404: "no admin" solo en cargas; en acciones, el mensaje del backend.
    expect(
      reminderErrorMessage(new ApiError(404, null), t, 'reminders.errors.load', { load: true })
    ).toBe('Solo los administradores de la gira pueden configurar sus recordatorios.')
    expect(reminderErrorMessage(new ApiError(404, null), t, 'reminders.errors.save')).toBe(
      'No se ha encontrado el recurso.'
    )
    expect(reminderErrorMessage(new ApiError(429, null), t, 'reminders.errors.save')).toBe(
      'Has hecho demasiadas solicitudes. Inténtalo de nuevo en unos minutos.'
    )
  })
})
