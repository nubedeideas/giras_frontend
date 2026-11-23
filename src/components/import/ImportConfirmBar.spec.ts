import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
      'Contactos nuevos: 3 · Actividades nuevas: 9 · Sustituidas: 1 · Omitidas: 2'
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

describe('ImportConfirmBar · calendario (F3)', () => {
  it('con cancelaciones: "Nuevas: N · Actualizadas: M · Canceladas: K" y cuentan en el botón', async () => {
    const activities = {
      total: 4,
      to_create: 2,
      to_replace: 1,
      to_skip: 0,
      needs_action: 0,
      duplicates: 0,
      possible_duplicates: 0,
      outside_tour: 0,
      in_past: 0,
      by_type: {},
      days: 2,
      to_cancel: 1,
    }
    const w = mount(ImportConfirmBar, {
      props: {
        summary: summary({ to_create: 0, to_link: 0, in_group: 0, activities }),
        canConfirm: true,
        mode: 'notices',
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm-summary-calendar"]').text()).toBe(
      'Nuevas: 2 · Actualizadas: 1 · Canceladas: 1'
    )
    expect(w.find('[data-test="import-confirm-summary-all"]').exists()).toBe(false)
    expect(w.get('[data-test="import-confirm"]').text()).toContain('Revisar avisos (4)')

    const none = mount(ImportConfirmBar, {
      props: { summary: summary({ activities: { ...activities, to_cancel: 0 } }), canConfirm: true },
      global: { plugins: [i18n] },
    })
    expect(none.find('[data-test="import-confirm-summary-calendar"]').exists()).toBe(false)
    expect(none.find('[data-test="import-confirm-summary-all"]').exists()).toBe(true)

    i18n.global.locale.value = 'en'
    await nextTick()
    expect(w.get('[data-test="import-confirm-summary-calendar"]').text()).toBe(
      'New: 2 · Updated: 1 · Cancelled: 1'
    )
  })

  it('borrador de calendario con todo "Mantener": se confirma sin cambios y lo dice', async () => {
    const activities = {
      total: 2,
      to_create: 0,
      to_replace: 0,
      to_skip: 2,
      needs_action: 0,
      duplicates: 0,
      possible_duplicates: 0,
      outside_tour: 0,
      in_past: 0,
      by_type: {},
      days: 1,
      to_cancel: 0,
    }
    const empty = summary({ to_create: 0, to_link: 0, in_group: 0, to_skip: 0, activities })
    const w = mount(ImportConfirmBar, {
      props: { summary: empty, canConfirm: true, calendar: true },
      global: { plugins: [i18n] },
    })
    const hint = w.get('[data-test="import-confirm-reviewed-only"]')
    expect(hint.text()).toBe('Confirmar sin cambios: se da por revisado el calendario.')
    expect(hint.classes()).not.toContain('text-failed-fg')
    expect(w.find('[data-test="import-confirm-reason"]').exists()).toBe(false)
    const btn = w.get('[data-test="import-confirm"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('aria-describedby')).toBe('import-confirm-reviewed-only')
    await btn.trigger('click')
    expect(w.emitted('confirm')).toHaveLength(1)

    // Sin `calendar` (borrador de archivo todo omitido) sigue el motivo de bloqueo.
    const file = mount(ImportConfirmBar, {
      props: { summary: empty, canConfirm: false },
      global: { plugins: [i18n] },
    })
    expect(file.find('[data-test="import-confirm-reviewed-only"]').exists()).toBe(false)
    expect(file.get('[data-test="import-confirm-reason"]').text()).toBe(
      'Has omitido todas las filas: no hay nada que confirmar.'
    )
  })
})

describe('ImportConfirmBar · hoja de Google (F4)', () => {
  const activities = {
    total: 3,
    to_create: 1,
    to_replace: 0,
    to_skip: 2,
    needs_action: 0,
    duplicates: 2,
    possible_duplicates: 0,
    outside_tour: 0,
    in_past: 0,
    by_type: {},
    days: 1,
    to_cancel: 0,
    to_link: 2,
  }

  it('"· se vincularán {n}" y los vínculos cuentan en el botón', async () => {
    const w = mount(ImportConfirmBar, {
      props: {
        summary: summary({ to_create: 0, to_link: 0, in_group: 0, to_skip: 0, activities }),
        canConfirm: true,
        calendar: true,
        sheet: true,
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm-summary-all"]').text()).toBe(
      'Contactos nuevos: 0 · Actividades nuevas: 1 · Sustituidas: 0 · Omitidas: 0 · se vincularán 2'
    )
    expect(w.get('[data-test="import-confirm"]').text()).toContain('Confirmar (3)')
    expect(w.find('[data-test="import-confirm-reviewed-only"]').exists()).toBe(false)
    i18n.global.locale.value = 'en'
    await nextTick()
    expect(w.get('[data-test="import-confirm-summary-all"]').text()).toContain('· 2 will be linked')
  })

  it('las filas que se vinculan no cuentan también como omitidas', () => {
    const w = mount(ImportConfirmBar, {
      props: {
        summary: summary({
          to_create: 0,
          to_link: 0,
          in_group: 0,
          to_skip: 0,
          activities: { ...activities, total: 5, to_skip: 4, to_link: 1 },
        }),
        canConfirm: true,
        calendar: true,
        sheet: true,
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm-summary-all"]').text()).toBe(
      'Contactos nuevos: 0 · Actividades nuevas: 1 · Sustituidas: 0 · Omitidas: 3 · se vinculará 1'
    )
  })

  it('con cancelaciones, el texto de vínculos va tras el de calendario', () => {
    const w = mount(ImportConfirmBar, {
      props: {
        summary: summary({
          to_create: 0,
          to_link: 0,
          in_group: 0,
          activities: { ...activities, to_create: 0, to_cancel: 1, to_link: 1 },
        }),
        canConfirm: true,
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm-summary-calendar"]').text()).toBe(
      'Nuevas: 0 · Actualizadas: 0 · Canceladas: 1 · se vinculará 1'
    )
  })

  it('borrador de hoja con todo "Mantener": "se da por revisada la hoja"', () => {
    const w = mount(ImportConfirmBar, {
      props: {
        summary: summary({
          to_create: 0,
          to_link: 0,
          in_group: 0,
          to_skip: 0,
          activities: { ...activities, to_create: 0, to_link: 0 },
        }),
        canConfirm: true,
        calendar: true,
        sheet: true,
      },
      global: { plugins: [i18n] },
    })
    expect(w.get('[data-test="import-confirm-reviewed-only"]').text()).toBe(
      'Confirmar sin cambios: se da por revisada la hoja.'
    )
    expect(w.find('[data-test="import-confirm-summary-all"]').text()).not.toContain('vincular')
  })
})
