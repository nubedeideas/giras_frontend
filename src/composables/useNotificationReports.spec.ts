import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DateTime } from 'luxon'
import {
  rangeForPreset,
  useNotificationReports,
  type ReportsSummary,
} from './useNotificationReports'
import { ApiError } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

const metrics = {
  recipients: 0,
  pending: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  confirmed: 0,
  failed: 0,
}

const SUMMARY: ReportsSummary = {
  filters: { tour: null, from: '2026-10-22', to: '2026-11-20', tz: 'Europe/Madrid', channel: null },
  totals: { ...metrics, recipients: 3, sent: 2, confirmed: 1, failed: 1, confirmable_sent: 2 },
  // Solo email en entrega/lectura: el backend da null (no se mide).
  rates: { delivery_rate: null, read_rate: null, confirmation_rate: 50 },
  notifications: {
    total: 1,
    by_status: { draft: 0, scheduled: 0, sending: 0, sent: 1, failed: 0, cancelled: 0 },
  },
  by_channel: [
    { ...metrics, channel: 'whatsapp', tracks_delivery: true },
    { ...metrics, channel: 'email', tracks_delivery: false },
  ],
  by_type: [
    {
      ...metrics,
      notification_type: 'event_reminder',
      notifications: 1,
      sent: 2,
      confirmed: 1,
      confirmable_sent: 2,
    },
  ],
  by_tour: [],
  series: [],
  top_failed_contacts: [],
  failure_reasons: [],
  recent_notifications: [],
}

describe('useNotificationReports.getSummary', () => {
  it('manda los filtros como query y devuelve el resumen tal cual', async () => {
    const fetchMock = mockFetch(jsonResponse(SUMMARY))

    const data = await useNotificationReports().getSummary({
      tour: 't-1',
      from: '2026-11-01',
      to: '2026-11-20',
      tz: 'Europe/Madrid',
      channel: 'whatsapp',
    })

    expect(data).toEqual(SUMMARY)
    const { url, headers } = callAt(fetchMock, 0)
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(
      'http://api.test/api/notifications/reports/summary/'
    )
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      tour: 't-1',
      from: '2026-11-01',
      to: '2026-11-20',
      tz: 'Europe/Madrid',
      channel: 'whatsapp',
    })
    expect(headers.Authorization).toBe('Bearer access')
  })

  it('sin filtros solo manda tz, la zona del navegador', async () => {
    const fetchMock = mockFetch(jsonResponse(SUMMARY))
    await useNotificationReports().getSummary()
    const params = new URL(callAt(fetchMock, 0).url).searchParams
    expect([...params.keys()]).toEqual(['tz'])
    expect(params.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it('un 400 de rango lanza ApiError con el texto del backend', async () => {
    mockFetch(
      jsonResponse({ error: 'El rango no puede superar 366 días', code: 'range_too_long' }, 400)
    )
    const err = await useNotificationReports()
      .getSummary({ from: '2024-01-01', to: '2026-01-01' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(400)
    expect((err as ApiError).message).toBe('El rango no puede superar 366 días')
  })

  it('un 500 usa el fallback en español', async () => {
    mockFetch(jsonResponse({ detail: 'boom' }, 500))
    const err = await useNotificationReports().getSummary().catch((e: unknown) => e)
    expect((err as ApiError).message).toBe('No se han podido cargar los informes')
  })
})

describe('useNotificationReports.getContactHistory', () => {
  it('pide el contacto con página y tamaño y devuelve la página de DRF', async () => {
    const page = { count: 21, next: 'http://api.test/api/x?page=2', previous: null, results: [] }
    const fetchMock = mockFetch(jsonResponse(page))

    const data = await useNotificationReports().getContactHistory('c-1', {
      page: 1,
      pageSize: 20,
      tour: 't-1',
    })

    expect(data).toEqual(page)
    const parsed = new URL(callAt(fetchMock, 0).url)
    expect(parsed.pathname).toBe('/api/notifications/reports/contact-history/')
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      contact: 'c-1',
      tour: 't-1',
      page: '1',
      page_size: '20',
    })
  })

  it('un 404 de contacto ajeno lanza ApiError', async () => {
    mockFetch(
      jsonResponse(
        { success: false, error: { message: 'Contacto no encontrado', status_code: 404 } },
        404
      )
    )
    const err = await useNotificationReports()
      .getContactHistory('otro')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe('Contacto no encontrado')
  })
})

describe('rangeForPreset', () => {
  const now = DateTime.fromISO('2026-11-20T23:30:00Z')

  it('los últimos N días incluyen hoy en la zona pedida', () => {
    expect(rangeForPreset('last7', 'UTC', null, now)).toEqual({
      from: '2026-11-14',
      to: '2026-11-20',
    })
    // 23:30 UTC ya es 21 de noviembre en Madrid
    expect(rangeForPreset('last30', 'Europe/Madrid', null, now)).toEqual({
      from: '2026-10-23',
      to: '2026-11-21',
    })
  })

  it('gira completa usa sus fechas y se anula sin gira o si pasa de 366 días', () => {
    const tour = { start_date: '2026-03-01', end_date: '2026-06-30' }
    expect(rangeForPreset('fullTour', 'UTC', tour, now)).toEqual({
      from: '2026-03-01',
      to: '2026-06-30',
    })
    expect(rangeForPreset('fullTour', 'UTC', null, now)).toBeNull()
    expect(
      rangeForPreset('fullTour', 'UTC', { start_date: '2025-01-01', end_date: '2026-01-02' }, now)
    ).toBeNull()
    expect(
      rangeForPreset('fullTour', 'UTC', { start_date: '2025-01-01', end_date: '2026-01-01' }, now)
    ).toEqual({ from: '2025-01-01', to: '2026-01-01' })
  })
})
