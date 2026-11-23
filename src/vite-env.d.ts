/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID: string
  readonly VITE_SPOTIFY_CLIENT_SECRET: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_API_URL: string
  /** Clave de API del navegador para Google Picker (F4). Vacía → "Vincular Google Sheets" oculto. */
  readonly VITE_GOOGLE_PICKER_API_KEY?: string
  /** Número del proyecto de Google Cloud del cliente OAuth (`setAppId` del Picker, F4). */
  readonly VITE_GOOGLE_CLOUD_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  dataLayer: unknown[]
  gtag: (...args: unknown[]) => void
}
