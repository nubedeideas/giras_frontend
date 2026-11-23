import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import { icalApiError, icalSub } from '@/test/icalSubscriptions'
import type { IcalSyncStatus } from '@/composables/useIcalSubscriptions'
import {
  calendarCountsText,
  icalApiErrorKey,
  icalErrorKey,
  icalReviewBadge,
  icalStatusBadge,
  icalUrlProblem,
  isValidIcalUrlInput,
  pendingJobCount,
  retryMinutes,
} from './icalSubscriptions'

const BADGES = ['sent', 'pending', 'scheduled', 'failed', 'off']

describe('icalStatusBadge', () => {
  it('cada estado da un BadgeStatus y una clave que existe en ES y EN', () => {
    const cases: [IcalSyncStatus, string, string][] = [
      ['ok', 'sent', 'ical.status.ok'],
      ['not_modified', 'sent', 'ical.status.ok'],
      ['pending', 'scheduled', 'ical.status.pending'],
      ['error', 'failed', 'ical.status.error'],
      ['paused', 'off', 'ical.status.paused'],
      ['tour_closed', 'off', 'ical.status.ended'],
      ['tour_ended', 'off', 'ical.status.ended'],
    ]
    for (const [status, badge, key] of cases) {
      const b = icalStatusBadge(icalSub({ last_status: status }))
      expect(b).toEqual({ status: badge, labelKey: key })
      expect(BADGES).toContain(b.status)
      expect(i18n.global.te(key, 'es')).toBe(true)
      expect(i18n.global.te(key, 'en')).toBe(true)
    }
  })

  it('"Cambios por revisar" solo con el job en ready; recuento del job', () => {
    expect(icalReviewBadge(icalSub())).toBeNull()
    const job = { uuid: 'J1', status: 'extracting' as const, created_at: '', new: 2, changed: 1, cancelled: 1 }
    expect(icalReviewBadge(icalSub({ pending_job: job }))).toBeNull()
    expect(icalReviewBadge(icalSub({ pending_job: { ...job, status: 'ready' } }))).toEqual({
      status: 'pending',
      labelKey: 'ical.status.review',
    })
    expect(pendingJobCount(icalSub({ pending_job: job }))).toBe(4)
    expect(pendingJobCount(icalSub())).toBe(0)
  })
})

describe('icalErrorKey', () => {
  it('tabla de §3.8.1, con claves en ES y EN', () => {
    const cases: [string, string][] = [
      ['https_required', 'ical.errors.invalid_url'],
      // Puerto o host no permitidos: no es un problema de "https://" sino de dirección no pública.
      ['port_not_allowed', 'ical.errors.not_public'],
      ['host_not_allowed', 'ical.errors.not_public'],
      ['invalid_url', 'ical.errors.invalid_url'],
      ['credentials_in_url', 'ical.errors.credentials_in_url'],
      ['dns_failed', 'ical.errors.connect'],
      ['connection_failed', 'ical.errors.connect'],
      ['tls_error', 'ical.errors.connect'],
      ['timeout', 'ical.errors.connect'],
      ['too_many_redirects', 'ical.errors.connect'],
      ['http_5xx', 'ical.errors.connect'],
      ['http_502', 'ical.errors.connect'],
      ['http_401', 'ical.errors.gone'],
      ['http_403', 'ical.errors.gone'],
      ['http_404', 'ical.errors.gone'],
      ['http_410', 'ical.errors.gone'],
      ['too_large', 'ical.errors.tooLarge'],
      ['ics_too_large', 'ical.errors.tooLarge'],
      ['not_ics', 'ical.errors.notIcs'],
      ['ics_unreadable', 'ical.errors.notIcs'],
      ['', 'ical.errors.generic'],
      ['raro', 'ical.errors.generic'],
    ]
    for (const [code, key] of cases) {
      expect(icalErrorKey(code), code).toBe(key)
      expect(i18n.global.te(key, 'es')).toBe(true)
      expect(i18n.global.te(key, 'en')).toBe(true)
    }
    expect(icalErrorKey(null)).toBe('ical.errors.generic')
  })
})

