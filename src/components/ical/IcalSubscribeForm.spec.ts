import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { icalApiError, icalSub } from '@/test/icalSubscriptions'
import IcalSubscribeForm from './IcalSubscribeForm.vue'

async function mountForm(props: Record<string, unknown> = { tourUuid: 'T1' }) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
      { path: '/tour/import/:jobUuid', name: 'tour-import', component: { template: '<div />' } },
    ],
  })
  await router.push('/settings')
  await router.isReady()
  const w = mount(IcalSubscribeForm, {
    props: props as { tourUuid: string | null },
    global: { plugins: [i18n, router] },
  })
  return Object.assign(w, { router })
}

async function fill(w: Awaited<ReturnType<typeof mountForm>>, url: string, name = '') {
  await w.get('[data-test="ical-url"]').setValue(url)
  if (name) await w.get('[data-test="ical-name"]').setValue(name)
  await w.get('form').trigger('submit')
  await flushPromises()
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

describe('IcalSubscribeForm', () => {
  it('validación local: sin llamar a la API con http:// o credenciales', async () => {
    const fn = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fn)
    const w = await mountForm()
    expect(w.get('[data-test="ical-url"]').attributes('type')).toBe('url')
    expect(w.get('[data-test="ical-url"]').attributes('inputmode')).toBe('url')
    expect(w.get('[data-test="ical-url"]').attributes('autocomplete')).toBe('off')

    await fill(w, 'http://example.com/cal.ics')
    expect(w.get('[data-test="ical-url-error"]').text()).toBe(
      'La dirección no es válida. Debe empezar por https:// o webcal://.'
    )
    await fill(w, 'https://yo:secreto@example.com/cal.ics')
    expect(w.get('[data-test="ical-url-error"]').text()).toBe(
      'Quita el usuario y la contraseña de la dirección.'
    )
    expect(fn).not.toHaveBeenCalled()
  })

  it('errores del backend por reason (bajo la dirección) y por code (general)', async () => {
    mockFetch(
      jsonResponse(icalApiError('invalid_url', 400, { reason: 'host_not_allowed' }), 400),
      jsonResponse(icalApiError('already_subscribed', 409, { subscription_uuid: 'S0' }), 409),
      jsonResponse(icalApiError('too_many_subscriptions', 400), 400)
    )
    const w = await mountForm()
    await fill(w, 'https://localhost.example/cal.ics')
    expect(w.get('[data-test="ical-url-error"]').text()).toBe(
      'La dirección no es válida. Debe empezar por https:// o webcal://.'
    )
    await fill(w, 'webcal://p52-caldav.icloud.com/published/2/abc')
    expect(w.find('[data-test="ical-url-error"]').exists()).toBe(false)
    expect(w.get('[data-test="ical-form-error"]').text()).toBe(
      'Esta gira ya está suscrita a ese calendario.'
    )
    await fill(w, 'webcal://p52-caldav.icloud.com/published/2/abc')
    expect(w.get('[data-test="ical-form-error"]').text()).toBe(
      'Esta gira ya tiene 5 calendarios suscritos.'
    )
    expect(w.text()).not.toContain('already_subscribed')
    expect(w.text()).not.toContain('Mensaje del backend')
    expect(w.emitted('created')).toBeUndefined()
  })

  it('sin tourUuid pinta el selector y exige elegir la gira', async () => {
    const fn = mockFetch(
      jsonResponse(icalSub({ tour: 'T2', last_status: 'pending' }), 201),
      jsonResponse(icalSub({ tour: 'T2' }))
    )
    const w = await mountForm({
      tourUuid: null,
      tours: [
        { uuid: 'T1', name: 'Gira Norte' },
        { uuid: 'T2', name: 'Gira Sur' },
      ],
    })
    const select = w.get('[data-test="ical-tour"]')
    expect(select.findAll('option').map((o) => o.text())).toEqual([
      'Elige una gira',
      'Gira Norte',
      'Gira Sur',
    ])
    await fill(w, 'https://example.com/cal.ics')
    expect(w.get('[data-test="ical-tour-error"]').text()).toContain('Elige la gira')
    expect(fn).not.toHaveBeenCalled()

    await select.setValue('T2')
    await fill(w, 'https://example.com/cal.ics', 'Calendario Sur')
    expect(JSON.parse(String(callAt(fn, 0).init.body))).toEqual({
      tour: 'T2',
      url: 'https://example.com/cal.ics',
      name: 'Calendario Sur',
    })
  })

  it('sin giras que administre: aviso y sin botón activo', async () => {
    const w = await mountForm({ tourUuid: null, tours: [] })
    expect(w.find('[data-test="ical-no-tours"]').exists()).toBe(true)
    expect(w.get('[data-test="ical-submit"]').attributes('disabled')).toBeDefined()
  })

  it('tras crear, sondea; con job ready "Revisar ahora" navega a la revisión', async () => {
    const job = { uuid: 'J7', status: 'ready' as const, created_at: '', new: 3, changed: 1, cancelled: 0 }
    const fn = mockFetch(
      jsonResponse(icalSub({ last_status: 'pending' }), 201),
      jsonResponse(icalSub({ pending_job: job }))
    )
    const w = await mountForm()
    await fill(w, 'webcal://p52-caldav.icloud.com/published/2/abc')
    expect(w.emitted('created')).toHaveLength(1)
    expect(callAt(fn, 1).url).toContain('/integrations/ical-subscriptions/S1/')
    expect(w.get('[data-test="ical-found"]').text()).toBe('Hemos encontrado 4 eventos para revisar')
    await w.get('[data-test="ical-review"]').trigger('click')
    await flushPromises()
    expect(w.emitted('review')).toEqual([['J7']])
    expect(w.router.currentRoute.value.name).toBe('tour-import')
    expect(w.router.currentRoute.value.params.jobUuid).toBe('J7')
  })

  it('"Sin eventos nuevos" y error de lectura traducido', async () => {
    mockFetch(
      jsonResponse(icalSub({ last_status: 'pending' }), 201),
      jsonResponse(icalSub({ last_status: 'ok', pending_job: null }))
    )
    const w = await mountForm()
    await fill(w, 'https://example.com/cal.ics')
    expect(w.get('[data-test="ical-done-text"]').text()).toBe(
      'No hay eventos en las fechas de la gira. Te avisaremos cuando aparezcan.'
    )
    expect(w.find('[data-test="ical-review"]').exists()).toBe(false)

    mockFetch(
      jsonResponse(icalSub({ last_status: 'pending' }), 201),
      jsonResponse(icalSub({ last_status: 'error', last_error_code: 'not_ics' }))
    )
    const e = await mountForm()
    await fill(e, 'https://example.com/cal.ics')
    const text = e.get('[data-test="ical-done-text"]')
    expect(text.text()).toBe('La dirección no devuelve un calendario.')
    expect(text.attributes('role')).toBe('alert')
  })

  it('compacto: sin título propio y "Volver" emite cancel', async () => {
    const w = await mountForm({ tourUuid: 'T1', compact: true })
    expect(w.text()).not.toContain('Suscribir un calendario iCal')
    const back = w.get('[data-test="ical-cancel"]')
    expect(back.text()).toBe('Volver')
    await back.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('ayuda plegable con los tres pasos', async () => {
    const w = await mountForm()
    expect(w.find('[data-test="ical-help"]').exists()).toBe(false)
    await w.get('[data-test="ical-help-toggle"]').trigger('click')
    const items = w.get('[data-test="ical-help"]').findAll('li')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('Apple Calendar')
    expect(items[2].text()).toContain('Outlook')
  })
})
