import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import {
  PENDING_KEY,
  RESUME_KEY,
  takeOnboardingResume,
  takePending,
  withQuery,
} from '@/utils/googleOAuth'
import { isGoogleScopeMissing, isSafeReturnTo, useGoogleIntegration } from './useGoogleIntegration'

const redirectTo = vi.hoisted(() => vi.fn())
vi.mock('@/utils/navigation', () => ({ redirectTo }))

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=S1'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  redirectTo.mockReset()
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useGoogleIntegration API', () => {
  it('authorize manda purpose, return_to y redirect_uri', async () => {
    const fn = mockFetch(jsonResponse({ authorization_url: AUTH_URL, state: 'S1', scopes: [] }))
    await useGoogleIntegration().authorize('calendar', '/settings?tab=calendars')
    const { url, init, headers } = callAt(fn, 0)
    expect(url).toBe('http://api.test/api/integrations/google/authorize/')
    expect(init.method).toBe('POST')
    expect(headers.Authorization).toBe('Bearer access')
    expect(JSON.parse(String(init.body))).toEqual({
      purpose: 'calendar',
      return_to: '/settings?tab=calendars',
      redirect_uri: `${window.location.origin}/auth/callback`,
    })
  })

  it('getStatus, connect y disconnect usan sus endpoints', async () => {
    const status = {
      connected: true,
      account_email: 'a@b.es',
      granted_scopes: [],
      features: { calendar: true, contacts: false },
      connected_at: null,
    }
    const fn = mockFetch(
      jsonResponse(status),
      jsonResponse({ purpose: 'calendar', return_to: '/x', purpose_granted: true, status }),
      jsonResponse({ status, revoked_in_google: true, calendars_deactivated: 1, contacts_deactivated: 0 })
    )
    const g = useGoogleIntegration()
    expect(await g.getStatus()).toEqual(status)
    await g.connect('CODE', 'STATE', 'http://localhost/auth/callback')
    const res = await g.disconnect()
    expect(res?.revoked_in_google).toBe(true)
    expect(callAt(fn, 0).url).toBe('http://api.test/api/integrations/google/status/')
    expect(callAt(fn, 1).url).toBe('http://api.test/api/integrations/google/connect/')
    expect(JSON.parse(String(callAt(fn, 1).init.body))).toEqual({
      code: 'CODE',
      state: 'STATE',
      redirect_uri: 'http://localhost/auth/callback',
    })
    expect(callAt(fn, 2).url).toBe('http://api.test/api/integrations/google/disconnect/')
    expect(callAt(fn, 2).init.method).toBe('DELETE')
  })
})

describe('startConnect', () => {
  it('guarda pending (y onboarding.resume) antes de redirigir', async () => {
    mockFetch(jsonResponse({ authorization_url: AUTH_URL, state: 'S1', scopes: [] }))
    redirectTo.mockImplementation(() => {
      // En el momento de redirigir, todo tiene que estar ya guardado.
      expect(JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null')).toMatchObject({
        kind: 'connect',
        state: 'S1',
        purpose: 'contacts',
        returnTo: '/home',
      })
      expect(JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? 'null')).toMatchObject({
        step: 'crew',
        tourUuid: 'T7',
      })
    })
    const ok = await useGoogleIntegration().startConnect('contacts', '/home', {
      onboarding: { step: 'crew', tourUuid: 'T7' },
    })
    expect(ok).toBe(true)
    expect(redirectTo).toHaveBeenCalledWith(AUTH_URL)
  })

  it('sin onboarding no guarda resume', async () => {
    mockFetch(jsonResponse({ authorization_url: AUTH_URL, state: 'S1', scopes: [] }))
    await useGoogleIntegration().startConnect('calendar', '/settings?tab=calendars')
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull()
    expect(takePending()?.returnTo).toBe('/settings?tab=calendars')
  })

  it('si authorize falla no redirige ni guarda nada y deja el error', async () => {
    mockFetch(jsonResponse({ code: 'google_not_configured', detail: 'La integración con Google no está configurada.' }, 503))
    const g = useGoogleIntegration()
    const ok = await g.startConnect('calendar', '/settings?tab=calendars')
    expect(ok).toBe(false)
    expect(redirectTo).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    expect(g.error.value).toBe('La integración con Google no está configurada.')
    expect(g.connecting.value).toBeNull()
  })

  it('traduce el error por code al idioma de la interfaz, no pinta el detail', async () => {
    i18n.global.locale.value = 'en'
    mockFetch(jsonResponse({ code: 'invalid_return_to', detail: 'Ruta de retorno no válida.' }, 400))
    const g = useGoogleIntegration()
    await g.startConnect('calendar', '/settings?tab=calendars')
    expect(g.error.value).toBe('The return path is not valid. Please try again.')
  })

  it('429 sin code → rate_limited; code desconocido → texto genérico', async () => {
    mockFetch(
      jsonResponse({ detail: 'Request was throttled.' }, 429),
      jsonResponse({ code: 'raro', detail: 'Algo' }, 400)
    )
    const g = useGoogleIntegration()
    await g.startConnect('calendar', '/home')
    expect(g.error.value).toBe('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.')
    await g.startConnect('calendar', '/home')
    expect(g.error.value).toBe('No se ha podido iniciar la conexión con Google. Inténtalo de nuevo.')
  })

  it.each([
    'invalid_state', 'state_expired', 'state_used', 'state_user_mismatch', 'exchange_failed',
    'google_unavailable', 'google_not_configured', 'google_account_mismatch',
    'google_account_in_use', 'invalid_purpose', 'invalid_return_to', 'invalid_redirect_uri',
    'rate_limited',
  ])('googleIntegration.errors.%s existe en es y en', (code) => {
    for (const l of ['es', 'en'] as const) {
      expect(i18n.global.te(`googleIntegration.errors.${code}`, l)).toBe(true)
    }
  })
})

