import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'

/**
 * Cliente HTTP único para la API de Giras.
 *
 * - Resuelve las rutas relativas contra `API_BASE`; las URLs absolutas (p. ej. el `next`
 *   de la paginación de DRF) se usan tal cual.
 * - Delega en `useAuthStore().fetchWithAuth`, que añade `Authorization` y reintenta una vez
 *   tras refrescar el token en un 401 (`auth: false` para endpoints públicos).
 * - Parsea JSON y, si la respuesta no es 2xx, lanza un `ApiError` con un mensaje legible.
 *
 * El backend envuelve los errores en `apps.core.exceptions.custom_exception_handler`:
 *   { success: false, error: { message, status_code, details? } }
 * pero las vistas que devuelven `Response(..., status=4xx)` a mano no pasan por el handler y
 * llegan con el formato plano de DRF (`detail`, `error`, errores por campo). Se aceptan los dos.
 */

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

export type FieldErrors = Record<string, unknown>

export interface ApiErrorOptions {
  /** Mensaje propio si el backend no da uno legible. */
  fallback?: string
  /** Une todos los errores de campo (`campo: mensaje`, uno por línea) en vez del primero. */
  allFieldErrors?: boolean
  /** Mensajes propios por código de estado; tienen prioridad sobre todo lo demás. */
  statusMessages?: Partial<Record<number, string>>
}

const STATUS_MESSAGES: Record<number, string> = {
  0: 'No se ha podido conectar con el servidor. Comprueba tu conexión.',
  400: 'La solicitud no es válida.',
  401: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No se ha encontrado el recurso.',
  429: 'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.',
  500: 'Error del servidor. Inténtalo de nuevo más tarde.',
}

// Mensajes por defecto de DRF/handler: poco útiles o en "usted"; se sustituyen por los nuestros.
const GENERIC_BACKEND_MESSAGES = [
  'Error en la solicitud',
  'No encontrado.',
  'Usted no tiene permiso para realizar esta acción.',
]

const META_KEYS = new Set(['success', 'status_code', 'code'])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v || null
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = firstString(item)
      if (s) return s
    }
  }
  if (isRecord(v)) {
    for (const item of Object.values(v)) {
      const s = firstString(item)
      if (s) return s
    }
  }
  return null
}

/** Errores de campo de una respuesta de error, en cualquiera de los dos formatos del backend. */
export function extractFieldErrors(data: unknown): FieldErrors | null {
  if (!isRecord(data)) return null
  if (data.success === false && isRecord(data.error)) {
    return isRecord(data.error.details) ? data.error.details : null
  }
  const fields: FieldErrors = {}
  for (const [k, v] of Object.entries(data)) {
    if (k === 'detail' || k === 'error' || k === 'message' || META_KEYS.has(k)) continue
    if (Array.isArray(v) || isRecord(v)) fields[k] = v
  }
  return Object.keys(fields).length ? fields : null
}

/** Todos los errores como líneas legibles: `campo: mensaje` (sin prefijo para los generales). */
export function errorLines(data: unknown): string[] {
  const lines: string[] = []
  const general = backendMessage(data)
  const fields = extractFieldErrors(data)
  if (fields) {
    for (const [key, val] of Object.entries(fields)) {
      const values = Array.isArray(val) ? val : [val]
      for (const v of values) {
        const s = firstString(v)
        if (s) lines.push(key === 'non_field_errors' ? s : `${key}: ${s}`)
      }
    }
  }
  if (general && !GENERIC_BACKEND_MESSAGES.includes(general)) lines.unshift(general)
  return lines
}

/** Mensaje general (no de campo) que trae el backend, si lo hay. */
function backendMessage(data: unknown): string | null {
  if (typeof data === 'string') {
    // Las páginas HTML de error (nginx, Django DEBUG) no son un mensaje legible.
    return data.trim() && !data.trimStart().startsWith('<') ? data : null
  }
  if (Array.isArray(data)) return firstString(data)
  if (!isRecord(data)) return null
  if (data.success === false && isRecord(data.error)) return firstString(data.error.message)
  // `error` antes que `detail`: las vistas de acción (schedule, send, cancel...) devuelven en
  // `error` el mensaje para el usuario y en `detail` uno técnico.
  return firstString(data.error) ?? firstString(data.detail) ?? firstString(data.message)
}

