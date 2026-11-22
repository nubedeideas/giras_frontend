import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { teamRow } from '@/test/importJobs'
import ImportMatchResolver from './ImportMatchResolver.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

const suggestion = teamRow({
  client_id: 't5',
  needs_action: true,
  match: {
    status: 'name_suggestion',
    by: null,
    contact_uuid: null,
    contact_name: null,
    contact_phone: null,
    candidates: [
      { contact_uuid: 'C1', contact_name: 'Juan Pérez', contact_phone: '+34600111222' },
      { contact_uuid: 'C2', contact_name: 'Juan Pérez Gil', contact_phone: null },
    ],
  },
})

describe('ImportMatchResolver', () => {
  it('"Es {name}" → link + link_contact_uuid, con el teléfono', async () => {
    const w = mount(ImportMatchResolver, { props: { row: suggestion }, global: { plugins: [i18n] } })
    const buttons = w.findAll('[data-test="import-row-link"]')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toContain('Es Juan Pérez')
    expect(buttons[0].text()).toContain('(+34600111222)')
    await buttons[1].trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 't5', action: 'link', link_contact_uuid: 'C2' }]])
  })

  it('"Es otra persona" → create + reviewed', async () => {
    const w = mount(ImportMatchResolver, { props: { row: suggestion }, global: { plugins: [i18n] } })
    await w.get('[data-test="import-row-other"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 't5', action: 'create', reviewed: true }]])
  })

  it('multiple_matches: marca el contacto vinculado; sin candidatos no pinta nada', () => {
    const row = teamRow({
      action: 'link',
      issues: ['multiple_matches'],
      match: {
        status: 'existing',
        by: 'phone',
        contact_uuid: 'C1',
        contact_name: 'Ana',
        contact_phone: null,
        candidates: [{ contact_uuid: 'C2', contact_name: 'Ana B', contact_phone: null }],
      },
    })
    const w = mount(ImportMatchResolver, { props: { row }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('Varios contactos coinciden')
    expect(w.get('[data-contact="C1"]').attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-contact="C2"]').attributes('aria-pressed')).toBe('false')
    const none = mount(ImportMatchResolver, { props: { row: teamRow() }, global: { plugins: [i18n] } })
    expect(none.find('[data-test="import-match-resolver"]').exists()).toBe(false)
  })
})
