import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import {
  calendarActivityRow,
  calendarCancelledRow,
  calendarChangedRow,
  jobSheet,
  sheetActivityRow,
  sheetChangedRow,
  sheetLinkRow,
  sheetRemovedRow,
} from '@/test/importActivities'
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

  describe('filas de calendario (F3)', () => {
    it('"Calendario" como origen y "Del calendario" como origen de la zona', () => {
      const w = mountRow({
        row: calendarActivityRow({ timezone: 'America/Mexico_City', timezone_source: 'ics' }),
      })
      expect(w.text()).toContain('Calendario')
      expect(w.text()).not.toContain('p3:L14')
      expect(w.get('[data-test="import-activity-zone"]').attributes('title')).toBe(
        'America/Mexico_City · Del calendario'
      )
    })

    it('F5a: una fila de día completo no muestra la zona (UTC del calendario) aunque difiera', () => {
      const w = mountRow({
        row: calendarActivityRow({
          all_day: true,
          start_time: null,
          timezone: 'UTC',
          timezone_source: 'ics_calendar',
        }),
      })
      expect(w.find('[data-test="import-activity-zone"]').exists()).toBe(false)
      expect(w.text()).not.toContain('UTC')
      expect(w.get('[data-test="import-activity-time"]').text()).toBe('Todo el día')
    })

    it('cambió en el calendario: insignia scheduled; omitida se recupera con replace', async () => {
      let w = mountRow({ row: calendarChangedRow() })
      const badge = w.get('[data-test="import-activity-status"]')
      expect(badge.attributes('data-status')).toBe('scheduled')
      expect(badge.text()).toBe('Cambió en el calendario → se actualizará')
      w = mountRow({ row: calendarChangedRow({ needs_action: true }, { conflict: true }) })
      expect(w.get('[data-test="import-activity-status"]').attributes('data-status')).toBe('pending')
      expect(w.get('[data-test="import-activity-status"]').text()).toBe(
        'Cambió en el calendario y en Giras'
      )
      w = mountRow({ row: calendarChangedRow({ action: 'skip' }) })
      await w.get('[data-test="import-activity-restore"]').trigger('click')
      expect(w.emitted('patch')![0][0]).toEqual({ client_id: 'a5', action: 'replace', reviewed: true })
    })

    it('cancelada en el calendario: pendiente, sin Editar ni Omitir y sin tachar', () => {
      const w = mountRow({ row: calendarCancelledRow() })
      expect(w.get('li').attributes('data-needs-action')).toBe('true')
      const badge = w.get('[data-test="import-activity-status"]')
      expect(badge.attributes('data-status')).toBe('pending')
      expect(badge.text()).toBe('Cancelada en el calendario')
      expect(w.find('[data-test="import-activity-edit"]').exists()).toBe(false)
      expect(w.find('[data-test="import-activity-skip"]').exists()).toBe(false)
      expect(w.find('[data-test="import-activity-restore"]').exists()).toBe(false)
      expect(w.get('[data-test="import-activity-title"]').classes()).not.toContain('line-through')
      expect(w.find('[data-test="import-activity-confidence"]').exists()).toBe(false)
      // Retirada del feed: "Ya no está en el calendario".
      const removed = mountRow({ row: calendarCancelledRow(), removed: true })
      expect(removed.get('[data-test="import-activity-status"]').text()).toBe(
        'Ya no está en el calendario'
      )
    })

    it('"Se cancelará": insignia failed y título tachado', () => {
      const w = mountRow({
        row: calendarCancelledRow({ action: 'cancel', needs_action: false, reviewed: true }),
      })
      const badge = w.get('[data-test="import-activity-status"]')
      expect(badge.attributes('data-status')).toBe('failed')
      expect(badge.text()).toBe('Se cancelará')
      expect(w.get('[data-test="import-activity-title"]').classes()).toContain('line-through')
      expect(w.get('li').attributes('data-needs-action')).toBe('false')
    })

    it('issue checkout_inferred traducido', () => {
      const w = mountRow({ row: calendarActivityRow({ issues: ['checkout_inferred'] }) })
      expect(w.text()).toContain('Salida deducida del fin del evento')
    })

    it('cancelación sin actividad viva: sin Recuperar ni Editar, "La actividad ya no existe"', () => {
      const base = calendarCancelledRow()
      // Retirada del feed (`r<n>`) cuya actividad se canceló en Giras: llega como `duplicate`.
      const duplicate = mountRow({
        row: calendarActivityRow({
          action: 'skip',
          source_ref: { ...base.source_ref, row: 'r1' },
          match: { ...base.match, status: 'duplicate' },
        }),
      })
      // Evento CANCELLED cuya actividad ya no existe: `new` por `uid`.
      const gone = mountRow({
        row: calendarActivityRow({
          action: 'skip',
          match: { ...base.match, status: 'new', by: 'uid', activity_uuid: null },
        }),
      })
      for (const w of [duplicate, gone]) {
        expect(w.get('[data-test="import-activity-gone"]').text()).toBe(
          'La actividad ya no existe en la gira'
        )
        expect(w.find('[data-test="import-activity-restore"]').exists()).toBe(false)
        expect(w.find('[data-test="import-activity-skip"]').exists()).toBe(false)
        expect(w.find('[data-test="import-activity-edit"]').exists()).toBe(false)
        expect(w.find('[data-test="import-activity-status"]').exists()).toBe(false)
        expect(w.get('[data-test="import-activity-title"]').classes()).not.toContain('line-through')
        // "Ver origen" sigue.
        expect(w.find('[data-test="import-activity-peek"]').exists()).toBe(true)
      }
      // Un duplicado normal del calendario (`e<n>`) sigue pudiendo recuperarse.
      const normal = mountRow({
        row: calendarActivityRow({ action: 'skip', match: { ...base.match, status: 'duplicate' } }),
      })
      expect(normal.find('[data-test="import-activity-gone"]').exists()).toBe(false)
      expect(normal.find('[data-test="import-activity-restore"]').exists()).toBe(true)
    })
  })
})

