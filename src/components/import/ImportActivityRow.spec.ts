import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import ImportActivityRow from './ImportActivityRow.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

function mountRow(props: Record<string, unknown> = {}) {
  return mount(ImportActivityRow, {
    props: { row: activityRow(), tourTimezone: 'Europe/Madrid', typeColor: '#3b82f6', ...props },
    global: { plugins: [i18n] },
  })
}

describe('ImportActivityRow', () => {
  it('hora en font-time, punto de color sin fondo tintado y confianza alta', () => {
    const w = mountRow()
    const time = w.get('[data-test="import-activity-time"]')
    expect(time.classes()).toEqual(expect.arrayContaining(['font-time', 'tnum']))
    expect(time.text()).toContain('10:30')
    expect(time.text()).toContain('11:45')
    const dot = w.get('[data-test="import-activity-dot"]')
    expect(dot.attributes('style')).toContain('background')
    expect(dot.classes()).toContain('w-2.5')
    // La fila no lleva el color del tipo como fondo.
    expect(w.get('li').attributes('style')).toBeUndefined()
    const conf = w.get('[data-test="import-activity-confidence"]')
    expect(conf.attributes('data-status')).toBe('sent')
    expect(conf.text()).toBe('Alta')
    // Estado "nueva" no se pinta; misma zona que la gira, sin abreviatura.
    expect(w.find('[data-test="import-activity-status"]').exists()).toBe(false)
    expect(w.find('[data-test="import-activity-zone"]').exists()).toBe(false)
  })

  it('confianza ámbar y roja, sin hora "—", todo el día', () => {
    let w = mountRow({ row: activityRow({ confidence: 0.75 }) })
    expect(w.get('[data-test="import-activity-confidence"]').attributes('data-status')).toBe('pending')
    w = mountRow({ row: activityRow({ confidence: 0.5, start_time: null, end_time: null, scheduled_at: null, end_at: null }) })
    expect(w.get('[data-test="import-activity-confidence"]').attributes('data-status')).toBe('failed')
    expect(w.get('[data-test="import-activity-time"]').text()).toBe('—')
    expect(w.get('li').attributes('data-needs-action')).toBe('true')
    w = mountRow({ row: activityRow({ all_day: true }) })
    expect(w.get('[data-test="import-activity-time"]').text()).toBe('Todo el día')
  })

  it('duplicado omitido con StatusBadge off y "Recuperar"', async () => {
    const w = mountRow({
      row: activityRow({
        action: 'skip',
        match: { ...activityRow().match, status: 'duplicate', activity_uuid: 'X' },
      }),
    })
    const status = w.get('[data-test="import-activity-status"]')
    expect(status.attributes('data-status')).toBe('off')
    expect(status.text()).toBe('Ya está en la gira → se omite')
    expect(w.find('[data-test="import-activity-confidence"]').exists()).toBe(false)
    await w.get('[data-test="import-activity-restore"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', action: 'create' }]])
  })

  it('duplicado seguro recuperado: conserva la insignia', () => {
    let w = mountRow({
      row: activityRow({ match: { ...activityRow().match, status: 'duplicate', activity_uuid: 'X' } }),
    })
    let status = w.get('[data-test="import-activity-status"]')
    expect(status.text()).toBe('Ya está en la gira')
    expect(status.attributes('data-status')).toBe('pending')
    w = mountRow({
      row: activityRow({
        duplicate_of: 'a0',
        match: { ...activityRow().match, status: 'duplicate_in_draft' },
      }),
    })
    status = w.get('[data-test="import-activity-status"]')
    expect(status.text()).toBe('Repetida en lo importado')
  })

  it('mes deducido: issue traducido', () => {
    const w = mountRow({ row: activityRow({ issues: ['month_inferred'] }) })
    expect(w.text()).toContain('Mes deducido de la fila anterior')
  })

  it('zona distinta de la de la gira con su origen en title; issues traducidos', () => {
    const w = mountRow({
      row: activityRow({
        timezone: 'Europe/Lisbon',
        timezone_source: 'airports',
        issues: ['time_unverified', 'possible_duplicate'],
        in_past: true,
      }),
    })
    const zone = w.get('[data-test="import-activity-zone"]')
    expect(zone.attributes('title')).toBe('Europe/Lisbon · Por la ciudad')
    expect(w.text()).toContain('No encontramos esta hora en el documento')
    expect(w.text()).toContain('Ya ha pasado: no tendrá recordatorios')
    expect(w.text()).not.toContain('possible_duplicate')
  })

  it('check-out emparejado: "Salida de {hotel}"', () => {
    const w = mountRow({
      row: activityRow({
        client_id: 'a7o',
        activity_type_code: 'hotel_checkout',
        type_name: 'Check-out',
        pair_id: 'p7',
        metadata: { hotel_name: 'NH Collection' },
      }),
    })
    expect(w.get('[data-test="import-activity-checkout"]').text()).toBe('Salida de NH Collection')
  })

  it('Omitir, Editar y Ver origen', async () => {
    const w = mountRow()
    await w.get('[data-test="import-activity-skip"]').trigger('click')
    await w.get('[data-test="import-activity-edit"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', action: 'skip' }]])
    expect(w.emitted('edit')).toHaveLength(1)
    expect(w.find('[data-test="import-source-peek"]').exists()).toBe(false)
    await w.get('[data-test="import-activity-peek"]').trigger('click')
    expect(w.get('[data-test="import-source-snippet"]').text()).toContain('IB3456 MAD-BCN')
  })
})
