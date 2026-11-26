import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '@/i18n'
import { redirectTo } from '@/utils/navigation'
import { oauthRedirectUri, randomLoginState, savePending } from '@/utils/googleOAuth'
import { useGoogleStore } from '@/stores/google'
import { useInboxStore } from '@/stores/inbox'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  uuid: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  phone_number: string | null
  avatar: string | null
  bio: string
  timezone: string
  language: string
  google_id: string | null
  telegram_id: number | null
  is_verified: boolean
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
}

interface LoginResponse {
  access_token: string
  refresh_token: string
  user: AuthUser
  expires_in: number
}

// ─── Errores de login (texto traducido, nunca el código crudo del backend) ─────

/** Error ya traducido; el resto (red, JSON roto) cae al genérico de cada acción. */
class AuthMessageError extends Error {}

/**
 * Mensaje del fallo de un endpoint de login. `access_pending` (gate de acceso, 403) tiene texto
 * propio; los `error` libres del backend vienen en español, así que se usa el texto i18n de la
 * acción para que la pantalla salga entera en el idioma elegido.
 */
function authFailure(data: { error?: unknown } | null, fallbackKey: string): AuthMessageError {
  const key = data?.error === 'access_pending' ? 'auth.errors.accessPending' : fallbackKey
  return new AuthMessageError(i18n.global.t(key))
}

