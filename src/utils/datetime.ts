import { DateTime } from 'luxon'

// ─── Timezone catalogue ───────────────────────────────────────────────────────

export interface TimezoneOption {
  value: string
  label: string
  offset?: string // computed at runtime
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'America/Mexico_City',              label: 'México (CDMX / Monterrey)' },
  { value: 'America/Cancun',                   label: 'México (Cancún / Quintana Roo)' },
  { value: 'America/Chihuahua',                label: 'México (Chihuahua / Sonora)' },
  { value: 'America/Tijuana',                  label: 'México (Tijuana / Baja California)' },
  { value: 'America/Guatemala',                label: 'Guatemala / El Salvador / Honduras' },
  { value: 'America/Costa_Rica',               label: 'Costa Rica' },
  { value: 'America/Bogota',                   label: 'Colombia / Perú / Ecuador' },
  { value: 'America/Caracas',                  label: 'Venezuela' },
  { value: 'America/Lima',                     label: 'Perú' },
  { value: 'America/Santiago',                 label: 'Chile' },
  { value: 'America/Argentina/Buenos_Aires',   label: 'Argentina' },
  { value: 'America/Sao_Paulo',                label: 'Brasil (São Paulo / Brasília)' },
  { value: 'America/New_York',                 label: 'EE.UU. Este (ET)' },
  { value: 'America/Chicago',                  label: 'EE.UU. Centro (CT)' },
  { value: 'America/Denver',                   label: 'EE.UU. Montaña (MT)' },
  { value: 'America/Los_Angeles',              label: 'EE.UU. Oeste (PT)' },
  { value: 'Europe/Madrid',                    label: 'España' },
  { value: 'Europe/London',                    label: 'Reino Unido' },
  { value: 'Europe/Paris',                     label: 'Francia / Bélgica / Países Bajos' },
  { value: 'Europe/Berlin',                    label: 'Alemania / Europa Central (CET)' },
  { value: 'Europe/Rome',                      label: 'Italia' },
  { value: 'UTC',                              label: 'UTC (Tiempo Universal)' },
]

/** Devuelve el huso horario del navegador (IANA). */
export function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// ─── Conversiones para <input type="datetime-local"> ─────────────────────────

/**
 * Convierte un ISO UTC del backend al valor que debe mostrar un
 * <input type="datetime-local">, interpretado en la zona dada.
 *
 * El input siempre muestra la hora "local de la zona", no la del navegador.
 *
 * @param iso  String ISO recibido del backend (ej: "2025-06-20T18:00:00Z")
 * @param zone IANA timezone (ej: "America/Mexico_City")
 * @returns    "YYYY-MM-DDTHH:MM" para el input, o "" si iso es vacío
 */
export function isoToInputValue(iso: string | null | undefined, zone: string): string {
  if (!iso) return ''
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm")
}

/**
 * Convierte el valor de un <input type="datetime-local"> a un ISO UTC
 * para enviar al backend, interpretando el valor como hora en la zona dada.
 *
 * @param value Valor del input "YYYY-MM-DDTHH:MM"
 * @param zone  IANA timezone en que el usuario ingresó la hora
 * @returns     ISO UTC (ej: "2025-06-21T00:00:00.000Z"), o null si vacío
 */
export function inputValueToIso(value: string, zone: string): string | null {
  if (!value) return null
  const dt = DateTime.fromISO(value, { zone })
  if (!dt.isValid) return null
  return dt.toUTC().toISO()
}

// ─── Formateo para mostrar en pantalla ───────────────────────────────────────

/**
 * Formatea un ISO UTC para mostrar al usuario en la zona especificada.
 * Incluye el nombre corto del offset (ej: "GMT-6") para mayor claridad.
 *
 * @param iso  ISO UTC del backend
 * @param zone IANA timezone de referencia (generalmente send_timezone de la notificación)
 * @returns    Ej: "20 Jun 2025 · 18:00 (GMT-6)"
 */
export function formatInZone(iso: string | null | undefined, zone: string): string {
  if (!iso) return '—'
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const date = `${dt.day} ${months[dt.month - 1]} ${dt.year}`
  const time = dt.toFormat('HH:mm')
  const offset = dt.toFormat('ZZ').replace(':00', '')
  return `${date} · ${time} (GMT${offset})`
}

/**
 * Versión sin indicador de zona — para contextos donde la zona ya es evidente.
 */
export function formatInZoneShort(iso: string | null | undefined, zone: string): string {
  if (!iso) return '—'
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${dt.day} ${months[dt.month - 1]} ${dt.year} · ${dt.toFormat('HH:mm')}`
}

/**
 * Devuelve el offset legible de una zona en un momento dado.
 * Ej: "America/Mexico_City" → "GMT-6"
 */
export function zoneOffset(zone: string): string {
  const dt = DateTime.now().setZone(zone)
  return 'GMT' + dt.toFormat('ZZ').replace(':00', '')
}
