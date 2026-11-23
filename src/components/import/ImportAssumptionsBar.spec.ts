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

describe('ImportAssumptionsBar: orden de fechas (F5a)', () => {
  const twoSources = (): ImportAssumptions => ({
    ...base(),
    date_order: 'dmy',
    date_order_source: 'detected',
    date_order_mixed: true,
    date_orders: {
      d1: { order: 'dmy', source: 'detected', conflict: false, label: 'Itinerario.pdf' },
      d2: { order: 'mdy', source: 'inferred', conflict: false, label: 'Vuelos.xlsx · Hoja1' },
    },
    date_order_saved: { scope: 'tour', value: 'auto' },
  })

  it('texto del origen de cada fuente', () => {
    const cases: [ImportAssumptions['date_order_source'], string][] = [
      ['user', '(lo has elegido tú)'],
      ['subscription', '(de esta hoja)'],
      ['detected', '(del documento)'],
      ['tour', '(de la gira)'],
      ['inferred', '(deducido)'],
      ['locale', '(dudoso)'],
      ['language', '(dudoso)'],
    ]
    for (const [source, text] of cases) {
      const w = mountBar({ assumptions: { ...base(), date_order_source: source } })
      expect(w.get('[data-test="assumption-date-order-source"]').text()).toBe(text)
    }
    i18n.global.locale.value = 'en'
    const w = mountBar({ assumptions: { ...base(), date_order_source: 'locale' } })
    expect(w.get('[data-test="assumption-date-order-source"]').text()).toBe('(uncertain)')
  })

  it('con órdenes mezclados: un select por documento que manda date_orders', async () => {
    const w = mountBar({ assumptions: twoSources() })
    expect(w.find('[data-test="assumption-date-order"]').exists()).toBe(false)
    const selects = w.findAll('[data-test="assumption-source-order"]')
    expect(selects).toHaveLength(2)
    expect(selects[0].text()).toContain('Itinerario.pdf: dd/mm')
    expect(selects[1].attributes('aria-label')).toBe('Orden de las fechas de Vuelos.xlsx · Hoja1')
    expect(w.get('[data-source="d2"]').text()).toContain('(deducido)')
    await selects[1].setValue('dmy')
    // Elegir el mismo orden no manda nada.
    await selects[0].setValue('dmy')
    expect(w.emitted('patch')).toEqual([[{ date_orders: { d2: 'dmy' } }]])
  })

  it('"Recordar para esta gira": marcar manda el orden y remember; desmarcar, remember false', async () => {
    const a = { ...base(), date_order_saved: { scope: 'tour' as const, value: 'auto' as const } }
    let w = mountBar({ assumptions: a })
    let box = w.get('[data-test="assumption-remember"]')
    expect(w.get('[data-test="assumption-date-order-extra"]').text()).toContain('Recordar para esta gira')
    expect((box.element as HTMLInputElement).checked).toBe(false)
    await box.setValue(true)
    expect(w.emitted('patch')).toEqual([[{ date_order: 'dmy', remember_date_order: true }]])

    w = mountBar({ assumptions: { ...a, date_order_saved: { scope: 'tour', value: 'dmy' } } })
    box = w.get('[data-test="assumption-remember"]')
    expect((box.element as HTMLInputElement).checked).toBe(true)
    await box.setValue(false)
    expect(w.emitted('patch')).toEqual([[{ remember_date_order: false }]])
  })

  it('"Recordar para esta hoja" en jobs de hoja; sin date_order_saved no hay casilla', () => {
    const w = mountBar({
      assumptions: { ...base(), date_order_saved: { scope: null, value: 'auto' } },
      sheetJob: true,
    })
    expect(w.text()).toContain('Recordar para esta hoja')
    expect(mountBar().find('[data-test="assumption-remember"]').exists()).toBe(false)
  })

  it('la casilla se deshabilita con ymd o con órdenes mezclados, con el motivo', () => {
    let w = mountBar({ assumptions: twoSources() })
    expect(w.get('[data-test="assumption-remember"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="assumption-remember-why"]').text()).toBe(
      'Tus documentos usan órdenes distintos'
    )
    w = mountBar({
      assumptions: { ...base(), date_order: 'ymd', date_order_saved: { scope: 'tour', value: 'auto' } },
    })
    expect(w.get('[data-test="assumption-remember"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="assumption-remember-why"]').text()).toContain('no son ambiguas')
  })

  it('aviso de contradicción por documento (conflicto o date_order_contradicted)', () => {
    const a = twoSources()
    a.date_order_conflict = true
    a.date_orders!.d2.conflict = true
    const w = mountBar({
      assumptions: a,
      warnings: [{ code: 'date_order_contradicted', source: 'd1', chosen: 'mdy', detected: 'dmy' }],
    })
    const badges = w.findAll('[data-test="assumption-contradiction"]')
    expect(badges.map((b) => b.text())).toEqual([
      'Algunas fechas de Itinerario.pdf no encajan con mes/día',
      'Algunas fechas de Vuelos.xlsx · Hoja1 no encajan con mes/día',
    ])
    expect(badges[0].attributes('data-status')).toBe('pending')
    // Con el detalle por documento, el aviso genérico no se repite.
    expect(w.find('[data-test="assumption-date-order-conflict"]').exists()).toBe(false)
  })

  it('la gira cambia de orden con la revisión abierta: "Aplicar a esta revisión"', async () => {
    const a = { ...base(), date_order_saved: { scope: 'tour' as const, value: 'auto' as const } }
    // Sin cambio en la gira, o si ya coincide con el job, no hay aviso.
    expect(mountBar({ assumptions: a, liveOrder: 'auto' }).find('[data-test="assumption-tour-changed"]').exists()).toBe(false)
    expect(mountBar({ assumptions: a, liveOrder: 'dmy' }).find('[data-test="assumption-tour-changed"]').exists()).toBe(false)
    const w = mountBar({ assumptions: a, liveOrder: 'mdy' })
    const box = w.get('[data-test="assumption-tour-changed"]')
    expect(box.text()).toContain('La gira ahora lee las fechas como mes/día')
    await w.get('[data-test="assumption-apply-tour-order"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ date_order: 'mdy' }]])
    // En una hoja vinculada lo que manda es la hoja, no la gira.
    const sheet = mountBar({
      assumptions: { ...a, date_order_saved: { scope: 'subscription', value: 'auto' } },
      liveOrder: 'mdy',
    })
    expect(sheet.find('[data-test="assumption-tour-changed"]').exists()).toBe(false)
  })
})
