// Selector de archivos de Google (Google Picker) para elegir la hoja que se vincula (F4 §4.2 bis).
//
// - Nada se carga hasta que el usuario pulsa: `https://apis.google.com/js/api.js` se inserta una
//   sola vez (promesa cacheada; si falla, el siguiente intento lo reintenta) y después
//   `gapi.load('picker')`. Error o tiempo agotado → `script_failed`.
// - Token: `POST /integrations/google/picker-token/` (reducido a `drive.file`, `no-store`). Vive
//   solo en una variable local mientras el selector está abierto; nunca va a un store ni a storage.
// - `setAppId` con el número del proyecto es lo que concede `drive.file` sobre la hoja elegida.
// - Móvil (< 1024 px): si el script o el selector no llegan a abrirse → `mobile_unsupported`
//   ("vincula la hoja desde el ordenador").
import i18n from '@/i18n'
import { apiClient, ApiError } from '@/utils/apiClient'
import { sheetApiErrorCode } from '@/utils/sheetSubscriptions'
import { MOBILE_QUERY } from '@/composables/useIsMobile'
import { isGoogleDisconnected } from '@/composables/useGoogleIntegration'

export type PickerErrorCode =
  | 'not_configured'
  | 'script_failed'
  | 'token_failed'
  | 'scope_missing'
  | 'too_many_requests'
  | 'mobile_unsupported'
  | 'cancelled'

/** Hoja elegida: `id` del documento (el `spreadsheetId`), su nombre y su URL en Drive. */
export interface PickedSheet {
  id: string
  name: string
  url: string
}

export class PickerError extends Error {
  readonly code: PickerErrorCode
  /** `scope_missing`: `connected` del 403 de `picker-token` (`false` = Google desconectado). */
  readonly connected?: boolean

  constructor(code: PickerErrorCode, opts: { connected?: boolean } = {}) {
    super(`google_picker_${code}`)
    this.name = 'PickerError'
    this.code = code
    this.connected = opts.connected
  }
}

export function isPickerError(e: unknown): e is PickerError {
  return e instanceof PickerError
}

/** Respuesta de `POST /api/integrations/google/picker-token/` (`GooglePickerTokenView`). */
interface PickerTokenResponse {
  access_token: string
  expires_in: number
}

export const GAPI_SRC = 'https://apis.google.com/js/api.js'
/** Tiempo máximo para el script y para `gapi.load('picker')`. */
export const PICKER_LOAD_TIMEOUT_MS = 15000
/** En móvil, si Google no avisa de que el selector se ha pintado (`LOADED`) en este tiempo. */
export const MOBILE_OPEN_TIMEOUT_MS = 20000
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet'

function pickerConfig(): { apiKey: string; appId: string } | null {
  const apiKey = String(import.meta.env.VITE_GOOGLE_PICKER_API_KEY ?? '').trim()
  const appId = String(import.meta.env.VITE_GOOGLE_CLOUD_APP_ID ?? '').trim()
  return apiKey && appId ? { apiKey, appId } : null
}

/**
 * Las dos variables de build no vacías (`VITE_GOOGLE_PICKER_API_KEY`, `VITE_GOOGLE_CLOUD_APP_ID`).
 * Sin alguna, ninguna entrada de "Vincular Google Sheets" se pinta (D-F4-16).
 */
export function isPickerConfigured(): boolean {
  return pickerConfig() !== null
}

function isMobileViewport(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches
}

// ─── Carga del script ─────────────────────────────────────────────────────────

let pickerApi: Promise<GooglePickerNamespace> | null = null

