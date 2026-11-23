import { beforeEach, describe, expect, it } from 'vitest'
import { Fragment, defineComponent, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import TourSelectPrompt from './TourSelectPrompt.vue'

// Regresión: con comentarios en la raíz del template, en desarrollo TourSelectPrompt rendía un
// Fragment; dentro de <Transition mode="out-in"> el Fragment se quitaba sin disparar afterLeave y
// el panel derecho de Actividades/Contactos se quedaba en `<!---->` al elegir gira.
// Ojo: Vue Test Utils stubea <Transition> por defecto; aquí va la real (`transition: false`).
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function frames(n = 3) {
  return new Promise<void>((resolve) => {
    let left = n
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })
}

async function settle() {
  await nextTick()
  await frames()
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
}

describe('TourSelectPrompt dentro de <Transition mode="out-in">', () => {
  it('su raíz es un elemento, no un Fragment (completo y compacto)', () => {
    for (const compact of [false, true]) {
      const w = mount(TourSelectPrompt, { props: { compact }, global: { plugins: [i18n] } })
      expect(w.vm.$.subTree.type).not.toBe(Fragment)
    }
  })

  it('selector → vacío → detalle: el hijo entrante se monta', async () => {
    const state = ref<'picker' | 'empty' | 'detail'>('picker')
    const Host = defineComponent({
      components: { TourSelectPrompt },
      setup: () => ({ state }),
      template: `
        <div data-testid="pane">
          <Transition name="fade" mode="out-in">
            <TourSelectPrompt v-if="state === 'picker'" key="picker" />
            <div v-else-if="state === 'detail'" key="detail" data-testid="detail" />
            <div v-else key="empty" data-testid="empty" />
          </Transition>
        </div>`,
    })
    const w = mount(Host, {
      global: { plugins: [i18n], stubs: { transition: false } },
      attachTo: document.body,
    })
    state.value = 'empty'
    await settle()
    expect(w.find('[data-testid="empty"]').exists()).toBe(true)
    state.value = 'detail'
    await settle()
    expect(w.find('[data-testid="detail"]').exists()).toBe(true)
    w.unmount()
  })
})
