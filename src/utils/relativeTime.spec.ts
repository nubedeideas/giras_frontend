import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { formatRelativeTime } from './relativeTime'

const NOW = DateTime.fromISO('2026-11-21T12:00:00Z')
const ago = (o: Record<string, number>) => NOW.minus(o).toUTC().toISO()!

describe('formatRelativeTime', () => {
  it('now, minutes, hours, days and absolute date after 7 days', () => {
    const es = (iso: string) => formatRelativeTime(iso, 'es', 'Ahora', NOW)
    const en = (iso: string) => formatRelativeTime(iso, 'en', 'Just now', NOW)

    expect(es(ago({ seconds: 30 }))).toBe('Ahora')
    expect(en(ago({ seconds: 30 }))).toBe('Just now')
    // Fecha futura por desfase de reloj: "ahora".
    expect(es(NOW.plus({ minutes: 2 }).toISO()!)).toBe('Ahora')

    expect(es(ago({ minutes: 5 }))).toBe('hace 5 minutos')
    expect(en(ago({ minutes: 5 }))).toBe('5 minutes ago')
    expect(es(ago({ hours: 3 }))).toBe('hace 3 horas')
    expect(en(ago({ hours: 1 }))).toBe('1 hour ago')
    expect(es(ago({ days: 1 }))).toBe('ayer')
    expect(en(ago({ days: 3 }))).toBe('3 days ago')
    expect(es(ago({ days: 7 }))).toBe('hace 7 días')

    const old = ago({ days: 20 })
    expect(es(old)).toBe(
      new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(
        DateTime.fromISO(old).toJSDate()
      )
    )
    const lastYear = ago({ days: 400 })
    expect(en(lastYear)).toMatch(/2025/)

    expect(es('no-es-una-fecha')).toBe('')
  })
})
