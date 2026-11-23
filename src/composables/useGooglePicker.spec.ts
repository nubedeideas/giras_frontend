import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPickerConfigured, isPickerError, pickSpreadsheet, PickerError } from './useGooglePicker'

// Lote 1: solo la configuración y la firma del stub; el selector real (script, token,
// `PickerBuilder`) y sus pruebas llegan en el lote 3.
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('useGooglePicker (stub)', () => {
  it('isPickerConfigured exige las dos variables de build no vacías', () => {
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

  it('pickSpreadsheet rechaza con PickerError not_configured y no carga nada', async () => {
    const before = document.querySelectorAll('script').length
    const err = await pickSpreadsheet({ title: 'x' }).catch((e: unknown) => e)
    expect(isPickerError(err)).toBe(true)
    expect((err as PickerError).code).toBe('not_configured')
    expect(document.querySelectorAll('script').length).toBe(before)
  })
})