describe('ImportActivityRow · hoja de Google (F4)', () => {
  it('origen "Hoja de Google · pestaña · fila" y "Ver origen" con el enlace a la celda', async () => {
    const w = mountRow({ row: sheetActivityRow(), sheet: jobSheet() })
    expect(w.text()).toContain('Hoja de Google · Itinerario · fila 14')
    expect(w.text()).not.toContain('Hoja1!14')
    await w.get('[data-test="import-activity-peek"]').trigger('click')
    expect(w.get('[data-test="import-source-where"]').text()).toBe(
      'Gira 2027 · Producción · Itinerario · fila 14'
    )
    expect(w.get('[data-test="import-source-sheet-open"]').attributes('href')).toBe(
      'https://docs.google.com/spreadsheets/d/abc123/edit#gid=123&range=A14'
    )
  })

  it('sin open_url (otro admin) no hay enlace a la hoja', async () => {
    const w = mountRow({ row: sheetActivityRow(), sheet: jobSheet({ open_url: null }) })
    await w.get('[data-test="import-activity-peek"]').trigger('click')
    expect(w.find('[data-test="import-source-sheet-open"]').exists()).toBe(false)
  })

  it('cambió en la hoja: insignia scheduled y, con conflicto, pending', () => {
    let w = mountRow({ row: sheetChangedRow() })
    let badge = w.get('[data-test="import-activity-status"]')
    expect(badge.attributes('data-status')).toBe('scheduled')
    expect(badge.text()).toBe('Cambió en la hoja → se actualizará')
    w = mountRow({ row: sheetChangedRow({ needs_action: true }, { conflict: true }) })
    badge = w.get('[data-test="import-activity-status"]')
    expect(badge.attributes('data-status')).toBe('pending')
    expect(badge.text()).toBe('Cambió en la hoja y en Giras')
  })

  it('ya no está en la hoja: pending, sin Editar ni Omitir; slot_gone con su texto; cancel en failed', () => {
    let w = mountRow({ row: sheetRemovedRow() })
    const badge = w.get('[data-test="import-activity-status"]')
    expect(badge.attributes('data-status')).toBe('pending')
    expect(badge.text()).toBe('Ya no está en la hoja')
    expect(w.find('[data-test="import-activity-edit"]').exists()).toBe(false)
    expect(w.find('[data-test="import-activity-skip"]').exists()).toBe(false)
    expect(w.find('[data-test="import-activity-restore"]').exists()).toBe(false)
    expect(w.get('[data-test="import-activity-title"]').classes()).not.toContain('line-through')
    w = mountRow({ row: sheetRemovedRow('slot_gone') })
    expect(w.get('[data-test="import-activity-status"]').text()).toBe(
      'La fila ya no incluye esta actividad'
    )
    w = mountRow({ row: sheetRemovedRow('row_removed', { action: 'cancel', needs_action: false }) })
    expect(w.get('[data-test="import-activity-status"]').attributes('data-status')).toBe('failed')
    expect(w.get('[data-test="import-activity-title"]').classes()).toContain('line-through')
  })

  it('se vinculará: insignia sent, sin tachar, sin Editar ni Omitir/Recuperar', () => {
    const w = mountRow({ row: sheetLinkRow() })
    const badge = w.get('[data-test="import-activity-status"]')
    expect(badge.attributes('data-status')).toBe('sent')
    expect(badge.text()).toBe('Ya está en la gira → se vinculará a la hoja')
    expect(w.get('[data-test="import-activity-title"]').classes()).not.toContain('line-through')
    expect(w.find('[data-test="import-activity-edit"]').exists()).toBe(false)
    expect(w.find('[data-test="import-activity-skip"]').exists()).toBe(false)
    expect(w.find('[data-test="import-activity-restore"]').exists()).toBe(false)
  })
})

