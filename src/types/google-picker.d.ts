// Tipos mínimos del cargador `gapi` (https://apis.google.com/js/api.js) y de Google Picker, solo lo
// que usa `composables/useGooglePicker.ts` (F4 §4.2 bis). Sin dependencia nueva: si hiciera falta
// más superficie, `@types/google.picker` como dependencia de desarrollo.

/** Objeto que Google pasa al callback del selector (`Response.ACTION`, `Response.DOCUMENTS`). */
type GooglePickerResponseObject = Record<string, unknown>

interface GooglePickerDocsView {
  setMimeTypes(mimeTypes: string): GooglePickerDocsView
  setIncludeFolders(include: boolean): GooglePickerDocsView
  setMode(mode: string): GooglePickerDocsView
}

interface GooglePickerInstance {
  setVisible(visible: boolean): GooglePickerInstance
  dispose(): void
}

interface GooglePickerBuilder {
  addView(view: GooglePickerDocsView): GooglePickerBuilder
  enableFeature(feature: string): GooglePickerBuilder
  setOAuthToken(token: string): GooglePickerBuilder
  setDeveloperKey(key: string): GooglePickerBuilder
  setAppId(appId: string): GooglePickerBuilder
  setOrigin(origin: string): GooglePickerBuilder
  setLocale(locale: string): GooglePickerBuilder
  setTitle(title: string): GooglePickerBuilder
  setCallback(callback: (data: GooglePickerResponseObject) => void): GooglePickerBuilder
  build(): GooglePickerInstance
}

interface GooglePickerNamespace {
  DocsView: new (viewId?: string) => GooglePickerDocsView
  PickerBuilder: new () => GooglePickerBuilder
  ViewId: { SPREADSHEETS: string }
  DocsViewMode: { LIST: string }
  Feature: { SUPPORT_DRIVES: string }
  Action: { PICKED: string; CANCEL: string; LOADED: string }
  Response: { ACTION: string; DOCUMENTS: string }
  Document: { ID: string; NAME: string; URL: string }
}

interface GapiLoadConfig {
  callback: () => void
  onerror?: () => void
  timeout?: number
  ontimeout?: () => void
}

interface GapiLoader {
  load(libraries: string, config: GapiLoadConfig): void
}

interface Window {
  gapi?: GapiLoader
  google?: { picker?: GooglePickerNamespace }
}
