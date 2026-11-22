/**
 * Zonas horarias de giras y actividades (spec F0 §4.3). Luxon valida los nombres IANA; la zona
 * del navegador solo vale como propuesta si es una zona real (no UTC).
 */
import { IANAZone } from 'luxon'
import { browserZone } from '@/utils/datetime'

/** Zonas que se ofrecen en los selectores (IANA). */
export const COMMON_TIMEZONES: readonly string[] = [
  'UTC',
  'America/Mexico_City',
  'America/Bogota',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Lisbon',
  'Europe/Rome',
  'America/Santiago',
  'America/Lima',
  'America/Chicago',
]

/** Respaldo cuando ni la gira ni el navegador dan una zona útil. */
export const FALLBACK_TOUR_ZONE = 'Europe/Madrid'

const UTC_ALIASES = new Set(['UTC', 'Etc/UTC', 'Etc/GMT', 'GMT', 'Etc/Universal', 'Universal'])

/** Nombre IANA válido según luxon. */
export function isValidZone(zone: string | null | undefined): zone is string {
  return !!zone && IANAZone.isValidZone(zone)
}

/** Zona por defecto de una gira nueva: la del navegador si es válida y no UTC; si no, Madrid. */
export function defaultTourZone(): string {
  let zone: string | null = null
  try {
    zone = browserZone()
  } catch {
    zone = null
  }
  return isValidZone(zone) && !UTC_ALIASES.has(zone) ? zone : FALLBACK_TOUR_ZONE
}

/** Opciones del selector: las comunes, con `current` al principio si no está entre ellas. */
export function zoneOptions(current?: string | null): string[] {
  const list = [...COMMON_TIMEZONES]
  if (current && !list.includes(current)) list.unshift(current)
  return list
}
