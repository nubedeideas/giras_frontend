import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import type { ImportWhatsappEstimate as Estimate } from '@/composables/useImportJobs'
import ImportWhatsappEstimate from './ImportWhatsappEstimate.vue'

const est = (o: Partial<Estimate> = {}): Estimate => ({
  per_person: 6,
  people: 2,
  total: 12,
  remaining: 40,
  plan_limit: 100,
  exceeds: false,
  ...o,
})

const line = (estimate: Estimate | null) => {
  const w = mount(ImportWhatsappEstimate, { props: { estimate }, global: { plugins: [i18n] } })
  const p = w.find('[data-test="import-wa-estimate-line"]')
  return p.exists() ? p.text() : null
}

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('ImportWhatsappEstimate', () => {
  it('plurales del total y del cupo restante', () => {
    expect(line(est())).toBe('Unos 12 WhatsApp durante la gira · te quedan 40 en tu plan')
    expect(line(est({ total: 1, remaining: 1 }))).toBe('Un WhatsApp durante la gira · te queda 1 en tu plan')
    expect(line(est({ total: 0, remaining: 0 }))).toBe(
      'Ningún WhatsApp previsto durante la gira · no te queda ninguno en tu plan'
    )
  })

  it('sin cupo de suscripción (remaining null) solo el total', () => {
    expect(line(est({ remaining: null, plan_limit: null }))).toBe('Unos 12 WhatsApp durante la gira')
  })

  it('nada con null o people 0; aviso solo con exceeds', () => {
    expect(line(null)).toBeNull()
    expect(line(est({ people: 0 }))).toBeNull()
    const w = mount(ImportWhatsappEstimate, {
      props: { estimate: est({ exceeds: true }) },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-wa-estimate-exceeds"]').text()).toContain('No caben todos en tu plan')
    expect(
      mount(ImportWhatsappEstimate, { props: { estimate: est() }, global: { plugins: [i18n] } })
        .find('[data-test="import-wa-estimate-exceeds"]')
        .exists()
    ).toBe(false)
  })

  it('en inglés', () => {
    i18n.global.locale.value = 'en'
    expect(line(est({ total: 1, remaining: 3 }))).toBe(
      'About 1 WhatsApp message during the tour · 3 left in your plan'
    )
  })
})
