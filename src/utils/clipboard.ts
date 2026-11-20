/**
 * Copia texto al portapapeles desde un handler de clic.
 *
 * Si el texto aún no está (hay que pedirlo a la API), Safari rechaza `writeText` tras el
 * `await` porque se pierde la activación del usuario. Con `ClipboardItem` se pasa la promesa
 * en el mismo tick del clic y el navegador espera a que resuelva. Si no hay `ClipboardItem`,
 * se espera y se usa `writeText`.
 *
 * Devuelve el texto copiado; lanza si el navegador no permite copiar.
 */
export async function copyText(value: string | Promise<string>): Promise<string> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  if (!clipboard) throw new Error('clipboard_unavailable')

  if (typeof value !== 'string' && typeof ClipboardItem !== 'undefined' && clipboard.write) {
    const text = value
    const item = new ClipboardItem({
      'text/plain': text.then((s) => new Blob([s], { type: 'text/plain' })),
    })
    try {
      await clipboard.write([item])
      return await text
    } catch {
      // Si falló la petición, `await text` relanza el error de la API (no hay que reintentar);
      // si falló solo `write`, se prueba con `writeText`.
      const resolved = await text
      await clipboard.writeText(resolved)
      return resolved
    }
  }

  const text = await value
  await clipboard.writeText(text)
  return text
}
