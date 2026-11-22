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
})
