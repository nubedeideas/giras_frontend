import { describe, expect, it } from 'vitest'
import { IMPORT_ENTRY_POINTS, IMPORT_EXPECTED } from '@/composables/useImportJobs'

// Contrato (F1 lote 3, ampliado en F2 §3.2 y §3.11): el backend valida `entry_point` contra
// `ImportJob.ENTRY_POINT_CHOICES` y `expected` contra `team | itinerary | any` (400 `invalid_value`
// si no). Ningún componente puede mandar otro valor.
const ALLOWED = new Set(['tour', 'onboarding', 'contacts', 'activities', 'dashboard'])
const ALLOWED_EXPECTED = new Set(['team', 'itinerary', 'any'])

const sources = import.meta.glob('/src/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('entry_point y expected del importador', () => {
  it('las listas del composable coinciden con las del backend', () => {
    expect(new Set(IMPORT_ENTRY_POINTS)).toEqual(ALLOWED)
    // F3: `subscription` solo lo pone el backend (jobs de una suscripción iCal); nunca se envía.
    expect((IMPORT_ENTRY_POINTS as readonly string[]).includes('subscription')).toBe(false)
    expect(new Set(IMPORT_EXPECTED)).toEqual(ALLOWED_EXPECTED)
  })

  it('solo valores válidos de entry-point en las plantillas', () => {
    const found: string[] = []
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/(?<![:\w-])entry-point="([^"]+)"/g)) {
        found.push(m[1])
        expect(ALLOWED.has(m[1]), `${file}: entry-point="${m[1]}"`).toBe(true)
      }
    }
    expect(new Set(found)).toEqual(ALLOWED)
  })

  it('solo valores válidos de expected en las plantillas', () => {
    const found: string[] = []
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/(?<![:\w-])expected="([^"]+)"/g)) {
        found.push(m[1])
        expect(ALLOWED_EXPECTED.has(m[1]), `${file}: expected="${m[1]}"`).toBe(true)
      }
    }
    expect(new Set(found)).toEqual(new Set(['team', 'itinerary']))
  })

  it('ningún componente envía entry_point="subscription"', () => {
    for (const [file, src] of Object.entries(sources)) {
      expect(/entry[-_]?[pP]oint[^\n]*['"]subscription['"]/.test(src), file).toBe(false)
    }
  })
})