function authErrorMessage(e: unknown, fallbackKey: string): string {
  return e instanceof AuthMessageError ? e.message : i18n.global.t(fallbackKey)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'
const TOKEN_KEY = 'gs_access_token'
const REFRESH_KEY = 'gs_refresh_token'

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY))
  const isLoggedIn = ref(!!localStorage.getItem(TOKEN_KEY))
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isDemoMode = ref(false)

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function authHeaders(opts: { json?: boolean } = {}): Record<string, string> {
    const h: Record<string, string> = {}
    if (opts.json !== false) h['Content-Type'] = 'application/json'
    if (accessToken.value) h['Authorization'] = `Bearer ${accessToken.value}`
    return h
  }

  function saveTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    localStorage.setItem(TOKEN_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
    isLoggedIn.value = true
  }

  function clearSession() {
    // El estado de Google es del usuario que sale: no puede verlo el siguiente.
    useGoogleStore().reset()
    useInboxStore().reset()
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    isLoggedIn.value = false
    isDemoMode.value = false
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }

  function applyLoginResponse(data: LoginResponse) {
    saveTokens(data.access_token, data.refresh_token)
    user.value = data.user
  }

  function trackLogin(method: 'google' | 'magic_link' | 'demo', userId: string) {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: 'login', method, user_id: userId })
  }

  // ─── Token refresh ───────────────────────────────────────────────────────────

  let refreshPromise: Promise<boolean> | null = null

  async function refreshAccessToken(): Promise<boolean> {
    // Deduplicate concurrent refresh attempts
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      const rt = refreshToken.value
      if (!rt) return false
      try {
        const res = await fetch(`${API_BASE}/auth/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        })
        if (!res.ok) { clearSession(); return false }
        const data = await res.json()
        saveTokens(data.access_token, data.refresh_token)
        return true
      } catch {
        return false
      } finally {
        refreshPromise = null
      }
    })()
    return refreshPromise
  }

  // Fetch wrapper that auto-retries once after refreshing on 401.
  // Skips the JSON Content-Type header for FormData bodies (multipart uploads) —
  // the browser must set its own boundary, so we can't fix the header ourselves.
  async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
    const isMultipart = init.body instanceof FormData
    const h = authHeaders({ json: !isMultipart })
    let res = await fetch(input, { ...init, headers: { ...h, ...(init.headers as Record<string, string> ?? {}) } })
    if (res.status === 401 && refreshToken.value && !isDemoMode.value) {
      const ok = await refreshAccessToken()
      if (ok) {
        const h2 = authHeaders({ json: !isMultipart })
        res = await fetch(input, { ...init, headers: { ...h2, ...(init.headers as Record<string, string> ?? {}) } })
      }
    }
    return res
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────

  /**
   * Login con Google: solo identidad (`openid email profile`), sin `access_type=offline` y con
   * `prompt=select_account`. Calendar y Contactos se piden aparte, cuando el usuario conecta esa
   * función (`useGoogleIntegration().startConnect`). El `state` se genera aquí y se guarda en
   * `sessionStorage` para que el callback rechace vueltas que no empezaron en esta pestaña.
   */
  function startGoogleLogin() {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      error.value = i18n.global.t('auth.errors.googleNotConfigured')
      return
    }
    const state = randomLoginState()
    savePending({ kind: 'login', state, createdAt: Date.now() })
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: oauthRedirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state,
    })
    redirectTo(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }

  async function loginWithGoogle(code: string, redirectUri: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/auth/google/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      })
      const data = await res.json()
      if (!res.ok) throw authFailure(data, 'googleAuth.callback.loginError')
      applyLoginResponse(data as LoginResponse)
      trackLogin('google', (data as LoginResponse).user.uuid)
    } catch (e) {
      error.value = authErrorMessage(e, 'auth.errors.unknown')
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Magic Link ──────────────────────────────────────────────────────────────

  async function requestMagicLink(email: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/auth/magic-link/request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        // 400 del serializer: el handler global lo envuelve (`error.details.email`); se acepta
        // también la forma plana de DRF (`{ email: [...] }`). 429: throttle de 5 enlaces/hora.
        const invalidEmail = Boolean(data?.error?.details?.email ?? (!data?.error && data?.email))
        const key =
          res.status === 429
            ? 'auth.errors.rateLimited'
            : invalidEmail
              ? 'auth.errors.invalidEmail'
              : 'auth.errors.magicLinkSend'
        throw authFailure(data, key)
      }
    } catch (e) {
      error.value = authErrorMessage(e, 'auth.errors.unknown')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function verifyMagicLink(token: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/auth/magic-link/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) throw authFailure(data, 'auth.magicLink.invalidOrExpired')
      applyLoginResponse(data as LoginResponse)
      trackLogin('magic_link', (data as LoginResponse).user.uuid)
    } catch (e) {
      error.value = authErrorMessage(e, 'auth.errors.unknown')
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Session ─────────────────────────────────────────────────────────────────

  async function fetchMe(): Promise<boolean> {
    if (!accessToken.value || isDemoMode.value) return isDemoMode.value
    try {
      const res = await fetch(`${API_BASE}/auth/me/`, { headers: authHeaders() })
      if (!res.ok) { clearSession(); return false }
      user.value = await res.json() as AuthUser
      return true
    } catch {
      return false
    }
  }

  /** Sustituye el usuario con la respuesta de la API (`useAuthProfile().updateMe`). */
  function setUser(data: AuthUser) {
    user.value = data
  }

  async function logout(): Promise<void> {
    if (!isDemoMode.value && accessToken.value) {
      try {
        // El backend pone el refresh token en la blacklist si se lo enviamos;
        // sin él el logout solo limpia la sesión local.
        await fetch(`${API_BASE}/auth/logout/`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken.value }),
        })
      } catch { /* ignore network errors */ }
    }
    clearSession()
  }

  // ─── Demo mode ───────────────────────────────────────────────────────────────

  function loginDemo() {
    useGoogleStore().reset()
    useInboxStore().reset()
    isDemoMode.value = true
    isLoggedIn.value = true
    user.value = {
      uuid: 'demo-user',
      email: 'demo@giras.pro',
      first_name: 'Demo',
      last_name: 'User',
      full_name: 'Demo User',
      phone_number: null,
      avatar: 'https://i.pravatar.cc/80?img=33',
      bio: '',
      timezone: 'UTC',
      language: 'es',
      google_id: null,
      telegram_id: null,
      is_verified: true,
      is_active: true,
      is_staff: false,
      is_superuser: false,
    }
    trackLogin('demo', 'demo-user')
    // Demo session is not persisted — resets on page reload
  }

  return {
    user,
    isLoggedIn,
    loading,
    error,
    accessToken,
    isDemoMode,
    startGoogleLogin,
    loginWithGoogle,
    requestMagicLink,
    verifyMagicLink,
    setUser,
    fetchMe,
    logout,
    loginDemo,
    refreshAccessToken,
    fetchWithAuth,
  }
})
