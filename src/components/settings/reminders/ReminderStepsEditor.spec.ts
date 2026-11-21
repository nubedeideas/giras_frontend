import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import type { ReminderStep } from '@/utils/reminders'
import ReminderStepsEditor from './ReminderStepsEditor.vue'

function mountEditor(steps: ReminderStep[]) {
  const w = mount(ReminderStepsEditor, {
    props: {
      modelValue: steps,
      'onUpdate:modelValue': (v: ReminderStep[]) => w.setProps({ modelValue: v }),
    },
    global: { plugins: [i18n] },
  })
  return w
}

const lastEmitted = (w: ReturnType<typeof mountEditor>) => {
  const ev = w.emitted('update:modelValue')!
  return ev[ev.length - 1][0] as ReminderStep[]
}

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('ReminderStepsEditor', () => {
  it('pinta un paso por fila con su unidad', () => {
    const w = mountEditor([
      { minutes: 1440, channel: 'email' },
      { minutes: 30, channel: 'whatsapp' },
    ])
    const rows = w.findAll('[data-test="step-row"]')
    expect(rows).toHaveLength(2)
    expect((rows[0].find('[data-test="step-value"]').element as HTMLInputElement).value).toBe('24')
    expect((rows[0].find('[data-test="step-unit"]').element as HTMLSelectElement).value).toBe(
      'hours'
    )
    expect((rows[1].find('[data-test="step-unit"]').element as HTMLSelectElement).value).toBe(
      'minutes'
    )
  })

  it('añade y quita pasos', async () => {
    const w = mountEditor([{ minutes: 60, channel: 'whatsapp' }])
    await w.get('[data-test="step-add"]').trigger('click')
    expect(lastEmitted(w)).toEqual([
      { minutes: 60, channel: 'whatsapp' },
      { minutes: 1440, channel: 'whatsapp' },
    ])
    await w.findAll('[data-test="step-remove"]')[0].trigger('click')
    expect(lastEmitted(w)).toEqual([{ minutes: 1440, channel: 'whatsapp' }])
  })

  it('no deja pasar de 5', async () => {
    const w = mountEditor([5, 10, 15, 20, 25].map((m) => ({ minutes: m, channel: 'email' })))
    const add = w.get('[data-test="step-add"]')
    expect(add.attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="step-max"]').text()).toBe('Máximo 5 recordatorios por tipo')
  })

  it('cambia el canal y avisa de que in_app solo llega a usuarios', async () => {
    const w = mountEditor([{ minutes: 60, channel: 'whatsapp' }])
    expect(w.find('[data-test="step-in-app-hint"]').exists()).toBe(false)
    await w.get('[data-test="step-channel-in_app"]').trigger('click')
    expect(lastEmitted(w)).toEqual([{ minutes: 60, channel: 'in_app' }])
    expect(w.get('[data-test="step-in-app-hint"]').text()).toContain(
      'El crew sin cuenta no lo verá.'
    )
  })

  it('valida en vivo: duplicados y rango', async () => {
    const w = mountEditor([
      { minutes: 60, channel: 'whatsapp' },
      { minutes: 120, channel: 'email' },
    ])
    const input = w.findAll('[data-test="step-value"]')[1]
    await input.setValue('1')
    expect(lastEmitted(w)[1]).toEqual({ minutes: 60, channel: 'email' })
    expect(w.get('[data-test="step-error"]').text()).toBe(
      'Hay dos recordatorios con la misma antelación.'
    )
    await w.findAll('[data-test="step-unit"]')[1].setValue('minutes')
    expect(w.get('[data-test="step-error"]').text()).toBe(
      'Cada recordatorio debe ser entre 5 minutos y 14 días antes.'
    )
  })
})
