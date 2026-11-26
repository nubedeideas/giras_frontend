import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse, mockFetch } from '@/test/http'
import LoginView from './LoginView.vue'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  i18n.global.locale.value = 'es'
  vi.unstubAllGlobals()
})

function mountLogin() {
  return mount(LoginView, { global: { plugins: [i18n] } })
}

describe('LoginView', () => {
  it('en inglés la pantalla sale entera en inglés', () => {
    i18n.global.locale.value = 'en'
    const w = mountLogin()
    const text = w.text()
    expect(text).toContain('Continue with Google')
    expect(text).toContain('Sign-in link by email')
    expect(text).toContain('Send')
    expect(text).toContain('Home')
    expect(w.get('input[type="email"]').attributes('placeholder')).toBe('you@email.com')
    expect(text).not.toMatch(/Enviar|Inicio|Link de acceso|Continuar/)
  })

  it('en español usa tuteo peninsular', () => {
    i18n.global.locale.value = 'es'
    const w = mountLogin()
    expect(w.text()).toContain('Enlace de acceso por email')
    expect(w.get('input[type="email"]').attributes('placeholder')).toBe('tu@email.com')
  })

  it('tras enviar el enlace, la confirmación sale traducida (EN)', async () => {
    i18n.global.locale.value = 'en'
    mockFetch(jsonResponse({ message: 'Magic link enviado a tu email', email: 'tm@giras.pro' }))
    const w = mountLogin()
    await w.get('input[type="email"]').setValue('tm@giras.pro')
    await w.get('input[type="email"]').trigger('keydown.enter')
    await flushPromises()
    expect(w.text()).toContain('Check your email')
    expect(w.text()).toContain('We sent a sign-in link to')
    expect(w.text()).toContain('Use a different email')
  })

  it('access_pending del backend se traduce, nunca el código crudo (EN)', async () => {
    i18n.global.locale.value = 'en'
    mockFetch(
      jsonResponse({ error: 'access_pending', message: 'Tu acceso está pendiente', email: 'x@y.z' }, 403)
    )
    const w = mountLogin()
    await w.get('input[type="email"]').setValue('x@y.z')
    await w.get('input[type="email"]').trigger('keydown.enter')
    await flushPromises()
    expect(w.text()).toContain('Your access is pending approval')
    expect(w.text()).not.toContain('access_pending')
  })

  it('email no válido con la respuesta envuelta del handler global (EN)', async () => {
    i18n.global.locale.value = 'en'
    mockFetch(
      jsonResponse(
        {
          success: false,
          error: {
            message: 'Error en la solicitud',
            status_code: 400,
            details: { email: ['Introduzca una dirección de correo electrónico válida.'] },
          },
        },
        400
      )
    )
    const w = mountLogin()
    await w.get('input[type="email"]').setValue('no-es-email')
    await w.get('input[type="email"]').trigger('keydown.enter')
    await flushPromises()
    expect(w.text()).toContain('Enter a valid email')
  })

  it('429 del throttle muestra el aviso de demasiados intentos (EN)', async () => {
    i18n.global.locale.value = 'en'
    mockFetch(
      jsonResponse(
        { success: false, error: { message: 'Request was throttled.', status_code: 429 } },
        429
      )
    )
    const w = mountLogin()
    await w.get('input[type="email"]').setValue('tm@giras.pro')
    await w.get('input[type="email"]').trigger('keydown.enter')
    await flushPromises()
    expect(w.text()).toContain('Too many attempts')
  })
})
