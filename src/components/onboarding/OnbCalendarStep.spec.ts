import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { activityRow, importJob } from '@/test/importJobs'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import type { Tour } from '@/types'
import OnbCalendarStep from './OnbCalendarStep.vue'
import OnboardingWizard from './OnboardingWizard.vue'

const NOT_CONNECTED = {
  connected: false,
  account_email: '',
  granted_scopes: [],
  features: { calendar: false, calendar_write: false, contacts: false },
  connected_at: null,
}

const stubs = {
  ImportDropZone: {
    name: 'ImportDropZone',
    props: ['tourUuid', 'entryPoint', 'expected', 'compact'],
    emits: ['created'],
    template:
      '<div data-testid="zone" :data-tour="tourUuid" :data-entry="entryPoint" :data-expected="expected" />',
  },
  ImportProgress: {
    name: 'ImportProgress',
    props: ['jobUuid', 'expected'],
    emits: ['ready', 'failed'],
    template: '<div data-testid="progress" :data-expected="expected" />',
  },
}

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
      { path: '/:p(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/home')
  await router.isReady()
  return router
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input) =>
      String(input).endsWith('/integrations/google/status/')
        ? jsonResponse(NOT_CONNECTED)
        : jsonResponse([])
    )
  )
  useToursStore().tours = [{ id: 42, uuid: 'T42', name: 'Gira' } as Tour]
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openFileSource() {
  const router = await makeRouter()
  const w = mount(OnbCalendarStep, {
    props: { tourId: 42 },
    global: { plugins: [router, i18n], stubs },
  })
  await flushPromises()
  await w.get('[data-test="calendar-source-file"]').trigger('click')
  return w
}

describe('OnbCalendarStep: Archivo o foto (F2 A9)', () => {
  it('ofrece Google Calendar y "Archivo o foto"; el importador va con onboarding · itinerary', async () => {
    const w = await openFileSource()
    expect(w.get('[data-test="calendar-source-google"]').text()).toContain('Google Calendar')
    expect(w.get('[data-test="calendar-source-file"]').text()).toContain('Archivo o foto')
    const zone = w.get('[data-testid="zone"]')
    expect(zone.attributes('data-tour')).toBe('T42')
    expect(zone.attributes('data-entry')).toBe('onboarding')
    expect(zone.attributes('data-expected')).toBe('itinerary')
    await w.get('[data-test="calendar-file-skip"]').trigger('click')
    expect(w.emitted('skip')).toHaveLength(1)
  })

  it('crear → progreso → "Hemos encontrado {n}" → "Revisar después" emite next', async () => {
    const w = await openFileSource()
    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    expect(w.get('[data-testid="progress"]').attributes('data-expected')).toBe('itinerary')
    const job = importJob({
      status: 'ready',
      draft: { team: [], activities: [activityRow(), activityRow({ client_id: 'a2' })] },
    })
    w.findComponent({ name: 'ImportProgress' }).vm.$emit('ready', job)
    await flushPromises()
    expect(w.get('[data-test="calendar-import-ready"]').text()).toContain(
      'Hemos encontrado 2 actividades'
    )
    await w.get('[data-test="calendar-review-later"]').trigger('click')
    expect(w.emitted('next')).toHaveLength(1)
    expect(w.emitted('reviewImport')).toBeUndefined()
  })

  it('usa summary.activities.total y el singular con una actividad', async () => {
    const w = await openFileSource()
    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    const base = importJob({ status: 'ready' })
    const job = {
      ...base,
      summary: {
        ...base.summary!,
        activities: {
          total: 1,
          to_create: 1,
          to_replace: 0,
          to_skip: 0,
          needs_action: 0,
          duplicates: 0,
          possible_duplicates: 0,
          outside_tour: 0,
          in_past: 0,
          by_type: { show: 1 },
          days: 1,
        },
      },
    }
    w.findComponent({ name: 'ImportProgress' }).vm.$emit('ready', job)
    await flushPromises()
    expect(w.get('[data-test="calendar-import-ready"]').text()).toContain(
      'Hemos encontrado 1 actividad'
    )
  })

  it('sin actividades: equipo encontrado o "no hemos encontrado agenda", nunca "0 actividades"', async () => {
    const w = await openFileSource()
    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    // Solo equipo (una fila de equipo por defecto en el fixture).
    w.findComponent({ name: 'ImportProgress' }).vm.$emit('ready', importJob({ status: 'ready' }))
    await flushPromises()
    let found = w.get('[data-test="calendar-import-found"]').text()
    expect(found).toBe('No hemos encontrado agenda, pero sí 1 persona del equipo')
    expect(w.get('[data-test="calendar-import-ready"]').text()).not.toContain('0 actividades')

    const w2 = await openFileSource()
    w2.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    const empty = importJob({ status: 'ready', draft: { team: [], activities: [] } })
    w2.findComponent({ name: 'ImportProgress' }).vm.$emit('ready', empty)
    await flushPromises()
    found = w2.get('[data-test="calendar-import-found"]').text()
    expect(found).toBe('No hemos encontrado agenda en lo que has subido.')
    expect(w2.get('[data-test="calendar-import-ready"]').text()).not.toContain('Revísalas')
  })

  it('fallo: mensaje traducido y "Probar otra vez" vuelve a la zona', async () => {
    const w = await openFileSource()
    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    w.findComponent({ name: 'ImportProgress' }).vm.$emit(
      'failed',
      importJob({ status: 'failed', error_code: 'ai_unavailable' })
    )
    await flushPromises()
    expect(w.get('[data-test="calendar-import-failed"]').text()).toBe(
      'La lectura automática no está disponible ahora. Inténtalo en unos minutos.'
    )
    await w.findAll('button').find((b) => b.text() === 'Probar otra vez')!.trigger('click')
    expect(w.find('[data-testid="zone"]').exists()).toBe(true)
  })

  it('en la demo no hay fuentes ni importador', async () => {
    useAuthStore().isDemoMode = true
    const router = await makeRouter()
    const w = mount(OnbCalendarStep, {
      props: { tourId: 42 },
      global: { plugins: [router, i18n], stubs },
    })
    await flushPromises()
    expect(w.find('[data-test="calendar-source-file"]').exists()).toBe(false)
  })
})

describe('OnboardingWizard: "Revisar ahora"', () => {
  it('cierra el asistente (complete) y navega a tour-import', async () => {
    const router = await makeRouter()
    const w = mount(OnboardingWizard, {
      props: { initialStep: 'calendar', initialTourId: 42 },
      global: { plugins: [router, i18n], stubs: { ...stubs, teleport: true, transition: false } },
    })
    await flushPromises()
    expect(w.text()).toContain('Agenda')
    await w.get('[data-test="calendar-source-file"]').trigger('click')
    w.findComponent({ name: 'ImportDropZone' }).vm.$emit('created', importJob({ status: 'uploaded' }))
    await flushPromises()
    w.findComponent({ name: 'ImportProgress' }).vm.$emit(
      'ready',
      importJob({ uuid: 'J9', status: 'ready' })
    )
    await flushPromises()
    await w.get('[data-test="calendar-review-now"]').trigger('click')
    await flushPromises()
    expect(w.emitted('complete')).toEqual([[42]])
    expect(router.currentRoute.value.name).toBe('tour-import')
    expect(router.currentRoute.value.params.jobUuid).toBe('J9')
  })
})
