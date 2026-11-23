import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { PENDING_KEY } from '@/utils/googleOAuth'
import { useAuthStore } from './auth'
import { useGoogleStore } from './google'

const STATUS = {
  connected: true,
  account_email: 'a@b.es',
  granted_scopes: [],
  features: { calendar: true, calendar_write: true, contacts: true, sheets: false },
  connected_at: null,
}

const redirectTo = vi.hoisted(() => vi.fn())
vi.mock('@/utils/navigation', () => ({ redirectTo }))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  redirectTo.mockReset()
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('estado de Google al cambiar de sesión', () => {
  it('logout borra el estado de Google', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    useGoogleStore().setStatus(STATUS)
    localStorage.setItem('gs_access_token', 'a')
    const auth = useAuthStore()
    auth.accessToken = 'a'
    await auth.logout()
    expect(useGoogleStore().status).toBeNull()
    vi.unstubAllGlobals()
  })

  it('loginDemo borra el estado y load() da todo a false sin llamar a la API', async () => {
    const fn = vi.fn()
    vi.stubGlobal('fetch', fn)
    useGoogleStore().setStatus(STATUS)
    useAuthStore().loginDemo()
    expect(useGoogleStore().status).toBeNull()
    await useGoogleStore().load()
    expect(useGoogleStore().status?.features.calendar).toBe(false)
    expect(fn).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('startGoogleLogin', () => {
  it('pide solo identidad, con select_account y state guardado como login', () => {
    useAuthStore().startGoogleLogin()
    expect(redirectTo).toHaveBeenCalledTimes(1)
    const url = new URL(redirectTo.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    const p = url.searchParams
    expect(p.get('scope')).toBe('openid email profile')
    expect(p.get('prompt')).toBe('select_account')
    expect(p.has('access_type')).toBe(false)
    expect(p.get('client_id')).toBe('client-123')
    expect(p.get('redirect_uri')).toBe(`${window.location.origin}/auth/callback`)
    expect(url.search).not.toMatch(/calendar|contacts/)

    const state = p.get('state')
    expect(state).toMatch(/^login\./)
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null')
    expect(pending).toMatchObject({ kind: 'login', state })
    expect(typeof pending.createdAt).toBe('number')
  })

  it('cada login genera un state distinto', () => {
    const auth = useAuthStore()
    auth.startGoogleLogin()
    auth.startGoogleLogin()
    const s1 = new URL(redirectTo.mock.calls[0][0] as string).searchParams.get('state')
    const s2 = new URL(redirectTo.mock.calls[1][0] as string).searchParams.get('state')
    expect(s1).not.toBe(s2)
  })
})