/** Mensaje legible en español para un error de la API. */
export function apiErrorMessage(
  status: number,
  data: unknown,
  { fallback, allFieldErrors, statusMessages }: ApiErrorOptions = {}
): string {
  const override = statusMessages?.[status]
  if (override) return override
  const statusMessage =
    STATUS_MESSAGES[status] ?? (status >= 500 ? STATUS_MESSAGES[500] : STATUS_MESSAGES[400])
  if (status === 0 || status === 401 || status === 429) return statusMessage
  if (status >= 500) return fallback ?? statusMessage

  if (allFieldErrors) {
    const lines = errorLines(data)
    if (lines.length) return lines.join('\n')
  }
  const fields = extractFieldErrors(data)
  const fieldMessage =
    firstString(fields?.non_field_errors) ?? (fields ? firstString(fields) : null)
  const general = backendMessage(data)
  const generalUseful = general && !GENERIC_BACKEND_MESSAGES.includes(general) ? general : null
  if (fieldMessage ?? generalUseful) return (fieldMessage ?? generalUseful) as string
  // 403/404 sin mensaje útil: el estado dice más que el fallback genérico del composable
  // ("Error al cargar gira" ante un 403 confunde).
  if (status === 403 || status === 404) return statusMessage
  return fallback ?? statusMessage
}

export class ApiError extends Error {
  readonly status: number
  readonly data: unknown
  readonly fieldErrors: FieldErrors | null

  constructor(status: number, data: unknown, options: ApiErrorOptions = {}) {
    super(apiErrorMessage(status, data, options))
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.fieldErrors = extractFieldErrors(data)
  }
}

// ─── Cliente ──────────────────────────────────────────────────────────────────

export interface RequestOptions extends ApiErrorOptions {
  /** `false` para endpoints públicos: sin `Authorization` ni refresco de token. */
  auth?: boolean
  headers?: Record<string, string>
  signal?: AbortSignal
  /** `blob` para descargas de archivos. Por defecto, JSON (o texto si no es JSON). */
  responseType?: 'json' | 'blob'
}

type Body = FormData | Record<string, unknown> | unknown[] | object | undefined

export function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined
  const text = await res.text()
  if (!text) return undefined
  const type = res.headers.get('content-type') ?? ''
  if (type.includes('json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

async function request<T>(
  method: string,
  path: string,
  body?: Body,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, headers = {}, signal, responseType = 'json' } = options
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const init: RequestInit = { method, signal, headers: { ...headers } }
  if (body !== undefined) init.body = isForm ? (body as FormData) : JSON.stringify(body)
  if (!auth && !isForm) {
    init.headers = { 'Content-Type': 'application/json', ...headers }
  }

  const url = resolveUrl(path)
  let res: Response
  try {
    res = auth ? await useAuthStore().fetchWithAuth(url, init) : await fetch(url, init)
  } catch (e) {
    // fetch solo lanza TypeError ante fallos de red/CORS; cualquier otra excepción (abort,
    // bug en el store...) se relanza tal cual para no disfrazarla de "sin conexión".
    if (e instanceof TypeError) throw new ApiError(0, null, options)
    throw e
  }

  if (!res.ok) {
    const data = await parseBody(res).catch(() => null)
    throw new ApiError(res.status, data, options)
  }
  if (responseType === 'blob') return (await res.blob()) as T
  return (await parseBody(res)) as T
}

const MAX_PAGES = 100

/** Sigue el `next` de la paginación de DRF y devuelve todos los elementos. */
async function getAll<T>(path: string, options: RequestOptions = {}): Promise<T[]> {
  const all: T[] = []
  const visited = new Set<string>()
  let url: string | null = resolveUrl(path)
  while (url && !visited.has(url) && visited.size < MAX_PAGES) {
    visited.add(url)
    const data: Paginated<T> | T[] = await request<Paginated<T> | T[]>(
      'GET',
      url,
      undefined,
      options
    )
    if (!data) break
    if (Array.isArray(data)) {
      all.push(...data)
      break
    }
    all.push(...(data.results ?? []))
    url = data.next ?? null
  }
  return all
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: Body, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  put: <T>(path: string, body?: Body, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: Body, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T = void>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
  getAll,
}

/** Construye un query string ignorando valores vacíos o `undefined`. */
export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return q.toString()
}
