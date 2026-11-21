import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTwilioCosts } from './useTwilioCosts'
import { ApiError } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { tourCostsReport } from '@/test/twilioCosts'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

describe('useTwilioCosts.getTourCosts', () => {
  it('builds costs query with tour from to tz', async () => {
    const report = tourCostsReport()
    const fetchMock = mockFetch(jsonResponse(report))

    const data = await useTwilioCosts().getTourCosts({
      tour: 'T1',
      from: '2026-10-23',
      to: '2026-11-21',
      tz: 'Europe/Madrid',
    })

    expect(data).toEqual(report)
    const { url, headers } = callAt(fetchMock, 0)
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(
      'http://api.test/api/notifications/reports/costs/'
    )
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      tour: 'T1',
      from: '2026-10-23',
      to: '2026-11-21',
      tz: 'Europe/Madrid',
    })
    expect(headers.Authorization).toBe('Bearer access')
  })

  it('403 surfaces ApiError status', async () => {
    mockFetch(
      jsonResponse(
        {
          success: false,
          error: {
            message: 'Usted no tiene permiso para realizar esta acción.',
            status_code: 403,
          },
        },
        403
      )
    )
    const err = await useTwilioCosts()
      .getTourCosts({ tour: 'T1', tz: 'UTC' })
      .catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(403)
    expect(err.message).toBe('No tienes permiso para realizar esta acción.')
  })

  it('400 plano de reports conserva el mensaje del backend', async () => {
    mockFetch(jsonResponse({ error: 'Falta el parámetro tour', code: 'missing_tour' }, 400))
    const err = await useTwilioCosts()
      .getTourCosts({ tour: '', tz: 'UTC' })
      .catch((e) => e)
    expect(err.status).toBe(400)
    expect(err.message).toBe('Falta el parámetro tour')
  })
})
