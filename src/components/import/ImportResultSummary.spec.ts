import { beforeEach, describe, expect, it } from 'vitest'
import type { ImportResult } from '@/composables/useImportJobs'
import { mount, RouterLinkStub } from '@vue/test-utils'
import i18n from '@/i18n'
import ImportResultSummary from './ImportResultSummary.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

const result: ImportResult = {
  contacts_created: 3,
  // `contacts_linked` ya incluye `linked_late` (como lo guarda commit_team).
  contacts_linked: 2,
  linked_late: 1,
  already_in_tour: 1,
  added_to_group: 4,
  skipped: 2,
  team_group_uuid: 'G1',
  team_group_is_default: false,
  contact_uuids: [],
}

describe('ImportResultSummary', () => {
  it('recuentos, aviso de grupo por defecto ajeno e "Importar más"', async () => {
    const w = mount(ImportResultSummary, {
      props: {
        job: {
          result,
          team_group: { uuid: 'G1', name: 'Equipo de la gira', exists: true, is_default: false, default_group_name: 'Todos' },
        },
      },
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    })
    expect(w.get('[data-test="import-result-summary"]').text()).toBe(
      'Contactos nuevos: 3 · Vinculados: 2 · En el Equipo de la gira: 4'
    )
    expect(w.text()).toContain('1 ya estaba en la gira')
    expect(w.text()).toContain('2 omitidos')
    expect(w.get('[data-test="import-result-not-default"]').text()).toContain('«Todos»')
    expect(w.findComponent(RouterLinkStub).props('to')).toEqual({ name: 'contacts' })
    await w.get('[data-test="import-result-more"]').trigger('click')
    expect(w.emitted('importMore')).toHaveLength(1)
  })

  it('el enlace a contactos usa la clase de BtnPrimary y sin confirmer_in_team no hay aviso', () => {
    const w = mount(ImportResultSummary, {
      props: { job: { result: { ...result, team_group_is_default: true }, team_group: null } },
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    })
    const link = w.get('[data-test="import-result-contacts"]')
    expect(link.classes()).toEqual(expect.arrayContaining(['bg-acid', 'text-night', 'min-h-[44px]']))
    expect(w.find('[data-test="import-result-confirmer-outside"]').exists()).toBe(false)
  })

  it('D10: confirmer_in_team=false avisa de que los avisos solo llegarán en la app', () => {
    const mountWith = (confirmer_in_team: boolean) =>
      mount(ImportResultSummary, {
        props: { job: { result: { ...result, confirmer_in_team }, team_group: null } },
        global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
      })
    expect(mountWith(false).get('[data-test="import-result-confirmer-outside"]').text()).toBe(
      'Tú no estás en el Equipo de la gira: los avisos solo te llegarán en la app.'
    )
    expect(mountWith(true).find('[data-test="import-result-confirmer-outside"]').exists()).toBe(false)
  })
})
