import { beforeEach, describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import i18n from '@/i18n'
import { ApiError } from '@/utils/apiClient'
import { NoticeApiError } from '@/composables/useNotices'
import { notice } from '@/test/notices'
import {
  closeReasonLabel,
  expiresInLabel,
  isStaleNotice,
  keepDirtyDrafts,
  noticeErrorMessage,
  noticeHeadline,
  noticeStatusLine,
  noticeSummary,
  NOTICE_ORIGINS,
  originLabel,
  selectionEdit,
  textEdit,
  emptySelection,
} from './notices'

const t = i18n.global.t as unknown as (k: string, n?: Record<string, unknown>) => string
const NOW = DateTime.fromISO('2026-11-21T10:00:00Z')

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

function err(status: number, code?: string, message = 'Mensaje del backend') {
  const details = code ? { field: [message], code: [code] } : undefined
  const base = new ApiError(status, {
    success: false,
    error: { message, status_code: status, details },
  })
  return code && (status === 400 || status === 409) ? new NoticeApiError(base) : base
}

describe('tarjetas', () => {
  it('etiqueta de cada origen, sin claves crudas', () => {
    for (const o of NOTICE_ORIGINS) expect(originLabel(o, t)).not.toContain('notices.')
    expect(originLabel('otro', t)).toBe('Aviso')
  })

  it('titular con vuelo y ruta, o el título de la actividad', () => {
    expect(noticeHeadline(notice())).toBe('IB3456 · MAD → BCN')
    expect(noticeHeadline(notice({ params: {}, origin: 'urgent' }))).toBe('Vuelo MAD-BCN')
  })

  it('resumen por origen', () => {
    expect(noticeSummary(notice(), t)).toBe('Sale con 45 min de retraso.')
    expect(
      noticeSummary(notice({ origin: 'cirium_early', params: { departure_shift_minutes: -35 } }), t)
    ).toBe('La salida se adelanta 35 min.')
    expect(noticeSummary(notice({ origin: 'cirium_cancelled' }), t)).toBe(
      'La aerolínea ha cancelado el vuelo.'
    )
    expect(noticeSummary(notice({ origin: 'cirium_delay', params: {} }), t)).toBe(
      'El vuelo sale con retraso.'
    )
  })

  it('caducidad relativa en futuro y null si ya venció', () => {
    expect(expiresInLabel('2026-11-21T12:00:00Z', t, 'es', NOW)).toBe('Caduca dentro de 2 horas')
    expect(expiresInLabel('2026-11-21T09:00:00Z', t, 'es', NOW)).toBeNull()
    expect(expiresInLabel(null, t, 'es', NOW)).toBeNull()
  })

  it('línea de estado del historial', () => {
    const sent = notice({ status: 'sent', sent_by_name: 'Oscar', sent_at: '2026-11-21T09:55:00Z' })
    expect(noticeStatusLine(sent, t, 'es', NOW)).toBe('Enviado por Oscar hace 5 minutos')
    expect(noticeStatusLine(notice({ status: 'discarded', closed_by_name: 'Ana' }), t, 'es', NOW)).toBe(
      'Descartado por Ana'
    )
    expect(
      noticeStatusLine(notice({ status: 'expired', close_reason: 'departed' }), t, 'es', NOW)
    ).toBe('Caducado · El vuelo ya ha despegado')
    expect(noticeStatusLine(notice({ status: 'expired', close_reason: 'raro' }), t, 'es', NOW)).toBe(
      'Caducado'
    )
    expect(noticeStatusLine(notice({ status: 'superseded' }), t, 'es', NOW)).toBe(
      'Sustituido por un aviso más reciente'
    )
  })

  it('motivo de cierre desconocido no se enseña', () => {
    expect(closeReasonLabel('no_longer_applies', t)).toBe('El retraso ya no es significativo')
    expect(closeReasonLabel('plan_limit_reached', t)).toBe('Sin cupo de WhatsApp al enviar')
    expect(closeReasonLabel('quota_unavailable', t)).toBe(
      'No se pudo comprobar el cupo al enviar'
    )
    expect(closeReasonLabel('xyz', t)).toBeNull()
    expect(closeReasonLabel('', t)).toBeNull()
  })
})

describe('diff de edición', () => {
  const editable = [
    { key: 'flight_status', max_length: 120, value: 'Retrasado' },
    { key: 'title', max_length: 200, value: 'T' },
    { key: 'message', max_length: 2000, value: 'M' },
  ]

  it('textEdit solo manda lo cambiado, title/message como campos propios', () => {
    expect(textEdit(editable, {})).toEqual({})
    expect(textEdit(editable, { flight_status: 'Retrasado' })).toEqual({})
    expect(textEdit(editable, { flight_status: 'Cancelado', message: 'Nuevo', otra: 'x' })).toEqual({
      text_overrides: { flight_status: 'Cancelado' },
      message: 'Nuevo',
    })
  })

  it('keepDirtyDrafts descarta claves no editables y las iguales al servidor', () => {
    expect(keepDirtyDrafts(editable, { flight_status: 'Retrasado', title: 'Otro', zz: 'a' })).toEqual({
      title: 'Otro',
    })
  })

  it('selectionEdit solo devuelve las listas cambiadas', () => {
    const base = emptySelection()
    expect(selectionEdit(base, emptySelection())).toBeNull()
    expect(selectionEdit(base, { ...base, excluded_contacts: ['c-1'] })).toEqual({
      excluded_contacts: ['c-1'],
    })
  })
})

describe('errores', () => {
  it('código conocido → texto de notices.errors; nunca el código crudo', () => {
    expect(noticeErrorMessage(err(409, 'notice_expired'), t, 'notices.errors.action')).toBe(
      'Este aviso ha caducado y ya no se puede enviar.'
    )
    expect(noticeErrorMessage(err(400, 'codigo_nuevo', 'codigo_nuevo'), t, 'notices.errors.send')).toBe(
      'No se ha podido enviar el aviso.'
    )
  })

  it('403 = no admin; 404 en acción = ya no existe; 404 en carga = no admin; 429', () => {
    expect(noticeErrorMessage(err(403), t, 'notices.errors.action')).toBe(
      'Solo los administradores de la gira pueden gestionar sus avisos.'
    )
    expect(noticeErrorMessage(err(404), t, 'notices.errors.action')).toBe('Este aviso ya no existe.')
    expect(noticeErrorMessage(err(404), t, 'notices.errors.load', { load: true })).toBe(
      'Solo los administradores de la gira pueden gestionar sus avisos.'
    )
    expect(noticeErrorMessage(err(429), t, 'notices.errors.action')).toBe(
      'Has hecho demasiadas solicitudes. Inténtalo de nuevo en unos minutos.'
    )
  })

  it('isStaleNotice con cualquier 409', () => {
    expect(isStaleNotice(err(409, 'notice_not_pending'))).toBe(true)
    expect(isStaleNotice(err(400, 'no_recipients'))).toBe(false)
  })

  it('cada código de §5.3 tiene texto en notices.errors (es y en)', () => {
    const codes = [
      'tour_required', 'activity_required', 'steps_invalid', 'step_minutes_out_of_range',
      'step_channel_invalid', 'step_minutes_duplicated', 'too_many_steps', 'activity_type_unknown',
      'group_other_tour', 'group_or_contact_required', 'contact_not_assignable',
      'too_many_overrides', 'channel_not_allowed', 'template_not_allowed', 'template_not_approved',
      'text_key_not_editable', 'text_too_long', 'no_recipients', 'notice_not_pending',
      'notice_expired', 'activity_unavailable', 'activity_past', 'tour_notifications_blocked',
      'no_role_groups', 'ai_unavailable', 'bucket_unknown', 'name_too_long', 'not_suggested',
      'no_pending_review',
    ]
    for (const locale of ['es', 'en']) {
      i18n.global.locale.value = locale as 'es'
      for (const c of codes) expect(i18n.global.te(`notices.errors.${c}`)).toBe(true)
    }
  })
})

describe('ayudas de R2 (revisión)', () => {
  it('activityHasEnded: end_at pasado o scheduled_at + 2 h', async () => {
    const { activityHasEnded } = await import('./notices')
    expect(activityHasEnded({ scheduled_at: '2026-11-21T07:00:00Z', end_at: null }, NOW)).toBe(true)
    expect(activityHasEnded({ scheduled_at: '2026-11-21T08:30:00Z', end_at: null }, NOW)).toBe(false)
    expect(
      activityHasEnded(
        { scheduled_at: '2026-11-21T05:00:00Z', end_at: '2026-11-21T11:00:00Z' },
        NOW
      )
    ).toBe(false)
  })

  it('shownRemaining: null y negativos no se enseñan', async () => {
    const { shownRemaining } = await import('./notices')
    expect(shownRemaining(null)).toBeNull()
    expect(shownRemaining(-1)).toBeNull()
    expect(shownRemaining(0)).toBe(0)
  })

  it('blankRequiredTexts solo mira title y message', async () => {
    const { blankRequiredTexts } = await import('./notices')
    expect(blankRequiredTexts({ title: ' ', flight_status: '' })).toEqual(['title'])
    expect(blankRequiredTexts({ message: 'x' })).toEqual([])
  })
})
