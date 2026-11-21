import { DateTime } from 'luxon'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Tiempo relativo corto para listas ("hace 5 minutos", "ayer"...).
 *
 * - Menos de 1 minuto (o una fecha futura por desfase de reloj): `nowLabel`.
 * - Minutos, horas y días con `Intl.RelativeTimeFormat(locale, { numeric: 'auto' })`.
 * - Más de 7 días: fecha corta con `Intl.DateTimeFormat` (con año si no es el actual).
 */
export function formatRelativeTime(
  iso: string,
  locale: string,
  nowLabel: string,
  now: DateTime = DateTime.now()
): string {
  const date = DateTime.fromISO(iso)
  if (!date.isValid) return ''
  const diff = now.toMillis() - date.toMillis()
  if (diff < MINUTE) return nowLabel

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), 'minute')
  if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), 'hour')
  if (diff <= 7 * DAY) return rtf.format(-Math.floor(diff / DAY), 'day')

  const sameYear = date.toLocal().year === now.toLocal().year
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date.toJSDate())
}
