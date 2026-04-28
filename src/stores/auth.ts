import { defineStore } from 'pinia'
import { ref } from 'vue'

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
}

interface LoginResponse {
  access_token: string
  refresh_token: string
  user: AuthUser
  expires_in: number
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

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
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

  // Fetch wrapper that auto-retries once after refreshing on 401
  async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
    const h = authHeaders()
    let res = await fetch(input, { ...init, headers: { ...h, ...(init.headers as Record<string, string> ?? {}) } })
    if (res.status === 401 && refreshToken.value && !isDemoMode.value) {
      const ok = await refreshAccessToken()
      if (ok) {
        const h2 = authHeaders()
        res = await fetch(input, { ...init, headers: { ...h2, ...(init.headers as Record<string, string> ?? {}) } })
      }
    }
    return res
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────

  function startGoogleLogin() {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      error.value = 'Google Client ID no configurado'
      return
    }
    const redirectUri = `${window.location.origin}/auth/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
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
      if (!res.ok) throw new Error(data.error ?? 'Error al autenticar con Google')
      applyLoginResponse(data as LoginResponse)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error desconocido'
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
        const msg = data.error ?? data.email?.[0] ?? 'Error al enviar el link'
        throw new Error(msg)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error desconocido'
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
      if (!res.ok) throw new Error(data.error ?? 'Token inválido o expirado')
      applyLoginResponse(data as LoginResponse)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error desconocido'
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

  async function logout(): Promise<void> {
    if (!isDemoMode.value && accessToken.value) {
      try {
        await fetch(`${API_BASE}/auth/logout/`, {
          method: 'POST',
          headers: authHeaders(),
        })
      } catch { /* ignore network errors */ }
    }
    clearSession()
  }

  // ─── Demo mode ───────────────────────────────────────────────────────────────

  function loginDemo() {
    isDemoMode.value = true
    isLoggedIn.value = true
    user.value = {
      uuid: 'demo-user',
      email: 'demo@gigsync.io',
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
    }
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
    fetchMe,
    logout,
    loginDemo,
    refreshAccessToken,
    fetchWithAuth,
  }
})
