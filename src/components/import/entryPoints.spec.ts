import { describe, expect, it } from 'vitest'

// Contrato (F1, lote 3): el backend valida `entry_point` contra `ImportJob.ENTRY_POINT_CHOICES`
// (400 `invalid_value` si no). Ningún componente puede mandar otro valor.
const ALLOWED = new Set(['tour', 'onboarding', 'contacts'])

const sources = import.meta.glob('/src/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('entry_point del importador', () => {
  it('solo tour, onboarding o contacts en las plantillas', () => {
    const found: string[] = []
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/(?<![:\w-])entry-point="([^"]+)"/g)) {
        found.push(m[1])
        expect(ALLOWED.has(m[1]), `${file}: entry-point="${m[1]}"`).toBe(true)
      }
    }
    expect(new Set(found)).toEqual(ALLOWED)
  })
})
