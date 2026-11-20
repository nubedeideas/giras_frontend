import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Pill from './Pill.vue'

describe('Pill', () => {
  it('renderiza el slot con la variante neutra por defecto', () => {
    const wrapper = mount(Pill, { slots: { default: 'Confirmada' } })
    expect(wrapper.text()).toBe('Confirmada')
    expect(wrapper.classes()).toContain('bg-glass-2')
  })

  it('aplica la clase de la variante', () => {
    const wrapper = mount(Pill, { props: { variant: 'g' }, slots: { default: 'OK' } })
    expect(wrapper.classes()).toContain('text-acid-muted')
  })
})
