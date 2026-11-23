import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailPane from './DetailPane.vue'
import MobileDetailOverlay from './MobileDetailOverlay.vue'

// jsdom no calcula layout: se comprueba la cadena de clases que hace que el detalle
// (raíz `flex-1 flex flex-col overflow-hidden` + zona `overflow-y-auto`) tenga altura acotada.
const detail = {
  template:
    '<div data-testid="detail" class="flex-1 flex flex-col overflow-hidden"><div data-testid="scroll" class="flex-1 overflow-y-auto" /></div>',
}

describe('DetailPane', () => {
  it('es un contenedor flex en columna que acota la altura del detalle', () => {
    const w = mount(DetailPane, { slots: { default: detail } })
    const pane = w.get('[data-testid="detail-pane"]')
    for (const cls of ['flex', 'flex-col', 'min-h-0', 'min-w-0', 'overflow-hidden']) {
      expect(pane.classes()).toContain(cls)
    }
    // El detalle es hijo directo del panel, así su flex-1 actúa en vertical.
    expect(w.get('[data-testid="detail"]').element.parentElement).toBe(pane.element)
  })

  it('suma las clases de anchura de la vista', () => {
    const w = mount(DetailPane, { attrs: { class: 'w-72 flex-shrink-0' } })
    expect(w.classes()).toEqual(expect.arrayContaining(['w-72', 'flex-shrink-0', 'flex-col']))
  })
})

describe('MobileDetailOverlay', () => {
  it('el cuerpo es flex en columna con min-h-0 para que el detalle desplace', () => {
    const w = mount(MobileDetailOverlay, {
      props: { show: true },
      slots: { default: detail },
      global: { stubs: { teleport: true } },
    })
    const body = w.get('[data-testid="mobile-detail-body"]')
    for (const cls of ['flex-1', 'flex', 'flex-col', 'min-h-0', 'overflow-hidden']) {
      expect(body.classes()).toContain(cls)
    }
    expect(w.get('[data-testid="detail"]').element.parentElement).toBe(body.element)
  })
})
