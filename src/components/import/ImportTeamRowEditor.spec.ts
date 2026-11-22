import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { teamRow } from '@/test/importJobs'
import type { ContactRole } from '@/composables/useContactRoles'
import ImportTeamRowEditor from './ImportTeamRowEditor.vue'

const roles = [
  { uuid: 'R1', name: 'Sound Engineer' },
  { uuid: 'R2', name: 'Driver' },
] as ContactRole[]

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('ImportTeamRowEditor', () => {
  it('manda solo los campos cambiados', async () => {
    const w = mount(ImportTeamRowEditor, { props: { row: teamRow(), roles }, global: { plugins: [i18n] } })
    expect(w.get('[data-test="editor-save"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="editor-phone"]').setValue('+52 55 1234 5678')
    await w.get('[data-test="editor-role"]').setValue('R2')
    await w.get('form').trigger('submit')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 't1', fields: { phone: '+52 55 1234 5678', role_uuid: 'R2' } }],
    ])
  })

  it('"Dar por buena" en una fila por resolver; en el grupo bloqueado si ya está', async () => {
    const row = teamRow({ needs_action: true, already_in_group: true, phone_raw: '611', phone: null })
    const w = mount(ImportTeamRowEditor, { props: { row, roles }, global: { plugins: [i18n] } })
    expect(w.get('[data-test="editor-in-group"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="editor-save-reviewed"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 't1', reviewed: true }]])
  })
})