describe('ImportActivityRow · deslizar para omitir (F5a)', () => {
  type W = ReturnType<typeof mountRow>

  /** Arrastre con el dedo sobre la tarjeta (jsdom no mide: el ancho sale de `innerWidth`). */
  async function swipe(w: W, from: number, to: number, pointerType = 'touch') {
    const el = w.get('[data-test="import-swipe-content"]')
    await el.trigger('pointerdown', { pointerType, clientX: from, clientY: 100 })
    await el.trigger('pointermove', { pointerType, clientX: (from + to) / 2, clientY: 101 })
    await el.trigger('pointermove', { pointerType, clientX: to, clientY: 101 })
    await el.trigger('pointerup', { pointerType, clientX: to, clientY: 101 })
  }

  beforeEach(() => {
    vi.stubGlobal('innerWidth', 375)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a la izquierda omite (omit + patch skip), igual que el botón', async () => {
    const w = mountRow()
    await swipe(w, 300, 100)
    expect(w.emitted('omit')?.[0]?.[0]).toMatchObject({ client_id: 'a1' })
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', action: 'skip' }]])
  })

  it('el botón Omitir lleva el título en aria-label y emite lo mismo', async () => {
    const w = mountRow()
    const btn = w.get('[data-test="import-activity-skip"]')
    expect(btn.attributes('aria-label')).toBe(`Omitir: ${activityRow().title}`)
    await btn.trigger('click')
    expect(w.emitted('omit')).toHaveLength(1)
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', action: 'skip' }]])
  })

  it('en una omitida, a la derecha recupera (sin omit)', async () => {
    const w = mountRow({ row: activityRow({ action: 'skip' }) })
    await swipe(w, 50, 300)
    expect(w.emitted('omit')).toBeUndefined()
    expect(w.emitted('patch')).toEqual([[{ client_id: 'a1', action: 'create' }]])
  })

  it('con ratón, recorrido corto o en escritorio no hace nada', async () => {
    const w = mountRow()
    await swipe(w, 300, 100, 'mouse')
    await swipe(w, 300, 290)
    vi.stubGlobal('innerWidth', 1280)
    await swipe(w, 300, 100)
    expect(w.emitted('patch')).toBeUndefined()
  })

  it('no se aplica a cancelaciones del calendario ni a filas que se vincularán', async () => {
    for (const row of [calendarCancelledRow(), sheetLinkRow()]) {
      const w = mountRow({ row })
      await swipe(w, 300, 50)
      expect(w.emitted('patch')).toBeUndefined()
      expect(w.emitted('omit')).toBeUndefined()
    }
  })
})
