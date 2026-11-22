import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { activityRow } from '@/test/importJobs'
import ImportActivityEditor from './ImportActivityEditor.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('ImportActivityEditor', () => {
  it('solo manda los campos cambiados (vuelo: número de vuelo)', async () => {
    const w = mount(ImportActivityEditor, {
      props: { row: activityRow(), types: [{ code: 'flight', name: 'Vuelo', color: null }] },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-test="activity-editor-hotel"]').exists()).toBe(false)
    await w.get('[data-test="activity-editor-flight"]').setValue('IB3457')
    await w.get('[data-test="activity-editor-end"]').setValue('')
    await w.get('form').trigger('submit')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 'a1', fields: { flight_number: 'IB3457', end_time: null } }],
    ])
  })

  it('hotel y "Guardar y dar por buena" con la fila pendiente', async () => {
    const w = mount(ImportActivityEditor, {
      props: {
        row: activityRow({
          activity_type_code: 'hotel_checkin',
          type_name: 'Check-in',
          metadata: { hotel_name: 'NH' },
          needs_action: true,
        }),
      },
      global: { plugins: [i18n] },
    })
    await w.get('[data-test="activity-editor-hotel"]').setValue('NH Collection')
    await w.get('[data-test="activity-editor-save-reviewed"]').trigger('click')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 'a1', fields: { hotel_name: 'NH Collection' }, reviewed: true }],
    ])
  })

  it('sin título no guarda', async () => {
    const w = mount(ImportActivityEditor, {
      props: { row: activityRow() },
      global: { plugins: [i18n] },
    })
    await w.get('[data-test="activity-editor-title"]').setValue('  ')
    expect(w.get('[data-test="activity-editor-save"]').attributes('disabled')).toBeDefined()
    await w.get('form').trigger('submit')
    expect(w.emitted('patch')).toBeUndefined()
  })

  it('un supuesto que recalcula la fila no borra lo escrito; toma lo que cambió y no se tocó', async () => {
    const w = mount(ImportActivityEditor, {
      props: { row: activityRow(), types: [{ code: 'flight', name: 'Vuelo', color: null }] },
      global: { plugins: [i18n] },
    })
    await w.get('[data-test="activity-editor-notes"]').setValue('Llevar pasaporte')
    await w.get('[data-test="activity-editor-flight"]').setValue('IB3457')
    // El servidor recalcula la fila (p. ej. cambia el año): otra fecha y otra zona.
    await w.setProps({
      row: activityRow({ date: '2027-12-03', timezone: 'Europe/London', metadata: { flight_number: 'IB9999' } }),
    })
    expect((w.get('[data-test="activity-editor-notes"]').element as HTMLTextAreaElement).value).toBe(
      'Llevar pasaporte'
    )
    // Tocado por el usuario: se queda lo suyo aunque el servidor también lo cambie.
    expect((w.get('[data-test="activity-editor-flight"]').element as HTMLInputElement).value).toBe('IB3457')
    // No tocado: llega lo del servidor.
    expect((w.get('[data-test="activity-editor-date"]').element as HTMLInputElement).value).toBe('2027-12-03')
    expect((w.get('[data-test="activity-editor-timezone"]').element as HTMLSelectElement).value).toBe(
      'Europe/London'
    )
    // Otra fila: parte de cero.
    await w.setProps({ row: activityRow({ client_id: 'a9', notes: '' }) })
    expect((w.get('[data-test="activity-editor-notes"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('maxlength como el backend', () => {
    const w = mount(ImportActivityEditor, {
      props: { row: activityRow(), types: [{ code: 'flight', name: 'Vuelo', color: null }] },
      global: { plugins: [i18n] },
    })
    const max = (sel: string) => w.get(sel).attributes('maxlength')
    expect(max('[data-test="activity-editor-flight"]')).toBe('12')
    expect(max('[data-test="activity-editor-booking"]')).toBe('50')
    expect(max('[data-test="activity-editor-location-address"]')).toBe('500')
    expect(max('[data-test="activity-editor-destination-address"]')).toBe('500')
    const hotel = mount(ImportActivityEditor, {
      props: { row: activityRow({ activity_type_code: 'hotel_checkin', type_name: 'Check-in' }) },
      global: { plugins: [i18n] },
    })
    expect(hotel.get('[data-test="activity-editor-hotel"]').attributes('maxlength')).toBe('200')
    expect(hotel.get('[data-test="activity-editor-confirmation"]').attributes('maxlength')).toBe('50')
  })

  it('"Dar por buena" solo con fecha y hora (o "Todo el día")', async () => {
    const w = mount(ImportActivityEditor, {
      props: {
        row: activityRow({ start_time: null, end_time: null, scheduled_at: null, needs_action: true }),
      },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-test="activity-editor-save-reviewed"]').exists()).toBe(false)
    await w.get('[data-test="activity-editor-all-day"]').setValue(true)
    expect(w.find('[data-test="activity-editor-save-reviewed"]').exists()).toBe(true)
    await w.get('[data-test="activity-editor-all-day"]').setValue(false)
    await w.get('[data-test="activity-editor-start"]').setValue('21:00')
    expect(w.find('[data-test="activity-editor-save-reviewed"]').exists()).toBe(true)
  })
})
