import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { useAuthStore } from '@/stores/auth'
import { useGoogleStore } from '@/stores/google'
import { PENDING_KEY, RESUME_KEY } from '@/utils/googleOAuth'
import AuthCallbackView from './AuthCallbackView.vue'

const REDIRECT_URI = `${window.location.origin}/auth/callback`

const STATUS = {
  connected: true,
  account_email: 'tm@giras.pro',
  granted_scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  features: { calendar: true, calendar_write: true, contacts: false },
  connected_at: '2026-11-20T10:00:00Z',
}

function makeRouter() {
  const blank = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/callback', name: 'auth-callback', component: AuthCallbackView },
      { path: '/:pathMatch(.*)*', component: blank },
    ],
  })
}

function setPending(p: Record<string, unknown>) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ createdAt: Date.now(), ...p }))
}

async function mountAt(query: Record<string, string>) {
  const router = makeRouter()
  await router.push({ path: '/auth/callback', query })
  await router.isReady()
  const replace = vi.spyOn(router, 'replace')
  const w = mount({ template: '<RouterView />' }, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { w, router, replace }
}

let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout'] })
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({}, 404))
  vi.stubGlobal('fetch', fetchFn)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('AuthCallbackView: login', () => {
  it('state correcto → loginWithGoogle y /home', async () => {
    setPending({ kind: 'login', state: 'login.abc' })
    const auth = useAuthStore()
    const login = vi.spyOn(auth, 'loginWithGoogle').mockResolvedValue()
    const { replace } = await mountAt({ code: 'C1', state: 'login.abc' })
    expect(login).toHaveBeenCalledWith('C1', REDIRECT_URI)
    expect(replace).toHaveBeenCalledWith('/home')
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('quita code y state de la URL antes de llamar a la API', async () => {
    setPending({ kind: 'login', state: 'login.abc' })
    const auth = useAuthStore()
    let queryAtLogin: unknown = null
    const routerRef: { r?: ReturnType<typeof makeRouter> } = {}
    vi.spyOn(auth, 'loginWithGoogle').mockImplementation(async () => {
      queryAtLogin = routerRef.r?.currentRoute.value.query
    })
    const router = makeRouter()
    routerRef.r = router
    await router.push({ path: '/auth/callback', query: { code: 'C1', state: 'login.abc' } })
    await router.isReady()
    mount({ template: '<RouterView />' }, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(queryAtLogin).toEqual({})
  })

  it('access_denied en login → mensaje y /login sin llamar a la API', async () => {
    setPending({ kind: 'login', state: 'login.abc' })
    const login = vi.spyOn(useAuthStore(), 'loginWithGoogle')
    const { w, replace } = await mountAt({ error: 'access_denied', state: 'login.abc' })
    expect(login).not.toHaveBeenCalled()
    expect(w.get('[data-testid="callback-error"]').text()).toContain('Acceso denegado')
    vi.advanceTimersByTime(3000)
    expect(replace).toHaveBeenCalledWith('/login')
  })
})

describe('AuthCallbackView: state', () => {
  it.each([
    ['state distinto', { kind: 'login', state: 'login.abc' }, '/login'],
    ['sin pending', null, '/settings?tab=calendars'],
    ['conexión con state distinto', { kind: 'connect', state: 'S1', purpose: 'calendar', returnTo: '/home' }, '/settings?tab=calendars'],
  ])('%s → stateMismatch y ninguna llamada a la API', async (_n, pending, target) => {
    if (pending) setPending(pending)
    const login = vi.spyOn(useAuthStore(), 'loginWithGoogle')
    const { w, replace } = await mountAt({ code: 'C1', state: 'OTRO' })
    expect(w.get('[data-testid="callback-error"]').text()).toBe(
      'La sesión de autorización no coincide. Vuelve a intentarlo.'
    )
    expect(login).not.toHaveBeenCalled()
    expect(fetchFn).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
    expect(replace).toHaveBeenCalledWith({ path: '/auth/callback' })
    vi.advanceTimersByTime(3000)
    expect(replace).toHaveBeenCalledWith(target)
  })

  it('stateMismatch borra el punto de retorno del asistente', async () => {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ step: 'calendar', tourId: 1, createdAt: Date.now() }))
    setPending({ kind: 'connect', state: 'S1', purpose: 'calendar', returnTo: '/home' })
    await mountAt({ code: 'C1', state: 'OTRO' })
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull()
  })
})

describe('AuthCallbackView: conexión', () => {
  const pending = {
    kind: 'connect',
    state: 'SIGNED',
    purpose: 'calendar',
    returnTo: '/settings?tab=calendars',
  }

  function connectResponse(over: Record<string, unknown> = {}) {
    return {
      purpose: 'calendar',
      return_to: '/settings?tab=calendars',
      purpose_granted: true,
      granted_scopes: STATUS.granted_scopes,
      missing_scopes: [],
      status: STATUS,
      ...over,
    }
  }

  it('POST connect, setStatus y vuelta a return_to con ok', async () => {
    setPending(pending)
    fetchFn.mockResolvedValueOnce(jsonResponse(connectResponse()))
    const { replace } = await mountAt({ code: 'C1', state: 'SIGNED' })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(String(url)).toBe('http://api.test/api/integrations/google/connect/')
    expect(JSON.parse(String(init?.body))).toEqual({
      code: 'C1',
      state: 'SIGNED',
      redirect_uri: REDIRECT_URI,
    })
    expect(useGoogleStore().status).toEqual(STATUS)
    expect(replace).toHaveBeenCalledWith(
      '/settings?tab=calendars&google_connect=ok&purpose=calendar'
    )
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('purpose_granted false → partial', async () => {
    setPending(pending)
    fetchFn.mockResolvedValueOnce(jsonResponse(connectResponse({ purpose_granted: false })))
    const { replace } = await mountAt({ code: 'C1', state: 'SIGNED' })
    expect(replace).toHaveBeenCalledWith(
      '/settings?tab=calendars&google_connect=partial&purpose=calendar'
    )
  })

  it('access_denied → returnTo con denied, sin llamar a la API', async () => {
    setPending({ ...pending, purpose: 'contacts', returnTo: '/contacts?import=google' })
    const { replace } = await mountAt({ error: 'access_denied', state: 'SIGNED' })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith(
      '/contacts?import=google&google_connect=denied&purpose=contacts'
    )
  })

  it('return_to inseguro → /settings?tab=calendars', async () => {
    setPending(pending)
    fetchFn.mockResolvedValueOnce(jsonResponse(connectResponse({ return_to: '//evil.com' })))
    const { replace } = await mountAt({ code: 'C1', state: 'SIGNED' })
    expect(replace).toHaveBeenCalledWith(
      '/settings?tab=calendars&google_connect=ok&purpose=calendar'
    )
  })

  it('409 → error con reason del backend', async () => {
    setPending({ ...pending, returnTo: '/home' })
    fetchFn.mockResolvedValueOnce(
      jsonResponse(
        { code: 'google_account_mismatch', detail: 'Conecta la misma cuenta de Google...' },
        409
      )
    )
    const { replace } = await mountAt({ code: 'C1', state: 'SIGNED' })
    expect(replace).toHaveBeenCalledWith(
      '/home?google_connect=error&purpose=calendar&reason=google_account_mismatch'
    )
  })
})
