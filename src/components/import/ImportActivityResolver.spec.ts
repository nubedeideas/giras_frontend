import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import { activityJob } from '@/test/importActivities'
import type { ImportActivityRow } from '@/composables/useImportJobs'
import ImportActivityResolver from './ImportActivityResolver.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

const types = [
  { code: 'show', name: 'Show', color: '#111111' },
  { code: 'soundcheck', name: 'Prueba de sonido', color: '#222222' },
]
const cities = activityJob().draft.assumptions!.cities

function mountResolver(row: ImportActivityRow, extra: Record<string, unknown> = {}) {
  return mount(ImportActivityResolver, {
    props: { row, types, cities, ...extra },
    global: { plugins: [i18n] },
  })
}

const dupMatch = {
  status: 'possible_duplicate' as const,
  by: 'type_time_title' as const,
  activity_uuid: 'ACT1',
  activity_title: 'Show WiZink',
  activity_scheduled_at: '2026-12-03T20:00:00Z',
  activity_type_code: 'show',
  activity_external_source: null,
}

describe('ImportActivityResolver', () => {
  it('sin nada que decidir no pinta nada', () => {
    expect(mountResolver(activityRow()).find('[data-test="import-activity-resolver"]').exists()).toBe(false)
  })

  it('tipo dudoso → activity_type_code', async () => {
    const w = mountResolver(
      activityRow({ activity_type_code: 'other', type_name: 'Otro', issues: ['type_uncertain'], needs_action: true })
    )
    const sel = w.get('[data-test="resolver-type"]')
    expect(sel.findAll('option').map((o) => o.text())).toEqual(['Otro', 'Show', 'Prueba de sonido'])
    await sel.setValue('soundcheck')
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', fields: { activity_type_code: 'soundcheck' } }]])
  })

  it('sin hora → hora o "Todo el día"', async () => {
    const w = mountResolver(
      activityRow({ start_time: null, end_time: null, scheduled_at: null, issues: ['time_missing'] })
    )
    await w.get('[data-test="resolver-time"]').setValue('21:00')
    await w.get('[data-test="resolver-all-day"]').trigger('click')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 'a1', fields: { start_time: '21:00', all_day: false } }],
      [{ client_id: 'a1', fields: { all_day: true, start_time: null, end_time: null } }],
    ])
  })

  it('sin fecha → fecha; no deja darla por buena', async () => {
    const w = mountResolver(
      activityRow({ date: null, scheduled_at: null, issues: ['date_missing'], needs_action: true, confidence: 0.5 })
    )
    expect(w.find('[data-test="resolver-reviewed"]').exists()).toBe(false)
    expect(w.get('[data-test="resolver-reviewed-blocked"]').text()).toBe('Sin fecha: ponla u omite la fila')
    await w.get('[data-test="resolver-date"]').setValue('2026-12-04')
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', fields: { date: '2026-12-04' } }]])
  })

  it('fuera de la gira: fecha o "Dar por buena"', async () => {
    const w = mountResolver(activityRow({ issues: ['outside_tour'], needs_action: true }))
    expect(w.find('[data-test="resolver-date"]').exists()).toBe(true)
    await w.get('[data-test="resolver-reviewed"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', reviewed: true }]])
  })

  it('zona heredada: de la ciudad por defecto o solo de la fila', async () => {
    const row = activityRow({ timezone_source: 'tour', issues: ['timezone_inherited'] })
    const w = mountResolver(row)
    expect(w.text()).toContain('Aplicar a todas las de Madrid')
    await w.get('[data-test="resolver-zone"]').setValue('Europe/Lisbon')
    expect(w.emitted('city')).toEqual([[{ key: 'madrid|es', timezone: 'Europe/Lisbon' }]])
    await w.get('[data-test="resolver-zone-city"]').setValue(false)
    await w.get('[data-test="resolver-zone"]').setValue('Europe/London')
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', fields: { timezone: 'Europe/London' } }]])
  })

  it('posible duplicado: Omitir · Crear igualmente · Sustituir', async () => {
    const w = mountResolver(activityRow({ match: dupMatch, needs_action: true, issues: ['possible_duplicate'] }))
    expect(w.get('[data-test="resolver-duplicate"]').text()).toContain(
      '¿Es la misma que Show WiZink (jue 3 dic 21:00)?'
    )
    // Se decide con sus botones, no con "Dar por buena".
    expect(w.find('[data-test="resolver-reviewed"]').exists()).toBe(false)
    await w.get('[data-test="resolver-dup-skip"]').trigger('click')
    await w.get('[data-test="resolver-dup-create"]').trigger('click')
    await w.get('[data-test="resolver-dup-replace"]').trigger('click')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 'a1', action: 'skip' }],
      [{ client_id: 'a1', action: 'create', reviewed: true }],
      [{ client_id: 'a1', action: 'replace', reviewed: true }],
    ])
  })

  it('sustitución elegida: el botón queda marcado', () => {
    const w = mountResolver(activityRow({ match: dupMatch, action: 'replace', reviewed: true }))
    expect(w.get('[data-test="resolver-dup-replace"]').attributes('aria-pressed')).toBe('true')
  })

  it('mes deducido: ofrece la fecha', () => {
    const w = mountResolver(activityRow({ issues: ['month_inferred'], needs_action: true }))
    expect(w.find('[data-test="resolver-date"]').exists()).toBe(true)
  })

  it('duplicado seguro recuperado: resolutor con Sustituir', async () => {
    const w = mountResolver(
      activityRow({ match: { ...dupMatch, status: 'duplicate' }, action: 'create' })
    )
    expect(w.get('[data-test="resolver-duplicate"]').text()).toContain(
      '¿Es la misma que Show WiZink (jue 3 dic 21:00)?'
    )
    await w.get('[data-test="resolver-dup-replace"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', action: 'replace', reviewed: true }]])
  })

  it('posible duplicado sin hora: sin paréntesis vacíos', () => {
    const w = mountResolver(
      activityRow({ match: { ...dupMatch, activity_scheduled_at: null }, needs_action: true })
    )
    const text = w.get('[data-test="resolver-duplicate"]').text()
    expect(text).toContain('¿Es la misma que Show WiZink?')
    expect(text).not.toContain('()')
  })

  it('repetida dentro de lo importado: texto propio y sin Sustituir', () => {
    const row = activityRow({
      action: 'create',
      duplicate_of: 'a0',
      match: {
        ...dupMatch,
        status: 'duplicate_in_draft',
        activity_uuid: null,
        activity_title: null,
        activity_scheduled_at: null,
      },
    })
    let w = mountResolver(row, { duplicateOfTitle: 'Vuelo IB3456' })
    const text = w.get('[data-test="resolver-duplicate"]').text()
    expect(text).toContain('Parece repetida de Vuelo IB3456')
    expect(text).not.toContain('()')
    expect(w.find('[data-test="resolver-dup-replace"]').exists()).toBe(false)
    w = mountResolver(row)
    expect(w.get('[data-test="resolver-duplicate"]').text()).toContain(
      'Parece repetida de otra fila de lo importado'
    )
  })
})