describe('icalApiErrorKey', () => {
  const err = (code: string, status = 400, extra = {}) =>
    new ApiError(status, icalApiError(code, status, extra))

  it('traduce los códigos de §3.9 con sus parámetros', () => {
    expect(icalApiErrorKey(err('invalid_url', 400, { reason: 'credentials_in_url' }))).toEqual({
      key: 'ical.errors.credentials_in_url',
    })
    expect(icalApiErrorKey(err('invalid_url', 400, { reason: 'port_not_allowed' }))).toEqual({
      key: 'ical.errors.not_public',
    })
    expect(i18n.global.t('ical.errors.not_public')).toBe('La dirección no es válida o no es pública.')
    expect(i18n.global.t('ical.errors.not_public')).not.toContain('https://')
    expect(icalApiErrorKey(err('invalid_url'))).toEqual({ key: 'ical.errors.invalid_url' })
    expect(icalApiErrorKey(err('already_subscribed', 409, { subscription_uuid: 'S1' }))).toEqual({
      key: 'ical.errors.already_subscribed',
    })
    expect(icalApiErrorKey(err('too_many_subscriptions'))).toEqual({
      key: 'ical.errors.too_many_subscriptions',
      named: { max: 5 },
    })
    expect(icalApiErrorKey(err('too_many_subscriptions', 400, { max: 3 })).named).toEqual({ max: 3 })
    expect(icalApiErrorKey(err('tour_closed')).key).toBe('ical.errors.tour_closed')
    expect(icalApiErrorKey(err('sync_disabled')).key).toBe('ical.errors.sync_disabled')
    expect(icalApiErrorKey(err('sync_too_soon', 429, { retry_after_seconds: 130 }))).toEqual({
      key: 'ical.errors.sync_too_soon',
      named: { minutes: 3 },
    })
  })

  it('por estado sin código; nunca el código crudo', () => {
    expect(icalApiErrorKey(new ApiError(403, { detail: 'x' })).key).toBe('ical.errors.forbidden')
    expect(icalApiErrorKey(new ApiError(404, null)).key).toBe('ical.errors.notFound')
    // Al crear, el 404 es de la gira (no existe o no la ves), no de la suscripción.
    expect(icalApiErrorKey(new ApiError(404, null), 'create').key).toBe('ical.errors.tourNotFound')
    expect(i18n.global.te('ical.errors.tourNotFound', 'en')).toBe(true)
    expect(icalApiErrorKey(new ApiError(429, null)).key).toBe('common.tooManyRequests')
    expect(icalApiErrorKey(new ApiError(0, null)).key).toBe('importer.errors.network')
    expect(icalApiErrorKey(err('invalid_value')).key).toBe('ical.errors.generic')
    expect(icalApiErrorKey(new Error('x')).key).toBe('ical.errors.generic')
  })

  it('retryMinutes redondea arriba, mínimo 1 y 5 por defecto', () => {
    expect(retryMinutes(err('sync_too_soon', 429, { retry_after_seconds: 30 }))).toBe(1)
    expect(retryMinutes(err('sync_too_soon', 429, { retry_after_seconds: 241 }))).toBe(5)
    expect(retryMinutes(err('sync_too_soon', 429))).toBe(5)
  })
})

describe('isValidIcalUrlInput', () => {
  it('https, webcal y webcals; nada más', () => {
    expect(isValidIcalUrlInput('https://p52-caldav.icloud.com/published/2/abc')).toBe(true)
    expect(isValidIcalUrlInput('  webcal://p52-caldav.icloud.com/published/2/abc  ')).toBe(true)
    expect(isValidIcalUrlInput('webcals://example.com/cal.ics')).toBe(true)
    expect(isValidIcalUrlInput('HTTPS://calendar.google.com/calendar/ical/x/basic.ics')).toBe(true)
    expect(isValidIcalUrlInput('http://example.com/cal.ics')).toBe(false)
    expect(isValidIcalUrlInput('ftp://example.com/cal.ics')).toBe(false)
    expect(isValidIcalUrlInput('example.com/cal.ics')).toBe(false)
    expect(isValidIcalUrlInput('https://')).toBe(false)
    expect(isValidIcalUrlInput('https://exa mple.com/cal.ics')).toBe(false)
    expect(isValidIcalUrlInput('')).toBe(false)
    expect(isValidIcalUrlInput(`https://example.com/${'a'.repeat(2000)}`)).toBe(false)
  })

  it('con usuario o contraseña: credentials_in_url', () => {
    expect(icalUrlProblem('https://user:pass@example.com/cal.ics')).toBe('credentials_in_url')
    expect(icalUrlProblem('webcal://user@example.com/cal.ics')).toBe('credentials_in_url')
    // Una @ en la ruta o la query no es una credencial.
    expect(icalUrlProblem('https://example.com/cal.ics?owner=a@b.com')).toBeNull()
  })
})

describe('calendarCountsText', () => {
  const t = (key: string, named: Record<string, number>, n: number) =>
    i18n.global.t(key, named, n)

  it('solo los recuentos mayores que 0, con plural, unidos con " · "', () => {
    i18n.global.locale.value = 'es'
    expect(calendarCountsText(t, { new: 3, changed: 1, cancelled: 0 })).toBe('3 nuevas · 1 cambiada')
    expect(calendarCountsText(t, { new: 1, changed: 0, cancelled: 2 })).toBe(
      '1 nueva · 2 canceladas'
    )
    expect(calendarCountsText(t, { new: 0, changed: 0, cancelled: 0 })).toBe('')
    i18n.global.locale.value = 'en'
    expect(calendarCountsText(t, { new: 1, changed: 2, cancelled: 1 })).toBe(
      '1 new · 2 changed · 1 cancelled'
    )
    i18n.global.locale.value = 'es'
  })
})
