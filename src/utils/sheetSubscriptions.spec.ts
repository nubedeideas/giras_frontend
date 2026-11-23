import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import type { BadgeStatus } from '@/utils/statusBadge'
import { sheetSub } from '@/test/sheetSubscriptions'
import { icalApiError } from '@/test/icalSubscriptions'
import type { SheetSyncStatus } from '@/composables/useSheetSubscriptions'
import {
  pickerErrorKey,
  sheetApiErrorKey,
  sheetCellUrl,
  sheetCountsText,
  sheetErrorKey,
  sheetPendingCount,
  sheetReviewBadge,
  sheetStatusBadge,
} from './sheetSubscriptions'

const BADGE_STATUSES: BadgeStatus[] = ['sent', 'pending', 'scheduled', 'failed', 'off']
const te = (key: string) => i18n.global.te(key, 'es') && i18n.global.te(key, 'en')

function apiError(status: number, data: unknown) {
  return new ApiError(status, data)
}

/** Forma real de `ImportJobError.as_payload()`: `details = {<campo>: [msg], code: [...]}`. */
function invalidValue(details: Record<string, string[]>) {
  return {
    success: false,
    error: {
      message: 'Valor no válido.',
      status_code: 400,
      details: { ...details, code: ['invalid_value'] },
    },
  }
}

describe('sheetStatusBadge / sheetReviewBadge', () => {
  it('solo valores de BadgeStatus y claves que existen', () => {
    const statuses: SheetSyncStatus[] = [
      'pending',
      'ok',
      'not_modified',
      'error',
      'paused',
      'tour_closed',
      'tour_ended',
    ]
    const expected: Record<SheetSyncStatus, string> = {
      pending: 'scheduled',
      ok: 'sent',
      not_modified: 'sent',
      error: 'failed',
      paused: 'off',
      tour_closed: 'off',
      tour_ended: 'off',
    }
    for (const s of statuses) {
      const b = sheetStatusBadge({ last_status: s })
      expect(BADGE_STATUSES).toContain(b.status)
      expect(b.status).toBe(expected[s])
      expect(te(b.labelKey)).toBe(true)
    }
  })

  it('cambios por revisar solo con el job en ready, y su recuento', () => {
    const job = { uuid: 'J', status: 'ready' as const, created_at: '', new: 3, changed: 1, removed: 2 }
    const b = sheetReviewBadge(sheetSub({ pending_job: job }))
    expect(b).toEqual({ status: 'pending', labelKey: 'sheets.status.review' })
    expect(sheetReviewBadge(sheetSub({ pending_job: { ...job, status: 'extracting' } }))).toBeNull()
    expect(sheetReviewBadge(sheetSub())).toBeNull()
    expect(sheetPendingCount(sheetSub({ pending_job: job }))).toBe(6)
    expect(sheetPendingCount(sheetSub())).toBe(0)
  })
})

describe('sheetErrorKey', () => {
  it('tabla de §3.4.3, nunca el código crudo', () => {
    const cases: Record<string, string> = {
      google_access_lost: 'sheets.errors.accessLost',
      google_disconnected: 'sheets.errors.accessLost',
      reader_not_admin: 'sheets.errors.readerNotAdmin',
      no_access: 'sheets.errors.readerNoAccess',
      sheet_not_found: 'sheets.errors.readerNotFound',
      tab_missing: 'sheets.errors.tabMissing',
      google_unavailable: 'sheets.errors.generic',
      sync_failed: 'sheets.errors.generic',
      algo_nuevo: 'sheets.errors.generic',
      '': 'sheets.errors.generic',
    }
    for (const [code, key] of Object.entries(cases)) {
      expect(sheetErrorKey(code)).toBe(key)
      expect(te(key)).toBe(true)
    }
    expect(sheetErrorKey(null)).toBe('sheets.errors.generic')
  })

  it('pickerErrorKey: cancelled no es error', () => {
    expect(pickerErrorKey('cancelled')).toBeNull()
    for (const code of [
      'script_failed',
      'token_failed',
      'scope_missing',
      'too_many_requests',
      'mobile_unsupported',
      'not_configured',
    ] as const) {
      const key = pickerErrorKey(code)
      expect(key && te(key)).toBe(true)
    }
    expect(pickerErrorKey('too_many_requests')).toBe('common.tooManyRequests')
  })
})

