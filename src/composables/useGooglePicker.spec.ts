import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { jsonResponse, mockFetch } from '@/test/http'

// Sin red: el `<script>` de `apis.google.com` nunca se descarga (jsdom no carga recursos); un
// MutationObserver simula su `load`/`error` y `gapi.load('picker')` instala un `google.picker`
// falso que registra cómo se configura el `PickerBuilder`.

type Mod = typeof import('./useGooglePicker')
type ScriptMode = 'load' | 'error' | 'hang'
type GapiMode = 'ok' | 'error' | 'timeout'

const GAPI_SRC = 'https://apis.google.com/js/api.js'
const TOKEN = 'ya29.picker-token'

function fakeGoogle(gapiMode: GapiMode = 'ok') {
  const viewCalls: [string, unknown][] = []
  const builderCalls: [string, unknown][] = []
  let callback: ((data: Record<string, unknown>) => void) | null = null
  const instance = {
    setVisible: vi.fn(() => instance),
    dispose: vi.fn(),
  }
  class DocsView {
    constructor(viewId?: string) {
      viewCalls.push(['new', viewId])
    }
    setMimeTypes(v: string) {
      viewCalls.push(['setMimeTypes', v])
      return this
    }
    setIncludeFolders(v: boolean) {
      viewCalls.push(['setIncludeFolders', v])
      return this
    }
    setMode(v: string) {
      viewCalls.push(['setMode', v])
      return this
    }
  }
  const builder: Record<string, unknown> = {}
  for (const m of [
    'addView',
    'enableFeature',
    'setOAuthToken',
    'setDeveloperKey',
    'setAppId',
    'setOrigin',
    'setLocale',
    'setTitle',
  ]) {
    builder[m] = (v: unknown) => {
      builderCalls.push([m, v])
      return builder
    }
  }
  builder.setCallback = (cb: (data: Record<string, unknown>) => void) => {
    callback = cb
    return builder
  }
  builder.build = vi.fn(() => instance)
  const ns = {
    DocsView,
    PickerBuilder: function PickerBuilder() {
      return builder
    },
    ViewId: { SPREADSHEETS: 'spreadsheets' },
    DocsViewMode: { LIST: 'list' },
    Feature: { SUPPORT_DRIVES: 'sdr' },
    Action: { PICKED: 'picked', CANCEL: 'cancel', LOADED: 'loaded' },
    Response: { ACTION: 'action', DOCUMENTS: 'docs' },
    Document: { ID: 'id', NAME: 'name', URL: 'url' },
  }
  const gapi = {
    load: vi.fn((_lib: string, cfg: GapiLoadConfig) => {
      if (gapiMode === 'error') return cfg.onerror?.()
      if (gapiMode === 'timeout') return cfg.ontimeout?.()
      window.google = { picker: ns as unknown as GooglePickerNamespace }
      cfg.callback()
    }),
  }
  return {
    gapi,
    instance,
    builder,
    viewCalls,
    builderCalls,
    emit: (data: Record<string, unknown>) => callback?.(data),
    arg: (method: string) => builderCalls.find(([m]) => m === method)?.[1],
  }
}

let observer: MutationObserver | null = null

/** Simula la descarga de `api.js` cada vez que se inserta. */
function serveScript(mode: ScriptMode, google: ReturnType<typeof fakeGoogle>) {
  observer = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLScriptElement) || node.src !== GAPI_SRC) return
        if (mode === 'load') {
          window.gapi = google.gapi
          node.dispatchEvent(new Event('load'))
        } else if (mode === 'error') {
          node.dispatchEvent(new Event('error'))
        }
      })
    }
  })
  observer.observe(document.head, { childList: true })
}

function gapiScripts() {
  return document.querySelectorAll(`script[src="${GAPI_SRC}"]`).length
}

async function load(): Promise<Mod> {
  vi.resetModules()
  return import('./useGooglePicker')
}

async function setLocale(locale: 'es' | 'en') {
  const { default: i18n } = await import('@/i18n')
  i18n.global.locale.value = locale
}

function configure() {
  vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', 'browser-key')
  vi.stubEnv('VITE_GOOGLE_CLOUD_APP_ID', '123456789012')
}

function mobileViewport(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }))
  )
}

