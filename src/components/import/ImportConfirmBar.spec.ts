import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import type { ImportSummary } from '@/composables/useImportJobs'
import ImportConfirmBar from './ImportConfirmBar.vue'

const summary = (o: Partial<ImportSummary> = {}): ImportSummary => ({
  total: 6,
  to_create: 3,
  to_link: 2,
  to_skip: 1,
  in_group: 4,
  needs_action: 0,
  without_phone: 0,
  not_mobile: 0,
  ...o,
})

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('ImportConfirmBar', () => {
  it('resumen, "Confirmar (N)" en móvil y emite confirmar', async () => {
    const w = mount(ImportConfirmBar, {
      props: { summary: summary(), canConfirm: true },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm-summary"]').text()).toBe(
      'Nuevos: 3 · Vinculados: 2 · En el Equipo de la gira: 4 · Omitidos: 1'
    )
    expect(w.get('[data-test="import-confirm"]').text()).toContain('Confirmar (5)')
    await w.get('[data-test="import-confirm"]').trigger('click')
    await w.get('[data-test="import-discard"]').trigger('click')
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('discard')).toHaveLength(1)
  })

  it('desactivado con el motivo si quedan filas por resolver', () => {
    const w = mount(ImportConfirmBar, {
      props: { summary: summary({ needs_action: 2 }), canConfirm: false },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="import-confirm-reason"]').text()).toBe(
      'Resuelve las filas en rojo u omítelas para confirmar'
    )
  })
})
