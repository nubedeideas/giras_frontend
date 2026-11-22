import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { importJob } from '@/test/importJobs'
import type { ImportJob } from '@/composables/useImportJobs'
import ImportDropModal from './ImportDropModal.vue'

const stubs = {
  transition: false,
  ImportDropZone: {
    name: 'ImportDropZone',
    props: ['tourUuid', 'entryPoint'],
    emits: ['created'],
    template: '<div data-test="zone-stub" :data-entry="entryPoint" />',
  },
}

function stubDetail(job: Partial<ImportJob>) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => jsonResponse(importJob(job)))
  )
}

async function mountModal() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tour', name: 'tour', component: { template: '<div />' } },
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
    ],
  })
  await router.push('/tour')
  await router.isReady()
  const w = mount(ImportDropModal, {
    props: { show: true, tourUuid: 'T1' },
    global: { plugins: [i18n, router], stubs },
  })
  return Object.assign(w, { router })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ImportDropModal', () => {
  it('zona → progreso → en ready navega a la revisión y cierra', async () => {
    stubDetail({ status: 'ready' })
    const w = await mountModal()
    expect(w.get('[data-test="zone-stub"]').attributes('data-entry')).toBe('tour')
    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    await flushPromises()
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.router.currentRoute.value.name).toBe('tour-import')
    expect(w.router.currentRoute.value.params.jobUuid).toBe('J1')
  })

  it('failed: mensaje traducido y "Probar otra vez" vuelve a la zona', async () => {
    stubDetail({ status: 'failed', error_code: 'ai_bad_response' })
    const w = await mountModal()
    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    expect(w.get('[data-test="import-failed"]').text()).toBe(
      'No hemos podido entender el archivo. Prueba con otro formato o pega el texto.'
    )
    await w.get('[data-test="import-retry"]').trigger('click')
    expect(w.find('[data-test="zone-stub"]').exists()).toBe(true)
    expect(w.emitted('close')).toBeUndefined()
  })
})
