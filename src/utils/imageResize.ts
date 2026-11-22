/**
 * Reducción de fotos antes de subirlas al importador (spec F1 §4.1): lado mayor ≤ 1.600 px y
 * JPEG 0,85. Solo se llama desde manejadores de evento: `createImageBitmap` y `canvas` no
 * existen en el prerender de vite-ssg.
 */

export const IMAGE_MAX_SIDE = 1600
export const IMAGE_REENCODE_BYTES = 4 * 1024 * 1024
export const IMAGE_JPEG_QUALITY = 0.85

/** Tipos que el backend acepta tal cual; el resto (HEIC, GIF...) se convierte a JPEG. */
const PASSTHROUGH_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** La foto no se ha podido decodificar en este navegador (HEIC en Chrome): `importer.errors.heic`. */
export class ImageDecodeError extends Error {
  constructor(readonly fileName: string) {
    super(`No se puede decodificar ${fileName}`)
    this.name = 'ImageDecodeError'
  }
}

/** Tamaño de salida conservando la proporción; nunca amplía. */
export function targetSize(w: number, h: number, max = IMAGE_MAX_SIDE): { width: number; height: number } {
  const side = Math.max(w, h)
  if (side <= max || side <= 0) return { width: w, height: h }
  const ratio = max / side
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

export function needsReencode(
  file: Pick<File, 'type' | 'size'>,
  width: number,
  height: number
): boolean {
  return (
    !PASSTHROUGH_TYPES.has(file.type) ||
    Math.max(width, height) > IMAGE_MAX_SIDE ||
    file.size > IMAGE_REENCODE_BYTES
  )
}

function jpegName(name: string): string {
  const dot = name.lastIndexOf('.')
  return `${dot > 0 ? name.slice(0, dot) : name}.jpg`
}

/**
 * Devuelve la misma foto si ya cumple, o una copia JPEG reducida. Lanza `ImageDecodeError` si
 * el navegador no puede abrirla.
 */
export async function downscaleImage(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageDecodeError(file.name)
  }
  try {
    if (!needsReencode(file, bitmap.width, bitmap.height)) return file
    const { width, height } = targetSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageDecodeError(file.name)
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_JPEG_QUALITY)
    )
    if (!blob) throw new ImageDecodeError(file.name)
    return new File([blob], jpegName(file.name), { type: 'image/jpeg' })
  } finally {
    bitmap.close?.()
  }
}
