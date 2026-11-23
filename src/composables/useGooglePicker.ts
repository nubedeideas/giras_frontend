// Selector de archivos de Google (Google Picker) para elegir la hoja que se vincula (F4 §4.2 bis).
//
// STUB del lote 1: expone la firma definitiva para que el formulario y la tarjeta se construyan
// contra ella. `isPickerConfigured()` ya es la real (las dos variables de build); `pickSpreadsheet`
// rechaza siempre con `not_configured`. El lote 3 sustituye el interior (carga a demanda de
// `apis.google.com/js/api.js`, token de `POST /integrations/google/picker-token/` o de Google
// Identity Services, `PickerBuilder` con `setAppId`) sin cambiar la firma.

export type PickerErrorCode =
  | 'not_configured'
  | 'script_failed'
  | 'token_failed'
  | 'scope_missing'
  | 'cancelled'

/** Hoja elegida: `id` del documento (el `spreadsheetId`) y su nombre en Drive. */
export interface PickedSheet {
  id: string
  name: string
}

export class PickerError extends Error {
  readonly code: PickerErrorCode

  constructor(code: PickerErrorCode) {
    super(`google_picker_${code}`)
    this.name = 'PickerError'
    this.code = code
  }
}

export function isPickerError(e: unknown): e is PickerError {
  return e instanceof PickerError
}

/**
 * Las dos variables de build no vacías (`VITE_GOOGLE_PICKER_API_KEY`, `VITE_GOOGLE_CLOUD_APP_ID`).
 * Sin alguna, ninguna entrada de "Vincular Google Sheets" se pinta (D-F4-16).
 */
export function isPickerConfigured(): boolean {
  const key = String(import.meta.env.VITE_GOOGLE_PICKER_API_KEY ?? '').trim()
  const appId = String(import.meta.env.VITE_GOOGLE_CLOUD_APP_ID ?? '').trim()
  return key !== '' && appId !== ''
}

/**
 * Abre el selector de Google con solo hojas de cálculo y resuelve con la elegida. Rechaza con
 * `PickerError(code)`; `cancelled` si el usuario lo cierra sin elegir.
 */
export function pickSpreadsheet(_opts: { title?: string } = {}): Promise<PickedSheet> {
  return Promise.reject(new PickerError('not_configured'))
}
