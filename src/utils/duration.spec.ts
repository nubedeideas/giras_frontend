import { describe, expect, it } from 'vitest'
import { formatDurationBetween } from './duration'

const START = '2026-03-10T18:00:00Z'

describe('formatDurationBetween', () => {
  it('formatea horas exactas', () => {
    expect(formatDurationBetween(START, '2026-03-10T20:00:00Z')).toBe('2 h')
  })

  it('formatea horas y minutos', () => {
    expect(formatDurationBetween(START, '2026-03-10T19:30:00Z')).toBe('1 h 30 min')
  })

  it('formatea solo minutos', () => {
    expect(formatDurationBetween(START, '2026-03-10T18:45:00Z')).toBe('45 min')
  })

  it('incluye los días (lo que el backend ignora)', () => {
    expect(formatDurationBetween(START, '2026-03-11T20:00:00Z')).toBe('1 d 2 h')
  })

  it('respeta los offsets de zona', () => {
    expect(formatDurationBetween('2026-03-10T18:00:00+01:00', '2026-03-10T18:00:00Z')).toBe('1 h')
  })

  it.each([
    ['sin fin', null],
    ['fin inválido', 'no-es-fecha'],
    ['fin anterior al inicio', '2026-03-10T17:00:00Z'],
    ['fin igual al inicio', START],
  ])('devuelve null con %s', (_label, end) => {
    expect(formatDurationBetween(START, end)).toBeNull()
  })

  it('nunca devuelve NaN', () => {
    for (const end of [null, '', 'x', START, '2026-03-10T18:01:00Z']) {
      expect(String(formatDurationBetween(START, end))).not.toContain('NaN')
    }
    expect(String(formatDurationBetween('basura', '2026-03-10T18:01:00Z'))).not.toContain('NaN')
  })
})
