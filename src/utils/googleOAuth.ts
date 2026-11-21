/**
 * Estado del flujo OAuth de Google que sobrevive a la redirección (en `sessionStorage`).
 *
 * - `giras.oauth.pending`: qué se esperaba al volver a `/auth/callback` (login o conexión) y con
 *   qué `state`. El callback lo lee y lo borra siempre, y rechaza la vuelta si el `state` no
 *   coincide (protección CSRF del callback).
 * - `giras.onboarding.resume`: paso del asistente al que volver tras conectar Google desde él.
 */

export type GooglePurpose = 'calendar' | 'contacts'

export interface GoogleOAuthPending {
  kind: 'login' | 'connect'
  state: string
  purpose?: GooglePurpose
  returnTo?: string
  createdAt: number
}

export type OnboardingResumeStep = 'crew' | 'calendar'

export interface OnboardingResume {
  step: OnboardingResumeStep
  tourId: number | null
  createdAt: number
}

export const PENDING_KEY = 'giras.oauth.pending'
export const RESUME_KEY = 'giras.onboarding.resume'
export const RESUME_MAX_AGE_MS = 30 * 60 * 1000
/** Un `pending` más viejo no se acepta (el `state` firmado del backend caduca a los 10 min). */
export const PENDING_MAX_AGE_MS = 10 * 60 * 1000
export const DEFAULT_RETURN_TO = '/settings?tab=calendars'
export const OAUTH_REDIRECT_PATH = '/auth/callback'

/** `redirect_uri` registrado en el cliente OAuth: el mismo para login y conexión. */
export function oauthRedirectUri(): string {
  return `${window.location.origin}${OAUTH_REDIRECT_PATH}`
}

function storage(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage
}

function readJson(key: string): unknown {
  const raw = storage()?.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function savePending(pending: GoogleOAuthPending): void {
  storage()?.setItem(PENDING_KEY, JSON.stringify(pending))
}

/** Lee y borra el `pending`. `null` si no hay, no tiene la forma esperada o ha caducado. */
export function takePending(now = Date.now()): GoogleOAuthPending | null {
  const data = readJson(PENDING_KEY) as Partial<GoogleOAuthPending> | null
  storage()?.removeItem(PENDING_KEY)
  if (!data || typeof data !== 'object') return null
  if (data.kind !== 'login' && data.kind !== 'connect') return null
  if (typeof data.state !== 'string' || !data.state) return null
  if (typeof data.createdAt !== 'number' || now - data.createdAt > PENDING_MAX_AGE_MS) return null
  const purpose =
    data.purpose === 'calendar' || data.purpose === 'contacts' ? data.purpose : undefined
  return {
    kind: data.kind,
    state: data.state,
    purpose,
    returnTo: typeof data.returnTo === 'string' ? data.returnTo : undefined,
    createdAt: data.createdAt,
  }
}

export function saveOnboardingResume(step: OnboardingResumeStep, tourId: number | null): void {
  const resume: OnboardingResume = { step, tourId, createdAt: Date.now() }
  storage()?.setItem(RESUME_KEY, JSON.stringify(resume))
}

export function clearOnboardingResume(): void {
  storage()?.removeItem(RESUME_KEY)
}

/** Lee y borra el punto de retorno del asistente; `null` si no hay o ha caducado. */
export function takeOnboardingResume(now = Date.now()): OnboardingResume | null {
  const data = readJson(RESUME_KEY) as Partial<OnboardingResume> | null
  storage()?.removeItem(RESUME_KEY)
  if (!data || (data.step !== 'crew' && data.step !== 'calendar')) return null
  if (typeof data.createdAt !== 'number' || now - data.createdAt > RESUME_MAX_AGE_MS) return null
  return {
    step: data.step,
    tourId: typeof data.tourId === 'number' ? data.tourId : null,
    createdAt: data.createdAt,
  }
}

/** Ruta interna segura para volver tras Google: empieza por `/`, no por `//`, sin `://` ni `\`. */
export function isSafeReturnTo(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('://') &&
    !path.includes('\\')
  )
}

/** Añade (o sustituye) parámetros de query a una ruta interna, conservando los que ya tenga. */
export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path, 'http://giras.local')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v)
  }
  return `${url.pathname}${url.search}${url.hash}`
}

/** `state` aleatorio para el login (el de la conexión lo firma el backend). */
export function randomLoginState(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return `login.${c.randomUUID()}`
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return `login.${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}