describe('helpers', () => {
  it('isGoogleScopeMissing solo con 403 y code google_scope_missing', () => {
    const body = { code: 'google_scope_missing', purpose: 'calendar', required_scopes: [], connected: false }
    expect(isGoogleScopeMissing(new ApiError(403, body))).toBe(true)
    expect(isGoogleScopeMissing(new ApiError(400, body))).toBe(false)
    expect(isGoogleScopeMissing(new ApiError(403, { detail: 'x' }))).toBe(false)
    expect(isGoogleScopeMissing(new ApiError(403, { code: 'other' }))).toBe(false)
    expect(isGoogleScopeMissing(new Error('x'))).toBe(false)
    expect(isGoogleScopeMissing(null)).toBe(false)
  })

  it.each(['/settings?tab=calendars', '/home', '/contacts?import=google'])(
    'isSafeReturnTo acepta %s',
    (p) => expect(isSafeReturnTo(p)).toBe(true)
  )

  it.each(['//evil.com', 'https://evil.com', '/\\evil', 'home', '/x?u=https://evil.com', ''])(
    'isSafeReturnTo rechaza %s',
    (p) => expect(isSafeReturnTo(p)).toBe(false)
  )

  it('withQuery conserva la query existente', () => {
    expect(withQuery('/settings?tab=calendars', { google_connect: 'ok', purpose: 'calendar' })).toBe(
      '/settings?tab=calendars&google_connect=ok&purpose=calendar'
    )
    expect(withQuery('/home', { google_connect: 'error', reason: undefined })).toBe(
      '/home?google_connect=error'
    )
  })

  it('takePending descarta los de más de 10 min y siempre borra la clave', () => {
    const p = { kind: 'login', state: 'login.x', createdAt: 1000 }
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p))
    expect(takePending(1000 + 9 * 60 * 1000)?.state).toBe('login.x')
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p))
    expect(takePending(1000 + 11 * 60 * 1000)).toBeNull()
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('takeOnboardingResume borra la clave y descarta los de más de 30 min', () => {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ step: 'calendar', tourUuid: 'T3', createdAt: 1000 }))
    expect(takeOnboardingResume(1000 + 29 * 60 * 1000)).toEqual({ step: 'calendar', tourUuid: 'T3', createdAt: 1000 })
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull()
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ step: 'calendar', tourUuid: 'T3', createdAt: 1000 }))
    expect(takeOnboardingResume(1000 + 31 * 60 * 1000)).toBeNull()
    // Formato antiguo con id sintético: se descarta la gira (podría ser otra tras recargar).
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ step: 'crew', tourId: 3, createdAt: 1000 }))
    expect(takeOnboardingResume(1000)).toEqual({ step: 'crew', tourUuid: null, createdAt: 1000 })
  })
})
