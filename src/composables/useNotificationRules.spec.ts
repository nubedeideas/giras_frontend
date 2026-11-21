import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { RuleApiError, useNotificationRules } from './useNotificationRules'
import { ApiError } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'
import { preset, rule, ruleOptions, rulePreview, wrappedError } from '@/test/rules'

const BASE = 'http://api.test/api/notifications/rules/'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

function body(fn: ReturnType<typeof mockFetch>, n = 0) {
  const raw = callAt(fn, n).init.body
  return raw === undefined ? undefined : JSON.parse(String(raw))
}

describe('useNotificationRules: URL y método', () => {
  it('listRules sigue la paginación con getAll y filtra por gira', async () => {
    const fn = mockFetch(
      jsonResponse({ count: 2, next: `${BASE}?page=2&tour=T1`, previous: null, results: [rule()] }),
      jsonResponse({ count: 2, next: null, previous: null, results: [rule({ uuid: 'rule-2' })] })
    )
    const list = await useNotificationRules().listRules('T1', { is_active: true })
    expect(list.map((r) => r.uuid)).toEqual(['rule-1', 'rule-2'])
    const first = new URL(callAt(fn, 0).url)
    expect(first.origin + first.pathname).toBe(BASE)
    expect(Object.fromEntries(first.searchParams)).toEqual({
      tour: 'T1',
      page_size: '100',
      is_active: 'true',
    })
    expect(callAt(fn, 1).url).toBe(`${BASE}?page=2&tour=T1`)
    expect(callAt(fn, 0).headers.Authorization).toBe('Bearer access')
  })

  it('CRUD, toggle y duplicate', async () => {
    const fn = mockFetch(
      jsonResponse(rule()),
      jsonResponse(rule(), 201),
      jsonResponse(rule()),
      jsonResponse(undefined, 204),
      jsonResponse(rule({ is_active: false })),
      jsonResponse(rule()),
      jsonResponse(rule({ uuid: 'copy' }), 201)
    )
    const api = useNotificationRules()
    await api.getRule('rule-1')
    await api.createRule({
      name: 'R',
      tour: 'T1',
      trigger: 'activity_created',
      recipients_type: 'tour_admins',
      channel: 'in_app',
      template: 'tpl',
    })
    await api.updateRule('rule-1', { name: 'Nuevo' })
    await api.deleteRule('rule-1')
    await api.toggleRule('rule-1', false)
    await api.toggleRule('rule-1')
    await api.duplicateRule('rule-1')

    const calls = fn.mock.calls.map((_, i) => [callAt(fn, i).init.method, callAt(fn, i).url])
    expect(calls).toEqual([
      ['GET', `${BASE}rule-1/`],
      ['POST', BASE],
      ['PATCH', `${BASE}rule-1/`],
      ['DELETE', `${BASE}rule-1/`],
      ['POST', `${BASE}rule-1/toggle/`],
      ['POST', `${BASE}rule-1/toggle/`],
      ['POST', `${BASE}rule-1/duplicate/`],
    ])
    expect(body(fn, 1).tour).toBe('T1')
    expect(body(fn, 2)).toEqual({ name: 'Nuevo' })
    expect(body(fn, 4)).toEqual({ is_active: false })
    expect(body(fn, 5)).toEqual({})
    expect(body(fn, 6)).toEqual({})
  })

  it('catálogo, vista previa y sugeridas', async () => {
    const fn = mockFetch(
      jsonResponse(ruleOptions()),
      jsonResponse(rulePreview()),
      jsonResponse(rulePreview()),
      jsonResponse(rulePreview()),
      jsonResponse([preset()]),
      jsonResponse(rule(), 201)
    )
    const api = useNotificationRules()
    await api.getOptions('T1')
    await api.previewDraft({
      name: 'R',
      tour: 'T1',
      trigger: 'activity_upcoming',
      recipients_type: 'tour_members',
      channel: 'email',
      template: 'tpl',
      offset_minutes: 60,
      activity: 'A1',
    })
    await api.previewRule('rule-1', 'A1')
    await api.previewRule('rule-1')
    const presets = await api.listPresets('T1')
    await api.applyPreset('T1', 'unconfirmed_3h')

    const calls = fn.mock.calls.map((_, i) => [callAt(fn, i).init.method, callAt(fn, i).url])
    expect(calls).toEqual([
      ['GET', `${BASE}options/?tour=T1`],
      ['POST', `${BASE}preview/`],
      ['POST', `${BASE}rule-1/preview/`],
      ['POST', `${BASE}rule-1/preview/`],
      ['GET', `${BASE}presets/?tour=T1`],
      ['POST', `${BASE}presets/apply/`],
    ])
    expect(body(fn, 1).activity).toBe('A1')
    expect(body(fn, 2)).toEqual({ activity: 'A1' })
    expect(body(fn, 3)).toEqual({})
    expect(presets).toHaveLength(1)
    expect(body(fn, 5)).toEqual({ tour: 'T1', key: 'unconfirmed_3h' })
  })
})

describe('RuleApiError', () => {
  it('toma el code de details.code y deja los fieldErrors sin code', async () => {
    mockFetch(
      jsonResponse(
        wrappedError(400, {
          offset_minutes: ['La antelación debe estar entre 15 minutos y 14 días.'],
          code: ['offset_out_of_range'],
        }),
        400
      )
    )
    const err = await useNotificationRules()
      .createRule({
        name: 'R',
        tour: 'T1',
        trigger: 'activity_upcoming',
        recipients_type: 'tour_members',
        channel: 'email',
        template: 'tpl',
        offset_minutes: 1,
      })
      .catch((e) => e)
    expect(err).toBeInstanceOf(RuleApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
    expect(err.code).toBe('offset_out_of_range')
    expect(Object.keys(err.fieldErrors)).toEqual(['offset_minutes'])
    expect(err.message).toBe('La antelación debe estar entre 15 minutos y 14 días.')
    expect(err.fieldMessage('offset_minutes')).toBe(
      'La antelación debe estar entre 15 minutos y 14 días.'
    )
  })

  it('el mensaje no es nunca el code aunque llegue primero', async () => {
    mockFetch(
      jsonResponse(wrappedError(400, { code: ['too_many_rules'], tour: ['Máximo 50.'] }), 400)
    )
    const err = await useNotificationRules().duplicateRule('rule-1').catch((e) => e)
    expect(err.code).toBe('too_many_rules')
    expect(err.message).toBe('Máximo 50.')
  })

  it('403 y 404 siguen como ApiError', async () => {
    mockFetch(
      jsonResponse(
        { success: false, error: { message: 'No encontrado.', status_code: 404 } },
        404
      )
    )
    const err = await useNotificationRules().getOptions('T1').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).not.toBeInstanceOf(RuleApiError)
    expect(err.status).toBe(404)
  })
})
