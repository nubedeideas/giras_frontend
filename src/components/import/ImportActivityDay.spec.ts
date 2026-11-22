import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import ImportActivityDay from './ImportActivityDay.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

const types = [{ code: 'flight', name: 'Vuelo', color: '#3b82f6' }]

describe('ImportActivityDay', () => {
  it('cabecera con fecha en font-time, ciudad y recuento; color del tipo como punto', () => {
    const w = mount(ImportActivityDay, {
      props: {
        date: '2026-12-03',
        rows: [activityRow(), activityRow({ client_id: 'a2', city: 'Madrid', activity_type_code: 'show', type_name: 'Show' })],
        tourTimezone: 'Europe/Madrid',
        types,
        saving: new Set<string>(),
      },
      global: { plugins: [i18n] },
    })
    const label = w.get('[data-test="import-day-label"]')
    expect(label.text()).toBe('jue 3 dic')
    expect(label.classes()).toEqual(expect.arrayContaining(['font-time', 'tnum']))
    expect(w.get('[data-test="import-day-city"]').text()).toBe('Madrid')
    expect(w.get('[data-test="import-day-count"]').text()).toBe('2 actividades')
    const dots = w.findAll('[data-test="import-activity-dot"]')
    expect(dots[0].attributes('style')).toContain('background')
    // Tipo que la gira no tiene: punto neutro.
    expect(dots[1].attributes('style')).toBeUndefined()
    expect(dots[1].classes()).toContain('bg-line-2')
  })

  it('"Sin fecha" y resolutor bajo las filas pendientes; el editor sustituye al resolutor', () => {
    const pending = activityRow({ date: null, scheduled_at: null, needs_action: true, issues: ['date_missing'] })
    let w = mount(ImportActivityDay, {
      props: { date: null, rows: [pending], tourTimezone: 'Europe/Madrid', saving: new Set<string>() },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-day-label"]').text()).toBe('Sin fecha')
    expect(w.find('[data-test="import-activity-resolver"]').exists()).toBe(true)
    w = mount(ImportActivityDay, {
      props: { date: null, rows: [pending], tourTimezone: 'Europe/Madrid', saving: new Set<string>(), selectedId: 'a1' },
      slots: { expanded: '<div data-test="slot-editor" />' },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-test="slot-editor"]').exists()).toBe(true)
    expect(w.find('[data-test="import-activity-resolver"]').exists()).toBe(false)
  })
})
