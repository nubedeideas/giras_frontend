import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import AppModal from './AppModal.vue'

describe('AppModal', () => {
  it('un clic en el fondo no emite close', async () => {
    const w = mount(AppModal, { props: { show: true }, slots: { default: '<p>Hola</p>' } })
    const backdrop = w.find('div.fixed')
    expect(backdrop.exists()).toBe(true)
    await backdrop.trigger('click')
    expect(w.emitted('close')).toBeUndefined()
  })

  it('pinta el slot y un botón del contenido cierra el modal desde el padre', async () => {
    const Parent = defineComponent({
      components: { AppModal },
      setup() {
        const open = ref(true)
        return { open }
      },
      template: `
        <AppModal :show="open" @close="open = false">
          <p data-test="body">Contenido</p>
          <button data-test="cancel" @click="open = false">Cancelar</button>
        </AppModal>
      `,
    })
    const w = mount(Parent)
    expect(w.find('[data-test="body"]').text()).toBe('Contenido')
    await w.find('div.fixed').trigger('click')
    expect(w.find('[data-test="body"]').exists()).toBe(true)
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.find('[data-test="body"]').exists()).toBe(false)
  })

  it('con show=false no pinta nada', () => {
    const w = mount(AppModal, { props: { show: false }, slots: { default: '<p>Hola</p>' } })
    expect(w.find('div.fixed').exists()).toBe(false)
    expect(w.text()).toBe('')
  })
})
