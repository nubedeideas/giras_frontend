import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { importJob } from '@/test/importJobs'
import type { ImportJob } from '@/composables/useImportJobs'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { adminTour } from '@/test/icalSubscriptions'
import ImportDropModal from './ImportDropModal.vue'

const stubs = {
  transition: false,
  ImportDropZone: {
    name: 'ImportDropZone',
    props: ['tourUuid', 'entryPoint', 'expected'],
    emits: ['created'],
    template: '<div data-test="zone-stub" :data-entry="entryPoint" :data-expected="expected" />',
  },
  IcalSubscribeForm: {
    name: 'IcalSubscribeForm',
    props: { tourUuid: String, compact: Boolean },
    emits: ['cancel', 'review', 'created'],
    template: '<div data-test="ical-form-stub" :data-tour="tourUuid" :data-compact="String(compact)" />',
  },
}

function stubDetail(job: Partial<ImportJob>) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => jsonResponse(importJob(job)))
  )
}

async function mountModal(extra: Record<string, unknown> = {}) {
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
    props: { show: true, tourUuid: 'T1', ...extra },
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

  it('F2: título y subtítulo por expected (any por defecto) y lo reenvía a la zona', async () => {
    const cases = [
      { props: {}, title: 'Importar a la gira', expected: 'any' },
      { props: { expected: 'team' }, title: 'Importar equipo', expected: 'team' },
      { props: { expected: 'itinerary' }, title: 'Importar agenda', expected: 'itinerary' },
    ]
    for (const c of cases) {
      const w = await mountModal(c.props)
      expect(w.text()).toContain(c.title)
      expect(w.get('[data-test="zone-stub"]').attributes('data-expected')).toBe(c.expected)
      w.unmount()
    }
    const w = await mountModal({ expected: 'itinerary' })
    expect(w.text()).toContain(
      'Sube el itinerario, el day sheet o una foto y convertiremos cada fecha en una actividad.'
    )
  })

  it('F3: "Suscribir iCal (URL)" solo admin, fuera de la demo y si no es el importador de equipo', async () => {
    const tours = useToursStore()
    tours.tours = [adminTour()]
    const w = await mountModal({ expected: 'itinerary' })
    expect(w.find('[data-test="import-ical-toggle"]').text()).toBe('Suscribir iCal (URL)')
    w.unmount()

    const team = await mountModal({ expected: 'team' })
    expect(team.find('[data-test="import-ical-toggle"]').exists()).toBe(false)
    team.unmount()

    tours.tours = [adminTour({ current_user_is_admin: false })]
    const member = await mountModal()
    expect(member.find('[data-test="import-ical-toggle"]').exists()).toBe(false)
    member.unmount()

    tours.tours = [adminTour()]
    useAuthStore().isDemoMode = true
    const demo = await mountModal()
    expect(demo.find('[data-test="import-ical-toggle"]').exists()).toBe(false)
  })

  it('F3: alterna entre la zona y el alta iCal; "Revisar ahora" cierra el modal', async () => {
    useToursStore().tours = [adminTour()]
    const w = await mountModal()
    await w.get('[data-test="import-ical-toggle"]').trigger('click')
    expect(w.find('[data-test="zone-stub"]').exists()).toBe(false)
    const form = w.get('[data-test="ical-form-stub"]')
    expect(form.attributes('data-tour')).toBe('T1')
    expect(form.attributes('data-compact')).toBe('true')
    expect(w.text()).toContain('Suscribir un calendario iCal')

    w.findComponent({ name: 'IcalSubscribeForm' }).vm.$emit('cancel')
    await flushPromises()
    expect(w.find('[data-test="zone-stub"]').exists()).toBe(true)
    expect(w.text()).toContain('Importar a la gira')

    await w.get('[data-test="import-ical-toggle"]').trigger('click')
    w.findComponent({ name: 'IcalSubscribeForm' }).vm.$emit('review', 'J9')
    await flushPromises()
    expect(w.emitted('close')).toHaveLength(1)
  })
})
