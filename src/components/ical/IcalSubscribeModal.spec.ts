import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useImportsStore } from '@/stores/imports'
import { icalSub } from '@/test/icalSubscriptions'
import IcalSubscribeModal from './IcalSubscribeModal.vue'

const stubs = {
  AppModal: { props: ['show'], emits: ['close'], template: '<div v-if="show"><slot /></div>' },
  IcalSubscribeForm: {
    emits: ['created', 'cancel', 'review'],
    template: '<div data-test="form-stub" />',
  },
}

function mountModal() {
  return mount(IcalSubscribeModal, {
    props: { show: true, tourUuid: 'T1' },
    global: { plugins: [i18n], stubs },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

describe('IcalSubscribeModal', () => {
  it('al cerrar tras suscribir avisa a Mi Gira (recarga de borradores pendientes)', async () => {
    const imports = useImportsStore()
    const w = mountModal()
    const form = w.findComponent(stubs.IcalSubscribeForm)
    form.vm.$emit('created', icalSub({ tour: 'T2' }))
    expect(w.emitted('created')).toHaveLength(1)
    expect(imports.version).toBe(0)
    form.vm.$emit('cancel')
    expect(w.emitted('close')).toHaveLength(1)
    expect(imports.version).toBe(1)
    expect(imports.lastTour).toBe('T2')
  })

  it('cerrar sin suscribir no recarga nada', async () => {
    const imports = useImportsStore()
    const w = mountModal()
    await w.get('[data-test="ical-modal-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    expect(imports.version).toBe(0)
  })
})
