import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import DashboardEmptyTour from './DashboardEmptyTour.vue'

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('DashboardEmptyTour (F2 A5)', () => {
  it('admin: "Importar agenda" principal y "Añadir a mano"', async () => {
    const w = mount(DashboardEmptyTour, { props: { canImport: true }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('Sube el itinerario o el day sheet, o añádelas a mano.')
    const imp = w.get('[data-testid="empty-import"]')
    expect(imp.text()).toBe('Importar agenda')
    expect(imp.classes()).toContain('bg-acid')
    const add = w.get('[data-testid="empty-add"]')
    expect(add.text()).toBe('Añadir a mano')
    expect(add.classes()).not.toContain('bg-acid')
    await imp.trigger('click')
    await add.trigger('click')
    expect(w.emitted('import')).toHaveLength(1)
    expect(w.emitted('add')).toHaveLength(1)
  })

  it('sin admin: sin "Importar agenda" y "Añadir a mano" pasa a principal', () => {
    const w = mount(DashboardEmptyTour, { global: { plugins: [i18n] } })
    expect(w.find('[data-testid="empty-import"]').exists()).toBe(false)
    const add = w.get('[data-testid="empty-add"]')
    expect(add.text()).toBe('Añadir a mano')
    expect(add.classes()).toContain('bg-acid')
    expect(w.text()).not.toContain('Sube el itinerario')
  })

  it('F5a (P-F5-4): "Conectar Google Calendar" no se pinta hasta F5b', () => {
    for (const canImport of [false, true]) {
      const w = mount(DashboardEmptyTour, { props: { canImport }, global: { plugins: [i18n] } })
      expect(w.find('[data-testid="empty-calendar"]').exists()).toBe(false)
      expect(w.text()).not.toContain('Google Calendar')
    }
  })
})