function injectGapi(): Promise<GapiLoader> {
  if (window.gapi?.load) return Promise.resolve(window.gapi)
  return new Promise((resolve, reject) => {
    document.querySelectorAll(`script[src="${GAPI_SRC}"]`).forEach((el) => el.remove())
    const script = document.createElement('script')
    script.src = GAPI_SRC
    script.async = true
    const fail = () => {
      clearTimeout(timer)
      script.remove()
      reject(new PickerError('script_failed'))
    }
    const timer = setTimeout(fail, PICKER_LOAD_TIMEOUT_MS)
    script.onload = () => {
      clearTimeout(timer)
      if (window.gapi?.load) resolve(window.gapi)
      else fail()
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
}

function loadPickerModule(gapi: GapiLoader): Promise<GooglePickerNamespace> {
  if (window.google?.picker) return Promise.resolve(window.google.picker)
  return new Promise((resolve, reject) => {
    const fail = () => reject(new PickerError('script_failed'))
    gapi.load('picker', {
      callback: () => (window.google?.picker ? resolve(window.google.picker) : fail()),
      onerror: fail,
      timeout: PICKER_LOAD_TIMEOUT_MS,
      ontimeout: fail,
    })
  })
}

/** Script + módulo `picker`, una sola vez; un fallo deja la caché vacía para reintentar. */
function loadPickerApi(): Promise<GooglePickerNamespace> {
  if (!pickerApi) {
    pickerApi = injectGapi()
      .then(loadPickerModule)
      .catch((e: unknown) => {
        pickerApi = null
        throw e
      })
  }
  return pickerApi
}

// ─── Token ────────────────────────────────────────────────────────────────────

async function fetchPickerToken(): Promise<string> {
  let data: PickerTokenResponse | undefined
  try {
    data = await apiClient.post<PickerTokenResponse>('/integrations/google/picker-token/')
  } catch (e) {
    const code = sheetApiErrorCode(e)
    // 403 `google_scope_missing`: el formulario vuelve al paso de conectar Google Sheets.
    if (code === 'google_scope_missing') {
      throw new PickerError('scope_missing', { connected: !isGoogleDisconnected(e) })
    }
    // 503: la integración con Google no está configurada en el servidor.
    if (code === 'google_not_configured') throw new PickerError('not_configured')
    // 429 del throttle de `picker-token`: "demasiadas solicitudes", no "no se pudo abrir".
    if (e instanceof ApiError && e.status === 429) throw new PickerError('too_many_requests')
    // 502 `picker_token_unavailable` / `google_unavailable`, red...
    throw new PickerError('token_failed')
  }
  if (!data || typeof data.access_token !== 'string' || !data.access_token) {
    throw new PickerError('token_failed')
  }
  return data.access_token
}

// ─── Selector ─────────────────────────────────────────────────────────────────

function firstDocument(
  picker: GooglePickerNamespace,
  data: GooglePickerResponseObject
): PickedSheet | null {
  const docs = data[picker.Response.DOCUMENTS]
  const doc = Array.isArray(docs) ? (docs[0] as Record<string, unknown> | undefined) : undefined
  const rawId = doc?.[picker.Document.ID]
  const id = typeof rawId === 'string' ? rawId : ''
  if (!doc || !id) return null
  const rawName = doc[picker.Document.NAME]
  const name = typeof rawName === 'string' ? rawName : ''
  const rawUrl = doc[picker.Document.URL]
  const url =
    typeof rawUrl === 'string' && rawUrl
      ? rawUrl
      : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`
  return { id, name, url }
}

function openPicker(
  picker: GooglePickerNamespace,
  config: { apiKey: string; appId: string },
  token: string,
  title: string,
  mobile: boolean
): Promise<PickedSheet> {
  return new Promise((resolve, reject) => {
    const active = document.activeElement
    const returnFocus = active instanceof HTMLElement ? active : null
    let instance: GooglePickerInstance | null = null
    let watchdog: ReturnType<typeof setTimeout> | undefined
    let settled = false

    const finish = (settle: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      try {
        instance?.dispose()
      } catch {
        // El selector ya se ha cerrado: nada que limpiar.
      }
      instance = null
      settle()
      // Google pinta el selector en su propio iframe: devolvemos el foco al botón que lo abrió.
      if (returnFocus?.isConnected) returnFocus.focus()
    }

    const onPick = (data: GooglePickerResponseObject) => {
      const action = data[picker.Response.ACTION]
      if (action === picker.Action.LOADED) {
        clearTimeout(watchdog)
      } else if (action === picker.Action.CANCEL) {
        finish(() => reject(new PickerError('cancelled')))
      } else if (action === picker.Action.PICKED) {
        const sheet = firstDocument(picker, data)
        finish(() => (sheet ? resolve(sheet) : reject(new PickerError('cancelled'))))
      }
    }

    const locale = i18n.global.locale.value === 'es' ? 'es' : 'en'
    try {
      const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
        .setMimeTypes(SPREADSHEET_MIME)
        .setIncludeFolders(false)
        .setMode(picker.DocsViewMode.LIST)
      instance = new picker.PickerBuilder()
        .addView(view)
        .enableFeature(picker.Feature.SUPPORT_DRIVES)
        .setOAuthToken(token)
        .setDeveloperKey(config.apiKey)
        .setAppId(config.appId)
        .setOrigin(window.location.origin)
        .setLocale(locale)
        .setTitle(title)
        .setCallback(onPick)
        .build()
      instance.setVisible(true)
    } catch {
      finish(() => reject(new PickerError(mobile ? 'mobile_unsupported' : 'script_failed')))
      return
    }
    if (mobile) {
      watchdog = setTimeout(
        () => finish(() => reject(new PickerError('mobile_unsupported'))),
        MOBILE_OPEN_TIMEOUT_MS
      )
    }
  })
}

/**
 * Abre el selector de Google con solo hojas de cálculo y resuelve con la elegida. Rechaza con
 * `PickerError(code)`; `cancelled` si el usuario lo cierra sin elegir.
 */
export async function pickSpreadsheet(opts: { title?: string } = {}): Promise<PickedSheet> {
  const config = typeof window === 'undefined' ? null : pickerConfig()
  if (!config) throw new PickerError('not_configured')
  const mobile = isMobileViewport()

  let picker: GooglePickerNamespace
  try {
    picker = await loadPickerApi()
  } catch {
    throw new PickerError(mobile ? 'mobile_unsupported' : 'script_failed')
  }
  // Después del script: el token se pide justo antes de abrir y no sale de esta llamada.
  const token = await fetchPickerToken()
  const title = opts.title || i18n.global.t('sheets.picker.title')
  return openPicker(picker, config, token, title, mobile)
}