const tokenOk = () => jsonResponse({ access_token: TOKEN, expires_in: 3599 })
const picked = (doc: Record<string, unknown>) => ({ action: 'picked', docs: [doc] })

async function codeOf(p: Promise<unknown>): Promise<string> {
  const err = await p.then(
    () => null,
    (e: unknown) => e
  )
  return (err as { code?: string } | null)?.code ?? 'resolved'
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

afterEach(() => {
  observer?.disconnect()
  observer = null
  document.querySelectorAll(`script[src="${GAPI_SRC}"]`).forEach((el) => el.remove())
  delete window.gapi
  delete window.google
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('isPickerConfigured', () => {
  it('exige las dos variables de build no vacías', async () => {
    const { isPickerConfigured } = await load()
    vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', '')
    vi.stubEnv('VITE_GOOGLE_CLOUD_APP_ID', '')
    expect(isPickerConfigured()).toBe(false)
    vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', 'key')
    expect(isPickerConfigured()).toBe(false)
    vi.stubEnv('VITE_GOOGLE_CLOUD_APP_ID', '  ')
    expect(isPickerConfigured()).toBe(false)
    vi.stubEnv('VITE_GOOGLE_CLOUD_APP_ID', '123456789012')
    expect(isPickerConfigured()).toBe(true)
  })
})

describe('pickSpreadsheet', () => {
  it('sin variables → not_configured, sin script ni token', async () => {
    const { pickSpreadsheet, isPickerError } = await load()
    vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', 'key')
    vi.stubEnv('VITE_GOOGLE_CLOUD_APP_ID', '')
    const fn = mockFetch()
    const err = await pickSpreadsheet({ title: 'x' }).catch((e: unknown) => e)
    expect(isPickerError(err) && err.code).toBe('not_configured')
    expect(gapiScripts()).toBe(0)
    expect(fn).not.toHaveBeenCalled()
  })

  it('carga el script solo al abrir y una sola vez; pide el token en cada apertura', async () => {
    const { pickSpreadsheet } = await load()
    configure()
    const google = fakeGoogle()
    serveScript('load', google)
    const fn = mockFetch(tokenOk(), tokenOk())
    expect(gapiScripts()).toBe(0)

    const first = pickSpreadsheet({ title: 'Elige' })
    await vi.waitFor(() => expect(google.instance.setVisible).toHaveBeenCalledWith(true))
    expect(gapiScripts()).toBe(1)
    expect(document.querySelector<HTMLScriptElement>(`script[src="${GAPI_SRC}"]`)?.async).toBe(true)
    google.emit({ action: 'cancel' })
    expect(await codeOf(first)).toBe('cancelled')

    const second = pickSpreadsheet()
    await vi.waitFor(() => expect(google.instance.setVisible).toHaveBeenCalledTimes(2))
    google.emit({ action: 'cancel' })
    await second.catch(() => null)

    expect(gapiScripts()).toBe(1)
    expect(google.gapi.load).toHaveBeenCalledTimes(1)
    expect(google.gapi.load.mock.calls[0][0]).toBe('picker')
    expect(google.gapi.load.mock.calls[0][1].timeout).toBe(15000)
    expect(fn).toHaveBeenCalledTimes(2)
    const [url, init] = fn.mock.calls[0]
    expect(String(url)).toBe('http://api.test/api/integrations/google/picker-token/')
    expect(init?.method).toBe('POST')
  })

  it('configura el builder (hojas de Google, unidades compartidas, clave, appId, origen, idioma) y no guarda el token', async () => {
    const { pickSpreadsheet } = await load()
    await setLocale('es')
    configure()
    const google = fakeGoogle()
    serveScript('load', google)
    mockFetch(tokenOk())

    const p = pickSpreadsheet({ title: 'Elige la hoja Gira 2027' })
    await vi.waitFor(() => expect(google.instance.setVisible).toHaveBeenCalledWith(true))
    expect(google.viewCalls).toEqual([
      ['new', 'spreadsheets'],
      ['setMimeTypes', 'application/vnd.google-apps.spreadsheet'],
      ['setIncludeFolders', false],
      ['setMode', 'list'],
    ])
    expect(google.arg('enableFeature')).toBe('sdr')
    expect(google.builderCalls.filter(([m]) => m === 'enableFeature')).toHaveLength(1)
    expect(google.arg('setOAuthToken')).toBe(TOKEN)
    expect(google.arg('setDeveloperKey')).toBe('browser-key')
    expect(google.arg('setAppId')).toBe('123456789012')
    expect(google.arg('setOrigin')).toBe(window.location.origin)
    expect(google.arg('setLocale')).toBe('es')
    expect(google.arg('setTitle')).toBe('Elige la hoja Gira 2027')

    google.emit({ action: 'loaded' })
    google.emit(
      picked({
        id: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
        name: 'Gira 2027 · Producción',
        url: 'https://docs.google.com/spreadsheets/d/1AbC/edit',
        mimeType: 'application/vnd.google-apps.spreadsheet',
      })
    )
    await expect(p).resolves.toEqual({
      id: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
      name: 'Gira 2027 · Producción',
      url: 'https://docs.google.com/spreadsheets/d/1AbC/edit',
    })
    expect(google.instance.dispose).toHaveBeenCalledOnce()

    const stored = [
      ...Object.keys(localStorage).map((k) => localStorage.getItem(k)),
      ...Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)),
    ].join('|')
    expect(stored).not.toContain(TOKEN)
    expect(localStorage.getItem('gs_access_token')).toBe('access')
  })

  it('en inglés usa setLocale("en") y el título por defecto traducido; sin url, la construye', async () => {
    const { pickSpreadsheet } = await load()
    await setLocale('en')
    configure()
    const google = fakeGoogle()
    serveScript('load', google)
    mockFetch(tokenOk())

    const p = pickSpreadsheet()
    await vi.waitFor(() => expect(google.instance.setVisible).toHaveBeenCalled())
    expect(google.arg('setLocale')).toBe('en')
    expect(google.arg('setTitle')).toBe('Choose a spreadsheet')
    google.emit(picked({ id: 'SHEET_ID_1234567890123456789', name: 'Tour' }))
    await expect(p).resolves.toEqual({
      id: 'SHEET_ID_1234567890123456789',
      name: 'Tour',
      url: 'https://docs.google.com/spreadsheets/d/SHEET_ID_1234567890123456789/edit',
    })
    await setLocale('es')
  })

  it('cerrar el selector → cancelled y el foco vuelve al botón que lo abrió', async () => {
    const { pickSpreadsheet } = await load()
    configure()
    const google = fakeGoogle()
    serveScript('load', google)
    mockFetch(tokenOk())
    const btn = document.createElement('button')
    document.body.appendChild(btn)
    btn.focus()

    const p = pickSpreadsheet()
    await vi.waitFor(() => expect(google.instance.setVisible).toHaveBeenCalled())
    btn.blur()
    google.emit({ action: 'cancel' })
    expect(await codeOf(p)).toBe('cancelled')
    expect(document.activeElement).toBe(btn)
    expect(google.instance.dispose).toHaveBeenCalledOnce()
    btn.remove()
  })

  it.each([
    [
      403,
      { code: 'google_scope_missing', detail: 'x', purpose: 'sheets', connected: true },
      'scope_missing',
    ],
    [502, { code: 'picker_token_unavailable', detail: 'x' }, 'token_failed'],
    [502, { code: 'google_unavailable', detail: 'x' }, 'token_failed'],
    [503, { code: 'google_not_configured', detail: 'x' }, 'not_configured'],
    [429, { detail: 'Request was throttled.' }, 'too_many_requests'],
    [
      429,
      {
        success: false,
        error: { message: 'Demasiadas solicitudes.', status_code: 429, details: {} },
      },
      'too_many_requests',
    ],
  ])('token %i %o → %s, sin abrir el selector', async (status, body, code) => {
    const { pickSpreadsheet } = await load()
    configure()
    const google = fakeGoogle()
    serveScript('load', google)
    mockFetch(jsonResponse(body, status))
    expect(await codeOf(pickSpreadsheet())).toBe(code)
    expect(google.builder.build).not.toHaveBeenCalled()
  })

  it('scope_missing lleva el connected del 403 (false = Google desconectado)', async () => {
    const { pickSpreadsheet } = await load()
    configure()
    serveScript('load', fakeGoogle())
    for (const connected of [true, false]) {
      mockFetch(
        jsonResponse({ code: 'google_scope_missing', detail: 'x', purpose: 'sheets', connected }, 403)
      )
      const err = await pickSpreadsheet().catch((e: unknown) => e)
      expect(err).toMatchObject({ code: 'scope_missing', connected })
    }
  })

  it('fallo de red del token → token_failed', async () => {
    const { pickSpreadsheet } = await load()
    configure()
    serveScript('load', fakeGoogle())
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await codeOf(pickSpreadsheet())).toBe('token_failed')
  })

  it('el script no carga → script_failed sin pedir token; el siguiente intento lo reinserta', async () => {
    const { pickSpreadsheet } = await load()
    configure()
    const google = fakeGoogle()
    serveScript('error', google)
    const fn = mockFetch()
    expect(await codeOf(pickSpreadsheet())).toBe('script_failed')
    expect(gapiScripts()).toBe(0)
    expect(fn).not.toHaveBeenCalled()

    observer?.disconnect()
    serveScript('load', google)
    fn.mockResolvedValueOnce(tokenOk())
    const p = pickSpreadsheet()
    await vi.waitFor(() => expect(google.instance.setVisible).toHaveBeenCalled())
    expect(gapiScripts()).toBe(1)
    google.emit({ action: 'cancel' })
    expect(await codeOf(p)).toBe('cancelled')
  })

  it('el script no responde en 15 s → script_failed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { pickSpreadsheet } = await load()
    configure()
    serveScript('hang', fakeGoogle())
    const fn = mockFetch()
    const p = codeOf(pickSpreadsheet())
    await vi.advanceTimersByTimeAsync(15000)
    expect(await p).toBe('script_failed')
    expect(fn).not.toHaveBeenCalled()
  })

  it.each(['error', 'timeout'] as const)('gapi.load("picker") con %s → script_failed', async (mode) => {
    const { pickSpreadsheet } = await load()
    configure()
    serveScript('load', fakeGoogle(mode))
    const fn = mockFetch()
    expect(await codeOf(pickSpreadsheet())).toBe('script_failed')
    expect(fn).not.toHaveBeenCalled()
  })

  it('en móvil, si el script no carga → mobile_unsupported', async () => {
    const { pickSpreadsheet } = await load()
    configure()
    mobileViewport(true)
    serveScript('error', fakeGoogle())
    expect(await codeOf(pickSpreadsheet())).toBe('mobile_unsupported')
  })

  it('en móvil, si el selector no llega a pintarse → mobile_unsupported y se descarta', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { pickSpreadsheet } = await load()
    configure()
    mobileViewport(true)
    const google = fakeGoogle()
    serveScript('load', google)
    mockFetch(tokenOk())
    const p = codeOf(pickSpreadsheet())
    await vi.waitFor(() => expect(google.instance.setVisible).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(20000)
    expect(await p).toBe('mobile_unsupported')
    expect(google.instance.dispose).toHaveBeenCalledOnce()
  })

  it('en móvil, con LOADED el selector sigue abierto y devuelve la hoja elegida', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { pickSpreadsheet } = await load()
    configure()
    mobileViewport(true)
    const google = fakeGoogle()
    serveScript('load', google)
    mockFetch(tokenOk())
    const p = pickSpreadsheet()
    await vi.waitFor(() => expect(google.instance.setVisible).toHaveBeenCalled())
    google.emit({ action: 'loaded' })
    await vi.advanceTimersByTimeAsync(60000)
    google.emit(picked({ id: 'SHEET_ID_1234567890123456789', name: 'Gira', url: 'https://x' }))
    await expect(p).resolves.toMatchObject({ id: 'SHEET_ID_1234567890123456789' })
  })

  it('el builder lanza al abrir → script_failed (escritorio) o mobile_unsupported (móvil)', async () => {
    for (const [mobile, code] of [
      [false, 'script_failed'],
      [true, 'mobile_unsupported'],
    ] as const) {
      const { pickSpreadsheet } = await load()
      configure()
      mobileViewport(mobile)
      const google = fakeGoogle()
      ;(google.builder.build as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('blocked')
      })
      serveScript('load', google)
      mockFetch(tokenOk())
      expect(await codeOf(pickSpreadsheet())).toBe(code)
      observer?.disconnect()
      document.querySelectorAll(`script[src="${GAPI_SRC}"]`).forEach((el) => el.remove())
      delete window.gapi
      delete window.google
    }
  })
})
