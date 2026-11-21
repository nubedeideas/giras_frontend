import { ref } from 'vue'
import i18n from '@/i18n'
import { ApiError, apiClient } from '@/utils/apiClient'
import { redirectTo } from '@/utils/navigation'
import {
  isSafeReturnTo,
  oauthRedirectUri,
  saveOnboardingResume,
  savePending,
  type GooglePurpose,
  type OnboardingResumeStep,
} from '@/utils/googleOAuth'

export type { GooglePurpose } from '@/utils/googleOAuth'
export { isSafeReturnTo } from '@/utils/googleOAuth'

// ─── Types (spec 2026-11-20-google-oauth-incremental §5.2) ────────────────────

/** GET /api/integrations/google/status/ (`google_status(user)`, sin llamadas a Google) */
export interface GoogleStatus {
  /** Hay refresh token guardado. */
  connected: boolean
  /** Cuenta de Google conectada; '' si no hay. */
  account_email: string
  granted_scopes: string[]
  features: { calendar: boolean; calendar_write: boolean; contacts: boolean }
  connected_at: string | null
}

/** POST /api/integrations/google/authorize/ */
export interface GoogleAuthorizeResponse {
  authorization_url: string
  state: string
  /** Scopes pedidos, para mostrarlos si hace falta. */
  scopes: string[]
}

/** POST /api/integrations/google/connect/ (`complete_connection`) */
export interface GoogleConnectResult {
  purpose: GooglePurpose
  return_to: string
  purpose_granted: boolean
  granted_scopes: string[]
  missing_scopes: string[]
  status: GoogleStatus
}

/** DELETE /api/integrations/google/disconnect/ (`disconnect`, idempotente) */
export interface GoogleDisconnectResult {
  status: GoogleStatus
  revoked_in_google: boolean
  calendars_deactivated: number
  contacts_deactivated: number
}

/** 403 de las vistas de Calendar y Contactos cuando falta el permiso o la conexión. */
export interface GoogleScopeMissingError {
  code: 'google_scope_missing'
  detail: string
  purpose: GooglePurpose
  required_scopes: string[]
  connected: boolean
}

export const EMPTY_GOOGLE_STATUS: GoogleStatus = {
  connected: false,
  account_email: '',
  granted_scopes: [],
  features: { calendar: false, calendar_write: false, contacts: false },
  connected_at: null,
}

export interface StartConnectOptions {
  onboarding?: { step: OnboardingResumeStep; tourId: number | null }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 403 `google_scope_missing`: la pantalla debe ofrecer "Conectar" en vez de un error. */
export function isGoogleScopeMissing(e: unknown): e is ApiError {
  return (
    e instanceof ApiError &&
    e.status === 403 &&
    (e.data as Partial<GoogleScopeMissingError> | null)?.code === 'google_scope_missing'
  )
}

/** `code` de negocio de un error de la API (`{code, detail}` planos), si lo trae. */
export function apiErrorCode(e: unknown): string | undefined {
  if (!(e instanceof ApiError)) return undefined
  const code = (e.data as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

/**
 * Código con el que traducir un error de Google: el `code` del backend o `rate_limited` en un
 * 429 (el throttle de DRF no trae `code`).
 */
export function googleErrorCode(e: unknown): string | undefined {
  const code = apiErrorCode(e)
  if (code) return code
  return e instanceof ApiError && e.status === 429 ? 'rate_limited' : undefined
}

/**
 * Mensaje en el idioma de la interfaz: `googleIntegration.errors.<code>` si existe y, si no, la
 * clave `fallbackKey`. Nunca el `detail` del backend, que viene siempre en español.
 */
export function googleErrorMessage(
  e: unknown,
  fallbackKey = 'googleIntegration.notice.error'
): string {
  const { t, te } = i18n.global
  const code = googleErrorCode(e)
  const key = code ? `googleIntegration.errors.${code}` : ''
  return key && te(key) ? t(key) : t(fallbackKey)
}

const tr = (key: string) => i18n.global.t(key)

// ─── API ──────────────────────────────────────────────────────────────────────

function getStatus(): Promise<GoogleStatus> {
  return apiClient.get<GoogleStatus>('/integrations/google/status/', {
    fallback: tr('googleIntegration.fallback.status'),
  })
}

function authorize(purpose: GooglePurpose, returnTo: string): Promise<GoogleAuthorizeResponse> {
  return apiClient.post<GoogleAuthorizeResponse>(
    '/integrations/google/authorize/',
    { purpose, return_to: returnTo, redirect_uri: oauthRedirectUri() },
    { fallback: tr('googleIntegration.fallback.authorize') }
  )
}

function connect(code: string, state: string, redirectUri: string): Promise<GoogleConnectResult> {
  return apiClient.post<GoogleConnectResult>(
    '/integrations/google/connect/',
    { code, state, redirect_uri: redirectUri },
    { fallback: tr('googleIntegration.notice.error') }
  )
}

/** Devuelve `undefined` si el backend responde 204 sin cuerpo. */
function disconnect(): Promise<GoogleDisconnectResult | undefined> {
  return apiClient.delete<GoogleDisconnectResult | undefined>('/integrations/google/disconnect/', {
    fallback: tr('googleIntegration.disconnect.error'),
  })
}

export const googleIntegrationApi = { getStatus, authorize, connect, disconnect }

// ─── Composable ───────────────────────────────────────────────────────────────

export function useGoogleIntegration() {
  /** Propósito cuya conexión se está iniciando (spinner del botón). */
  const connecting = ref<GooglePurpose | null>(null)
  const error = ref<string | null>(null)

  /**
   * Pide al backend la URL de Google, guarda el `pending` (y el punto de retorno del asistente
   * si se pasa) y redirige. Devuelve `false` si `authorize` falla (el mensaje queda en `error`).
   */
  async function startConnect(
    purpose: GooglePurpose,
    returnTo: string,
    options: StartConnectOptions = {}
  ): Promise<boolean> {
    connecting.value = purpose
    error.value = null
    const safeReturnTo = isSafeReturnTo(returnTo) ? returnTo : '/settings?tab=calendars'
    try {
      const res = await authorize(purpose, safeReturnTo)
      savePending({
        kind: 'connect',
        state: res.state,
        purpose,
        returnTo: safeReturnTo,
        createdAt: Date.now(),
      })
      if (options.onboarding) {
        saveOnboardingResume(options.onboarding.step, options.onboarding.tourId)
      }
      redirectTo(res.authorization_url)
      return true
    } catch (e) {
      error.value = googleErrorMessage(e, 'googleIntegration.fallback.authorize')
      connecting.value = null
      return false
    }
  }

  return {
    connecting,
    error,
    getStatus,
    authorize,
    connect,
    disconnect,
    startConnect,
    isGoogleScopeMissing,
    isSafeReturnTo,
  }
}
