import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import AddActivityModal from './AddActivityModal.vue'

function mountModal(props: { canImport?: boolean } = {}) {
  return mount(AddActivityModal, {
    props: { show: true, ...props },
    global: { plugins: [i18n], stubs: { transition: false } },
  })
}

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('AddActivityModal (F2 A1-A4)', () => {
  it('sin canImport: solo Manual, textos por i18n', () => {
    const w = mountModal()
    expect(w.text()).toContain('Añadir actividad')
    expect(w.text()).toContain('Elige cómo quieres añadir la actividad')
    expect(w.find('[data-test="add-activity-cal"]').exists()).toBe(false)
    expect(w.find('[data-test="add-activity-manual"]').text()).toContain('Crear con el formulario')
    expect(w.find('[data-test="add-activity-file"]').exists()).toBe(false)
  })

  it('con canImport: tercera opción "Archivo o foto" que emite openImport', async () => {
    const w = mountModal({ canImport: true })
    const file = w.get('[data-test="add-activity-file"]')
    expect(file.text()).toContain('Archivo o foto')
    expect(file.text()).toContain('Itinerario, PDF, Excel o foto')
    const continueBtn = w.get('[data-test="add-activity-continue"]')
    expect(continueBtn.attributes('disabled')).toBeDefined()
    await file.trigger('click')
    expect(file.attributes('aria-checked')).toBe('true')
    await continueBtn.trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.emitted('openImport')).toHaveLength(1)
    expect(w.emitted('openCreate')).toBeUndefined()
  })

  it('Manual sigue emitiendo openCreate', async () => {
    const w = mountModal({ canImport: true })
    await w.get('[data-test="add-activity-manual"]').trigger('click')
    await w.get('[data-test="add-activity-continue"]').trigger('click')
    expect(w.emitted('openCreate')).toHaveLength(1)
  })

  it('F5a (P-F5-4): la opción Google Calendar no se pinta hasta F5b', () => {
    for (const canImport of [false, true]) {
      const w = mountModal({ canImport })
      expect(w.find('[data-test="add-activity-cal"]').exists()).toBe(false)
      expect(w.text()).not.toContain(i18n.global.t('activities.add.google'))
      expect(w.findAll('[role="radio"]')).toHaveLength(canImport ? 2 : 1)
    }
  })

  it('en inglés y con el botón de cerrar a 44 px en móvil', () => {
    i18n.global.locale.value = 'en'
    const w = mountModal({ canImport: true })
    expect(w.text()).toContain('Add activity')
    expect(w.text()).toContain('File or photo')
    const close = w.get('[data-test="add-activity-close"]')
    expect(close.classes()).toContain('w-[44px]')
    expect(close.attributes('aria-label')).toBe('Close')
  })
})
