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

  it('F2: con actividades, resumen conjunto, "Revisar avisos (N)" y emite notices', async () => {
    const w = mount(ImportConfirmBar, {
      props: {
        summary: summary({
          activities: {
            total: 12,
            to_create: 9,
            to_replace: 1,
            to_skip: 2,
            needs_action: 0,
            duplicates: 2,
            possible_duplicates: 0,
            outside_tour: 0,
            in_past: 0,
            by_type: {},
            days: 4,
          },
        }),
        canConfirm: true,
        mode: 'notices',
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm-summary-all"]').text()).toBe(
      'Se crearán 3 contactos y 9 actividades (2 omitidas, 1 sustituidas)'
    )
    expect(w.find('[data-test="import-confirm-summary"]').exists()).toBe(false)
    const btn = w.get('[data-test="import-confirm"]')
    expect(btn.attributes('data-mode')).toBe('notices')
    // 3 nuevos + 2 vinculados + 9 actividades + 1 sustituida.
    expect(btn.text()).toContain('Revisar avisos (15)')
    await btn.trigger('click')
    expect(w.emitted('notices')).toHaveLength(1)
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('F2: bloqueado por actividades pendientes aunque el equipo esté listo', () => {
    const w = mount(ImportConfirmBar, {
      props: { summary: summary(), canConfirm: false, pending: 2 },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm-reason"]').text()).toBe(
      'Resuelve las filas en rojo u omítelas para confirmar'
    )
  })

  it('F2: modo notices sin actividades: resumen F1 y "Ver avisos →"', async () => {
    const w = mount(ImportConfirmBar, {
      props: { summary: summary(), canConfirm: true, mode: 'notices' },
      global: { plugins: [i18n] },
    })
    // Solo equipo que entra al grupo: también pasa por el paso de avisos.
    expect(w.find('[data-test="import-confirm-summary-all"]').exists()).toBe(false)
    expect(w.find('[data-test="import-confirm-summary"]').exists()).toBe(true)
    const btn = w.get('[data-test="import-confirm"]')
    expect(btn.find('.hidden.lg\\:inline').text()).toBe('Ver avisos →')
    expect(btn.find('.lg\\:hidden').text()).toBe('Revisar avisos (5)')
    await btn.trigger('click')
    expect(w.emitted('notices')).toHaveLength(1)
    expect(w.emitted('confirm')).toBeUndefined()
  })
})
