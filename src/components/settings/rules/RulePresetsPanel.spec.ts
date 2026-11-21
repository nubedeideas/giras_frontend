import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { preset } from '@/test/rules'
import RulePresetsPanel from './RulePresetsPanel.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

function mountPanel(presets = [preset()], busyKey: string | null = null) {
  return mount(RulePresetsPanel, {
    props: { presets, busyKey },
    global: { plugins: [i18n] },
  })
}

describe('RulePresetsPanel', () => {
  it('activar emite la clave', async () => {
    const w = mountPanel()
    expect(w.text()).toContain('Recordar a quien no confirma')
    expect(w.text()).toContain('Si alguien no pulsa «Confirmar» en 3 horas')
    await w.find('[data-test="preset-activate"]').trigger('click')
    expect(w.emitted('apply')).toEqual([['unconfirmed_3h']])
  })

  it('activando deshabilita los botones', () => {
    const w = mountPanel([preset()], 'unconfirmed_3h')
    const btn = w.find('[data-test="preset-activate"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toBe('Activando…')
  })

  it('ya activada: "Activada" lleva a la regla', async () => {
    const w = mountPanel([
      preset({ key: 'flight_24h_members', applied_rule: 'rule-9', applied_active: true }),
    ])
    expect(w.find('[data-test="preset-activate"]').exists()).toBe(false)
    const active = w.find('[data-test="preset-active"]')
    expect(active.text()).toContain('Activada')
    await active.trigger('click')
    expect(w.emitted('open')).toEqual([['rule-9']])
  })

  it('aplicada pero desactivada se puede volver a activar', () => {
    const w = mountPanel([preset({ applied_rule: 'rule-9', applied_active: false })])
    expect(w.find('[data-test="preset-activate"]').exists()).toBe(true)
  })

  it('no disponible: deshabilitada con el motivo', async () => {
    const w = mountPanel([
      preset({
        key: 'flight_24h_members',
        available: false,
        unavailable_reason: 'template_not_approved',
      }),
    ])
    const box = w.find('[data-test="preset-unavailable"]')
    expect(box.text()).toContain(
      'No disponible: La plantilla de WhatsApp aún no está aprobada.'
    )
    const btn = box.find('button')
    expect(btn.attributes('disabled')).toBeDefined()
    await btn.trigger('click')
    expect(w.emitted('apply')).toBeUndefined()
  })
})
