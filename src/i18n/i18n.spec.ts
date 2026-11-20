import { describe, expect, it } from 'vitest'
import es from './es'
import en from './en'

function leafKeys(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [prefix]
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => leafKeys(v, prefix ? `${prefix}.${k}` : k))
  }
  return [prefix]
}

describe('i18n', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    const esKeys = new Set(leafKeys(es))
    const enKeys = new Set(leafKeys(en))
    expect([...esKeys].filter((k) => !enKeys.has(k))).toEqual([])
    expect([...enKeys].filter((k) => !esKeys.has(k))).toEqual([])
  })

  // Sin \b: no reconoce letras acentuadas, así que "ingresá" nunca casaría.
  const voseo =
    /(?<!\p{L})(ingresá|intentá|elegí|podés|tenés|querés|hacé|escribí|seleccioná|agregá|confirmás|explicá|creá|sabés|mirá|probá)(?!\p{L})/iu

  it('la regex de voseo detecta formas con tilde final', () => {
    expect(voseo.test('Ingresá el nombre')).toBe(true)
    expect(voseo.test('Elegí un pool')).toBe(true)
    expect(voseo.test('Introduce el nombre')).toBe(false)
    expect(voseo.test('Ingresar')).toBe(false)
  })

  it('el español no usa voseo', () => {
    const offenders = leafKeys(es).filter((k) => {
      const v = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], es)
      return typeof v === 'string' && voseo.test(v)
    })
    expect(offenders).toEqual([])
  })
})
