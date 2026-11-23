import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import {
  activityJob,
  calendarCancelledRow,
  calendarChangedRow,
  sheetChangedRow,
  sheetLinkRow,
  sheetRemovedRow,
} from '@/test/importActivities'
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

describe('ImportActivityResolver · calendario (F3)', () => {
  it('cambió en el calendario: cambios antes → ahora en font-time y "Actualizar" elegido', async () => {
    const w = mountResolver(
      calendarChangedRow(
        {},
        { changed_fields: ['scheduled_at', 'title', 'location_name'], activity_title: 'Show MAD' }
      )
    )
    const block = w.get('[data-test="resolver-calendar-change"]')
    expect(block.text()).toContain('Cambió en el calendario')
    expect(w.find('[data-test="resolver-calendar-conflict"]').exists()).toBe(false)
    const start = w.get('[data-change="scheduled_at"]')
    expect(start.text()).toContain('Inicio:')
    expect(start.text()).toContain('jue 3 dic 20:00')
    expect(start.text()).toContain('→')
    expect(start.text()).toContain('jue 3 dic 21:00')
    expect(start.findAll('.font-time.tnum')).toHaveLength(2)
    expect(w.get('[data-change="title"]').text()).toBe('Título: Show MAD → Show Madrid')
    expect(w.get('[data-change="location_name"]').text()).toBe('Lugar: WiZink Center')
    const update = w.get('[data-test="resolver-calendar-update"]')
    expect(update.text()).toBe('Actualizar')
    expect(update.attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-test="resolver-calendar-keep"]').text()).toBe('Mantener la de Giras')
    await w.get('[data-test="resolver-calendar-keep"]').trigger('click')
    await update.trigger('click')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 'a5', action: 'skip' }],
      [{ client_id: 'a5', action: 'replace', reviewed: true }],
    ])
    // Sin "Dar por buena" ni duplicado: lo decide su bloque.
    expect(w.find('[data-test="resolver-reviewed"]').exists()).toBe(false)
    expect(w.find('[data-test="resolver-duplicate"]').exists()).toBe(false)
  })

  it('fin y lugar sin "antes" en match: solo el "ahora", sin flecha; sin dato, "—"', () => {
    const w = mountResolver(
      calendarChangedRow({ location_name: '' }, { changed_fields: ['end_at', 'location_name'] })
    )
    const end = w.get('[data-change="end_at"]')
    expect(end.text()).toBe('Fin: jue 3 dic 23:00')
    expect(end.text()).not.toContain('→')
    expect(end.find('[data-test="change-before"]').exists()).toBe(false)
    expect(end.get('[data-test="change-after"]').classes()).toEqual(
      expect.arrayContaining(['font-time', 'tnum'])
    )
    expect(w.get('[data-change="location_name"]').text()).toBe('Lugar: —')
    const noEnd = mountResolver(
      calendarChangedRow({ end_at: null }, { changed_fields: ['end_at'] })
    )
    expect(noEnd.get('[data-change="end_at"]').text()).toBe('Fin: —')
    // Inicio sin hora previa en match: solo el "ahora".
    const noBefore = mountResolver(calendarChangedRow({}, { activity_scheduled_at: null }))
    expect(noBefore.get('[data-change="scheduled_at"]').text()).toBe('Inicio: jue 3 dic 21:00')
  })

  it('con conflicto: aviso y ninguna opción preseleccionada', () => {
    const w = mountResolver(calendarChangedRow({ needs_action: true }, { conflict: true }))
    expect(w.get('[data-test="resolver-calendar-conflict"]').text()).toBe(
      'La cambiaste en Giras después de importarla'
    )
    expect(w.get('[data-test="resolver-calendar-update"]').attributes('aria-pressed')).toBe('false')
    expect(w.get('[data-test="resolver-calendar-keep"]').attributes('aria-pressed')).toBe('false')
    expect(w.get('[data-test="import-activity-resolver"]').classes()).toContain('border-failed-fg')
    expect(w.find('[data-test="resolver-reviewed"]').exists()).toBe(false)
  })

  it('cancelada en el calendario: emite cancel (revisada) o skip, sin editor', async () => {
    const w = mountResolver(calendarCancelledRow())
    const block = w.get('[data-test="resolver-calendar-cancel"]')
    expect(block.text()).toContain('Cancelada en el calendario')
    expect(w.get('[data-test="resolver-calendar-cancel-activity"]').text()).toContain('Prueba de sonido')
    expect(
      w.get('[data-test="resolver-calendar-cancel-activity"] .font-time').text()
    ).toContain('jue 3 dic 16:00')
    // Ninguna elegida mientras pide decisión ("Mantener" es el skip por defecto del servidor).
    expect(w.get('[data-test="resolver-calendar-cancel-keep"]').attributes('aria-pressed')).toBe('false')
    expect(w.find('[data-test="resolver-type"]').exists()).toBe(false)
    expect(w.find('[data-test="resolver-date"]').exists()).toBe(false)
    expect(w.find('[data-test="resolver-reviewed"]').exists()).toBe(false)
    await w.get('[data-test="resolver-calendar-cancel-activity-btn"]').trigger('click')
    await w.get('[data-test="resolver-calendar-cancel-keep"]').trigger('click')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 'a6', action: 'cancel', reviewed: true }],
      [{ client_id: 'a6', action: 'skip' }],
    ])
  })

  it('retirada del feed: "Ya no está en el calendario"; elegida, se marca', () => {
    let w = mountResolver(calendarCancelledRow(), { removed: true })
    expect(w.get('[data-test="resolver-calendar-cancel"]').text()).toContain(
      'Ya no está en el calendario'
    )
    w = mountResolver(calendarCancelledRow({ action: 'cancel', needs_action: false }))
    expect(
      w.get('[data-test="resolver-calendar-cancel-activity-btn"]').attributes('aria-pressed')
    ).toBe('true')
    w = mountResolver(calendarCancelledRow({ needs_action: false }))
    expect(w.get('[data-test="resolver-calendar-cancel-keep"]').attributes('aria-pressed')).toBe('true')
  })
})

