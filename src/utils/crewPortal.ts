import { DateTime } from 'luxon'
import type { CrewActivity, CrewActivityStatus } from '@/composables/useCrewPortal'

/**
 * Utilidades puras del portal del crew. Las horas salen siempre del offset que trae el ISO
 * (`setZone: true`), nunca de la zona del navegador: quien viaja vive la hora del sitio.
 */

/** "HH:mm" del instante en el offset del propio ISO. '' si no es válido. */
export function localTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { setZone: true })
  return dt.isValid ? dt.toFormat('HH:mm') : ''
}

/** Fecha local (YYYY-MM-DD) del ISO en su propio offset. */
export function localDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { setZone: true })
  return dt.isValid ? (dt.toISODate() ?? '') : ''
}

/**
 * Abreviatura de la zona en ese instante ("CET", "GMT-6"...). Se formatea en inglés porque
 * es el único locale con abreviaturas cortas estables para casi todas las zonas.
 */
export function zoneAbbr(iso: string, zone: string): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(zone)
  if (!dt.isValid) return ''
  return dt.setLocale('en-US').toFormat('ZZZZ')
}

export interface ActivityTimeLabel {
  start: string
  end: string
  /** Abreviatura de la zona de inicio si difiere de la del portal */
  startZone: string
  /** Abreviatura de la zona de fin si difiere de la de inicio */
  endZone: string
  /** El fin cae otro día local (p. ej. vuelo nocturno): "+1" */
  endDayOffset: number
}

/** Horas a mostrar para una actividad, con la zona solo cuando aporta. */
export function activityTimeLabel(activity: CrewActivity, portalZone: string): ActivityTimeLabel {
  const start = localTime(activity.start_local)
  const end = localTime(activity.end_local)
  const endZoneName = activity.end_timezone ?? activity.timezone
  const startZone =
    activity.timezone !== portalZone ? zoneAbbr(activity.start_local, activity.timezone) : ''
  const endZone =
    activity.end_local && endZoneName !== activity.timezone
      ? zoneAbbr(activity.end_local, endZoneName)
      : ''
  let endDayOffset = 0
  if (activity.end_local) {
    const s = DateTime.fromISO(localDate(activity.start_local))
    const e = DateTime.fromISO(localDate(activity.end_local))
    if (s.isValid && e.isValid) endDayOffset = Math.round(e.diff(s, 'days').days)
  }
  return { start, end, startZone, endZone, endDayOffset }
}

/** "+1" / "−1" (signo menos tipográfico) para el desfase de día del fin; '' si es 0. */
export function dayOffsetLabel(offset: number): string {
  if (!offset) return ''
  return offset > 0 ? `+${offset}` : `\u2212${Math.abs(offset)}`
}

/** "lunes, 24 nov" en el locale dado (fecha de calendario, sin zona). */
export function dayLabel(date: string, locale: string): string {
  const dt = DateTime.fromISO(date, { zone: 'utc' })
  return dt.isValid ? dt.setLocale(locale).toFormat('cccc, d LLL') : date
}

/** "24 nov 2026" en el locale dado. */
export function longDate(date: string, locale: string): string {
  const dt = DateTime.fromISO(date, { zone: 'utc' })
  return dt.isValid ? dt.setLocale(locale).toFormat('d LLL yyyy') : date
}

/** Rango de fechas de la gira: "1 – 12 dic 2026" o "28 nov – 3 dic 2026". */
export function dateRange(start: string, end: string, locale: string): string {
  const s = DateTime.fromISO(start, { zone: 'utc' }).setLocale(locale)
  const e = DateTime.fromISO(end, { zone: 'utc' }).setLocale(locale)
  if (!s.isValid || !e.isValid) return `${start} – ${end}`
  if (s.hasSame(e, 'day')) return e.toFormat('d LLL yyyy')
  if (s.hasSame(e, 'month')) return `${s.toFormat('d')} – ${e.toFormat('d LLL yyyy')}`
  if (s.hasSame(e, 'year')) return `${s.toFormat('d LLL')} – ${e.toFormat('d LLL yyyy')}`
  return `${s.toFormat('d LLL yyyy')} – ${e.toFormat('d LLL yyyy')}`
}

/** Tamaño legible de un fichero; '' si no se conoce. */
export function fileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Estados que merecen píldora (los normales no se marcan). */
export function showStatus(status: CrewActivityStatus): boolean {
  return status !== 'scheduled' && status !== 'confirmed'
}

export type DetailKey =
  | 'flight'
  | 'terminal'
  | 'gate'
  | 'delay'
  | 'hotel'
  | 'confirmation'
  | 'vehicle'
  | 'driver'

export interface DetailPart {
  key: DetailKey
  value: string
  /** `tel:` para el teléfono del conductor */
  href?: string
}

/**
 * Detalles en líneas cortas: vuelo · terminal · puerta · retraso; hotel · localizador;
 * vehículo · matrícula; conductor (con teléfono enlazado). Líneas vacías fuera.
 */
export function detailLines(details: CrewActivity['details']): DetailPart[][] {
  const d = details ?? {}
  const flight = [d.airline, d.flight_number].filter(Boolean).join(' ')
  const raw: (DetailPart | null)[][] = [
    [
      flight ? { key: 'flight', value: flight } : null,
      d.terminal ? { key: 'terminal', value: d.terminal } : null,
      d.gate ? { key: 'gate', value: d.gate } : null,
      d.delay_minutes ? { key: 'delay', value: String(d.delay_minutes) } : null,
    ],
    [
      d.hotel_name ? { key: 'hotel', value: d.hotel_name } : null,
      d.confirmation_number ? { key: 'confirmation', value: d.confirmation_number } : null,
    ],
    [
      d.transport_type || d.vehicle_plate
        ? {
            key: 'vehicle',
            value: [d.transport_type, d.vehicle_plate].filter(Boolean).join(' · '),
          }
        : null,
      d.driver_name || d.driver_phone
        ? {
            key: 'driver',
            value: [d.driver_name, d.driver_phone].filter(Boolean).join(' · '),
            href: d.driver_phone ? telHref(d.driver_phone) : undefined,
          }
        : null,
    ],
  ]
  return raw
    .map((line) => line.filter((p): p is DetailPart => p !== null))
    .filter((line) => line.length > 0)
}

/** `tel:` sin espacios ni separadores (conserva el `+` inicial). */
export function telHref(phone: string): string {
  const clean = phone.trim().replace(/[^\d+]/g, '')
  return `tel:${clean.startsWith('+') ? '+' + clean.slice(1).replace(/\+/g, '') : clean.replace(/\+/g, '')}`
}