describe('sheetApiErrorKey', () => {
  it('códigos de negocio envueltos', () => {
    expect(sheetApiErrorKey(apiError(400, icalApiError('no_access')))).toEqual({
      key: 'sheets.errors.no_access',
    })
    expect(sheetApiErrorKey(apiError(400, icalApiError('sheet_not_found'))).key).toBe(
      'sheets.errors.sheet_not_found'
    )
    expect(sheetApiErrorKey(apiError(502, icalApiError('google_unavailable', 502))).key).toBe(
      'sheets.errors.google_unavailable'
    )
    expect(sheetApiErrorKey(apiError(400, invalidValue({ range: ['El rango no es válido.'] }))).key).toBe(
      'sheets.errors.invalidRange'
    )
    expect(sheetApiErrorKey(apiError(400, invalidValue({ tabs: ['Pestaña no válida.'] }))).key).toBe(
      'sheets.errors.invalidTabs'
    )
    expect(sheetApiErrorKey(apiError(400, invalidValue({ name: ['Demasiado largo.'] }))).key).toBe(
      'sheets.errors.invalidName'
    )
    expect(
      sheetApiErrorKey(apiError(400, invalidValue({ spreadsheet_id: ['ID no válido.'] }))).key
    ).toBe('sheets.errors.invalidSheet')
    // Varias claves: manda el orden range > tabs > name > spreadsheet_id.
    expect(
      sheetApiErrorKey(apiError(400, invalidValue({ spreadsheet_id: ['x'], tabs: ['y'] }))).key
    ).toBe('sheets.errors.invalidTabs')
    expect(
      sheetApiErrorKey(apiError(400, invalidValue({ non_field_errors: ['Nada que cambiar.'] }))).key
    ).toBe('sheets.errors.invalidSheet')
    expect(sheetApiErrorKey(apiError(409, icalApiError('already_subscribed', 409))).key).toBe(
      'sheets.form.alreadyLinked'
    )
    expect(sheetApiErrorKey(apiError(400, icalApiError('too_many_subscriptions')))).toEqual({
      key: 'sheets.errors.too_many_subscriptions',
      named: { max: 3 },
    })
    expect(
      sheetApiErrorKey(apiError(429, icalApiError('sync_too_soon', 429, { retry_after_seconds: 130 })))
    ).toEqual({ key: 'sheets.errors.sync_too_soon', named: { minutes: 3 } })
    expect(
      sheetApiErrorKey(apiError(400, icalApiError('spreadsheet_mismatch')), 'manage', 'Gira 2027')
    ).toEqual({ key: 'sheets.errors.spreadsheet_mismatch', named: { name: 'Gira 2027' } })
  })

  it('403 plano google_scope_missing y estados HTTP', () => {
    const scope = apiError(403, { code: 'google_scope_missing', detail: 'x', purpose: 'sheets' })
    expect(sheetApiErrorKey(scope).key).toBe('sheets.errors.accessLost')
    expect(sheetApiErrorKey(apiError(403, { detail: 'no' })).key).toBe('sheets.errors.forbidden')
    expect(sheetApiErrorKey(apiError(404, { detail: 'no' })).key).toBe('sheets.errors.notFound')
    expect(sheetApiErrorKey(apiError(404, { detail: 'no' }), 'create').key).toBe(
      'sheets.errors.tourNotFound'
    )
    expect(sheetApiErrorKey(apiError(0, null)).key).toBe('importer.errors.network')
    expect(sheetApiErrorKey(new Error('x')).key).toBe('sheets.errors.generic')
  })
})

describe('sheetCellUrl y sheetCountsText', () => {
  it('enlace a pestaña y fila solo con open_url', () => {
    const url = 'https://docs.google.com/spreadsheets/d/ABC/edit'
    expect(sheetCellUrl(url, 123, 14)).toBe(`${url}#gid=123&range=A14`)
    expect(sheetCellUrl(`${url}#gid=0`, 0)).toBe(`${url}#gid=0`)
    expect(sheetCellUrl(null, 0, 3)).toBeNull()
    expect(sheetCellUrl(url, undefined, 3)).toBeNull()
  })

  it('recuentos con plural y solo los mayores que 0', () => {
    const t = (key: string, named: Record<string, number>, n: number) =>
      i18n.global.t(key, named, n)
    i18n.global.locale.value = 'es'
    expect(sheetCountsText(t, { new: 3, changed: 0, removed: 1 })).toBe('3 nuevas · 1 ya no está')
    expect(sheetCountsText(t, { new: 0, changed: 0, removed: 0 })).toBe('')
  })
})
