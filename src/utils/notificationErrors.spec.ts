import { describe, expect, it } from 'vitest'
import { ApiError } from '@/utils/apiClient'
import {
  apiErrorCodes,
  hasApiErrorCode,
  isPlanLimitError,
  isQuotaRetryPending,
  isQuotaUnavailableError,
  SCHEDULED_AFTER_ACTIVITY,
} from './notificationErrors'
import { isStaleNotice } from './notices'

describe('notificationErrors', () => {
  it('lee el código de la forma envuelta', () => {
    const e = new ApiError(403, {
      success: false,
      error: {
        message: 'Sin cupo',
        status_code: 403,
        details: { plan: ['Sin cupo'], code: ['plan_limit_reached'], usage: { used: 5 } },
      },
    })
    expect(isPlanLimitError(e)).toBe(true)
  })

  it('lee el código del 403 heredado de send y remind-unconfirmed', () => {
    const e = new ApiError(403, {
      error: 'Límite de notificaciones alcanzado',
      detail: 'Has usado 500 de 500',
      usage: { used: 500, limit: 500, remaining: 0 },
      details: { code: ['plan_limit_reached'] },
    })
    expect(isPlanLimitError(e)).toBe(true)
  })

  it('detecta scheduled_after_activity del PATCH', () => {
    const e = new ApiError(400, {
      success: false,
      error: {
        message: 'x',
        status_code: 400,
        details: { scheduled_for: ['Antes del inicio'], code: ['scheduled_after_activity'] },
      },
    })
    expect(hasApiErrorCode(e, SCHEDULED_AFTER_ACTIVITY)).toBe(true)
    expect(isPlanLimitError(e)).toBe(false)
  })

  it('reconoce el 503 plan_limit_unavailable de send', () => {
    const e = new ApiError(503, {
      success: false,
      error: {
        message: 'No se ha podido comprobar el cupo de WhatsApp.',
        status_code: 503,
        details: { plan: ['x'], code: ['plan_limit_unavailable'] },
      },
    })
    expect(isQuotaUnavailableError(e)).toBe(true)
    expect(isPlanLimitError(e)).toBe(false)
  })

  it('marca la notificación retenida por quota_error mientras está fallida o programada', () => {
    const metadata = { quota_error: 'plan_limit_unavailable', quota_retries: 5 }
    expect(isQuotaRetryPending({ status: 'failed', metadata })).toBe(true)
    expect(isQuotaRetryPending({ status: 'scheduled', metadata })).toBe(true)
    expect(isQuotaRetryPending({ status: 'sent', metadata })).toBe(false)
    expect(isQuotaRetryPending({ status: 'failed', metadata: {} })).toBe(false)
    expect(isQuotaRetryPending({ status: 'failed', metadata: null })).toBe(false)
  })

  it('sin código o sin ApiError devuelve vacío', () => {
    expect(apiErrorCodes(new ApiError(403, { detail: 'No' }))).toEqual([])
    expect(apiErrorCodes(new Error('x'))).toEqual([])
  })

  it('un 409 de cupo en avisos no se trata como aviso obsoleto (no se recarga)', () => {
    const wrapped = (code: string) =>
      new ApiError(409, {
        success: false,
        error: { message: 'x', status_code: 409, details: { channel: ['x'], code: [code] } },
      })
    expect(isStaleNotice(wrapped('plan_limit_reached'))).toBe(false)
    expect(isStaleNotice(wrapped('notice_not_pending'))).toBe(true)
  })
})
