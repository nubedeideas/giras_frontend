import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useToursStore } from '@/stores/tours'
import { adminTour } from '@/test/icalSubscriptions'
import { sheetsReturnTo, useImportReturn } from './useImportReturn'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('sheetsReturnTo', () => {
  it('añade import=sheets y la gira, conserva el resto y quita los restos del OAuth', () => {
    expect(sheetsReturnTo('/events?activity=A1', 'T1')).toBe(
      '/events?activity=A1&import=sheets&tour=T1'
    )
    expect(sheetsReturnTo('/tour?google_connect=ok&purpose=sheets&reason=x', 'T2')).toBe(
      '/tour?import=sheets&tour=T2'
    )
  })
})

describe('useImportReturn', () => {
  async function setup(path: string, ready: () => boolean) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/events', component: { template: '<div />' } }],
    })
    await router.push(path)
    await router.isReady()
    const onSheets = vi.fn()
    const C = defineComponent({
      setup() {
        useImportReturn({ ready, onSheets })
        return () => h('div')
      },
    })
    const w = mount(C, { global: { plugins: [router] } })
    await flushPromises()
    return { w, router, onSheets }
  }

  it('espera a la lista de giras, activa la de la vuelta y abre una sola vez', async () => {
    const canOpen = ref(false)
    const { router, onSheets } = await setup(
      '/events?import=sheets&tour=T1&google_connect=ok',
      () => canOpen.value
    )
    const q = router.currentRoute.value.query
    expect(q.import).toBeUndefined()
    expect(q.tour).toBeUndefined()
    expect(q.google_connect).toBe('ok')
    expect(onSheets).not.toHaveBeenCalled()

    const tours = useToursStore()
    tours.tours = [adminTour()]
    await nextTick()
    expect(tours.activeTour?.uuid).toBe('T1')
    expect(onSheets).not.toHaveBeenCalled()

    canOpen.value = true
    await nextTick()
    expect(onSheets).toHaveBeenCalledOnce()
    canOpen.value = false
    await nextTick()
    canOpen.value = true
    await nextTick()
    expect(onSheets).toHaveBeenCalledOnce()
  })

  it('sin ?import=sheets no hace nada', async () => {
    const { router, onSheets } = await setup('/events?import=team', () => true)
    expect(onSheets).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.import).toBe('team')
  })
})
