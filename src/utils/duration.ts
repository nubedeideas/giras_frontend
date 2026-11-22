/**
 * Duración de una actividad calculada en el cliente desde `scheduled_at`/`end_at`.
 * El campo `duration` del backend es un string ("2h 0m") que además ignora los días
 * (`delta.seconds`), así que no se usa para pintar.
 */
import { DateTime } from 'luxon'

const MIN_PER_HOUR = 60
const MIN_PER_DAY = 24 * MIN_PER_HOUR

export function formatDurationBetween(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null
  const start = DateTime.fromISO(startIso)
  const end = DateTime.fromISO(endIso)
  if (!start.isValid || !end.isValid) return null
  const minutes = Math.round(end.diff(start, 'minutes').minutes)
  if (!Number.isFinite(minutes) || minutes <= 0) return null

  const days = Math.floor(minutes / MIN_PER_DAY)
  const hours = Math.floor((minutes % MIN_PER_DAY) / MIN_PER_HOUR)
  const mins = minutes % MIN_PER_HOUR

  const parts: string[] = []
  if (days > 0) parts.push(`${days} d`)
  if (hours > 0) parts.push(`${hours} h`)
  // Con días, los minutos sueltos no aportan: "1 d 2 h"
  if (mins > 0 && days === 0) parts.push(`${mins} min`)
  return parts.join(' ')
}
