/**
 * Navegación fuera de la SPA (p. ej. a la pantalla de consentimiento de Google).
 * Vive en su propio módulo para poder mockearla en los tests (`vi.mock('@/utils/navigation')`):
 * jsdom no implementa la navegación de `window.location`.
 */
export function redirectTo(url: string): void {
  window.location.assign(url)
}
