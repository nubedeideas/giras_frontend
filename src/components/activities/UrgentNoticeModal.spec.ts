import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch, stubMatchMedia, wrappedError } from '@/test/reminders'
import { noticeDetail, preview } from '@/test/notices'
import UrgentNoticeModal from './UrgentNoticeModal.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

const urgentPreview = (over = {}) =>
  preview({
    template_slug: 'whatsapp_urgent_reminder',
    editable_keys: [
      { key: 'activity_title', max_length: 80, value: 'Reunión urgente' },
      { key: 'activity_location', max_length: 120, value: 'Camerino' },
    ],
    variables: { recipient_name: 'Ana', activity_title: 'Reunión urgente' },
    allowed_templates: [
      { slug: 'whatsapp_urgent_reminder', name: 'Urgente', approved: true },
      { slug: 'whatsapp_meeting_reminder', name: 'Reunión', approved: true },
    ],
    ...over,
  })

function bodies(fn: ReturnType<typeof stubFetch>) {
  return fn.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
}

async function mountModal() {
  const w = mount(UrgentNoticeModal, {
    props: {
      show: true,
      activityUuid: 'A1',
      tourUuid: 'T1',
      activityTitle: 'Reunión urgente',
      activityTypeName: 'Reunión de equipo',
    },
    global: { plugins: [i18n] },
  })
  await flushPromises()
  return w
}

describe('UrgentNoticeModal', () => {
  it('abre con una vista previa en dry run y solo la actividad', async () => {
    const fn = stubFetch(() => jsonResponse(urgentPreview()))
    const w = await mountModal()
    expect(bodies(fn)).toEqual([{ activity: 'A1', dry_run: true }])
    expect(w.get('[data-test="notice-template-whatsapp_urgent_reminder"]').text()).toBe('Urgente')
    expect(w.get('[data-test="notice-template-whatsapp_meeting_reminder"]').text()).toBe(
      'Recordatorio de Reunión de equipo'
    )
    expect(w.get('[data-test="notice-preview"]').text()).toContain('Reunión urgente')
  })

  it('cambiar canal o destinatarios repite el dry run con solo lo cambiado', async () => {
    const fn = stubFetch(() => jsonResponse(urgentPreview()))
    const w = await mountModal()
    await w.get('[data-test="notice-channel-email"]').trigger('click')
    await flushPromises()
    await w.findAll('[data-test="notice-person-remove"]')[0].trigger('click')
    await flushPromises()
    expect(bodies(fn).slice(1)).toEqual([
      { activity: 'A1', channel: 'email', dry_run: true },
      {
        activity: 'A1',
        channel: 'email',
        selection: { excluded_contacts: ['c-1'] },
        dry_run: true,
      },
    ])
  })

  it('no envía sin confirmar; al confirmar manda dry_run false con los textos editados', async () => {
    const fn = stubFetch((_u, init) => {
      const body = JSON.parse(String(init?.body))
      return body.dry_run
        ? jsonResponse(urgentPreview())
        : jsonResponse(noticeDetail({ origin: 'urgent', status: 'sent', recipients_count: 1 }), 201)
    })
    const w = await mountModal()
    await w.get('[data-test="notice-field-activity_title"]').setValue('Reunión YA')
    await w.get('[data-test="urgent-send"]').trigger('click')
    expect(bodies(fn).every((b) => b.dry_run)).toBe(true)
    expect(w.get('[data-test="urgent-confirm"]').text()).toContain(
      '¿Enviar a 1 persona por WhatsApp?'
    )
    await w.get('[data-test="urgent-confirm-yes"]').trigger('click')
    await flushPromises()
    expect(bodies(fn)[bodies(fn).length - 1]).toEqual({
      activity: 'A1',
      text_overrides: { activity_title: 'Reunión YA' },
      dry_run: false,
    })
    expect(w.get('[data-test="urgent-sent"]').text()).toContain('Aviso enviado a 1 persona.')
    expect(w.emitted('sent')).toBeTruthy()
  })

  it('error de la vista previa con código: texto legible y reintentar', async () => {
    stubFetch(() => wrappedError(400, 'activity_past', 'activity', 'activity_past'))
    const w = await mountModal()
    expect(w.get('[data-test="urgent-error"]').text()).toContain('La actividad ya ha pasado.')
    expect(w.find('[data-test="urgent-send"]').exists()).toBe(false)
  })

  it('400 no_recipients al enviar: mensaje y nueva vista previa', async () => {
    const fn = stubFetch((_u, init) => {
      const body = JSON.parse(String(init?.body))
      return body.dry_run
        ? jsonResponse(urgentPreview())
        : wrappedError(400, 'no_recipients', 'selection', 'x')
    })
    const w = await mountModal()
    await w.get('[data-test="urgent-send"]').trigger('click')
    await w.get('[data-test="urgent-confirm-yes"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="urgent-action-error"]').text()).toContain(
      'No hay nadie a quien enviar este aviso por este canal'
    )
    expect(bodies(fn).filter((b) => b.dry_run)).toHaveLength(2)
  })

  it('cerrar con cambios pide confirmación; sin cambios cierra directamente', async () => {
    stubFetch(() => jsonResponse(urgentPreview()))
    const w = await mountModal()
    const shell = () => w.findComponent({ name: 'NoticeSheetShell' })
    shell().vm.$emit('close')
    expect(w.emitted('close')).toHaveLength(1)
    await w.get('[data-test="notice-field-activity_title"]').setValue('Otra')
    shell().vm.$emit('close')
    await flushPromises()
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.get('[data-test="urgent-confirm-close"]').text()).toContain('¿Cerrar sin enviar?')
    await w.get('[data-test="urgent-close-anyway"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
  })
})
