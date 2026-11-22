import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { activityJob } from '@/test/importActivities'
import type { ImportAssumptions } from '@/composables/useImportJobs'
import ImportAssumptionsBar from './ImportAssumptionsBar.vue'

const base = (): ImportAssumptions => activityJob().draft.assumptions!

function mountBar(props: Record<string, unknown> = {}) {
  return mount(ImportAssumptionsBar, {
    props: { assumptions: base(), baseYear: 2026, ...props },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('ImportAssumptionsBar', () => {
  it('año ±1 de la gira, orden de fechas y zona emiten su PATCH', async () => {
    const w = mountBar()
    const year = w.get('[data-test="assumption-year"]')
    expect(year.findAll('option').map((o) => o.text())).toEqual(['Año 2025', 'Año 2026', 'Año 2027'])
    await year.setValue('2027')
    await w.get('[data-test="assumption-date-order"]').setValue('mdy')
    await w.get('[data-test="assumption-timezone"]').setValue('Europe/Lisbon')
    expect(w.emitted('patch')).toEqual([
      [{ year: 2027 }],
      [{ date_order: 'mdy' }],
      [{ default_timezone: 'Europe/Lisbon' }],
    ])
    expect(w.get('[data-test="assumption-date-order"]').text()).toContain('Fechas dd/mm')
  })

  it('ciudades: la lista se abre y cambiar la zona de una emite cities', async () => {
    const w = mountBar()
    expect(w.get('[data-test="assumption-cities-toggle"]').text()).toBe('Ciudades (1)')
    expect(w.find('[data-test="assumption-cities"]').exists()).toBe(false)
    await w.get('[data-test="assumption-cities-toggle"]').trigger('click')
    const row = w.get('[data-city="madrid|es"]')
    expect(row.text()).toContain('Madrid')
    expect(row.text()).toContain('Por la ciudad')
    await row.get('[data-test="assumption-city-zone"]').setValue('Europe/Lisbon')
    expect(w.emitted('patch')).toEqual([[{ cities: { 'madrid|es': 'Europe/Lisbon' } }]])
  })

  it('"Día 1" solo con días numerados; fijarlo y quitarlo', async () => {
    let w = mountBar()
    expect(w.find('[data-test="assumption-day-one"]').exists()).toBe(false)
    w = mountBar({ showDayOne: true })
    await w.get('[data-test="assumption-day-one"]').setValue('2026-12-01')
    expect(w.emitted('patch')).toEqual([[{ day_one_date: '2026-12-01' }]])
    w = mountBar({ showDayOne: true, assumptions: { ...base(), day_one_date: '2026-12-01' } })
    expect(w.get('[data-test="assumption-day-one-text"]').text()).toBe('Día 1 = mar 1 dic')
    await w.get('[data-test="assumption-day-one-clear"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ day_one_date: null }]])
  })

  it('horas de hotel solo con hoteles', async () => {
    expect(mountBar().find('[data-test="assumption-hotels"]').exists()).toBe(false)
    const w = mountBar({ showHotels: true })
    await w.get('[data-test="assumption-checkin"]').setValue('14:00')
    await w.get('[data-test="assumption-checkout"]').setValue('11:00')
    expect(w.emitted('patch')).toEqual([[{ hotel_checkin_time: '14:00' }], [{ hotel_checkout_time: '11:00' }]])
  })

  it('conflicto dd/mm con StatusBadge pendiente; recalculando bloquea y avisa', () => {
    const w = mountBar({ assumptions: { ...base(), date_order_conflict: true }, saving: true })
    const badge = w.get('[data-test="assumption-date-order-conflict"]')
    expect(badge.attributes('data-status')).toBe('pending')
    expect(badge.text()).toBe('Hay fechas en dos formatos: revisa el orden')
    expect(w.get('[data-test="import-assumptions-help"]').text()).toBe('Recalculando…')
    expect(w.get('[data-test="assumption-year"]').attributes('disabled')).toBeDefined()
  })

  it('si el guardado falla, el control vuelve a su valor', async () => {
    const w = mountBar({ saving: true })
    const sel = () => w.get('[data-test="assumption-year"]').element as HTMLSelectElement
    sel().value = '2027'
    await w.setProps({ saving: false, error: 'No se ha guardado el cambio. Inténtalo de nuevo.' })
    expect(sel().value).toBe('2026')
    expect(w.get('[data-test="assumption-error"]').text()).toContain('No se ha guardado')
  })
})