describe('ImportActivityResolver · hoja de Google (F4)', () => {
  it('"Cambió en la hoja" con conflicto: Actualizar · Mantener la de Giras', async () => {
    const w = mountResolver(sheetChangedRow({ needs_action: true }, { conflict: true }))
    const block = w.get('[data-test="resolver-calendar-change"]')
    expect(block.text()).toContain('Cambió en la hoja')
    expect(block.text()).not.toContain('calendario')
    expect(w.get('[data-test="resolver-calendar-conflict"]').text()).toBe(
      'La cambiaste en Giras después de importarla'
    )
    await w.get('[data-test="resolver-calendar-update"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 's1', action: 'replace', reviewed: true }]])
  })

  it('"Ya no está en la hoja" y "La fila ya no incluye esta actividad": Cancelar actividad · Mantener', async () => {
    let w = mountResolver(sheetRemovedRow())
    let block = w.get('[data-test="resolver-calendar-cancel"]')
    expect(block.text()).toContain('Ya no está en la hoja')
    expect(block.text()).toContain('Prueba de sonido')
    await w.get('[data-test="resolver-calendar-cancel-activity-btn"]').trigger('click')
    await w.get('[data-test="resolver-calendar-cancel-keep"]').trigger('click')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 's2', action: 'cancel', reviewed: true }],
      [{ client_id: 's2', action: 'skip' }],
    ])
    w = mountResolver(sheetRemovedRow('slot_gone'))
    block = w.get('[data-test="resolver-calendar-cancel"]')
    expect(block.text()).toContain('La fila ya no incluye esta actividad')
    // Sin editor: ni tipo, ni fecha, ni hora.
    expect(w.find('[data-test="resolver-type"]').exists()).toBe(false)
    expect(w.find('[data-test="resolver-time"]').exists()).toBe(false)
  })

  it('se vinculará: Vincular marcado; "No vincular" crea como nueva', async () => {
    const w = mountResolver(sheetLinkRow())
    const block = w.get('[data-test="resolver-sheet-link"]')
    expect(block.text()).toContain('Ya está en la gira')
    expect(w.get('[data-test="resolver-sheet-link-activity"]').text()).toContain('Show Madrid')
    expect(w.get('[data-test="resolver-sheet-link-help"]').text()).toContain('la vincularemos a la hoja')
    expect(w.get('[data-test="resolver-sheet-link-btn"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test="resolver-duplicate"]').exists()).toBe(false)
    await w.get('[data-test="resolver-sheet-unlink"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 's3', action: 'create', reviewed: true }]])
  })

  it('"No vincular" elegido: se puede volver a Vincular (skip)', async () => {
    const w = mountResolver(sheetLinkRow({ action: 'create', reviewed: true }))
    expect(w.get('[data-test="resolver-sheet-unlink"]').attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-test="resolver-sheet-link-help"]').text()).toContain('actividad nueva')
    expect(w.find('[data-test="resolver-duplicate"]').exists()).toBe(false)
    await w.get('[data-test="resolver-sheet-link-btn"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 's3', action: 'skip' }]])
  })
})
