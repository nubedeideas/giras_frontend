import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch, stubMatchMedia, wrappedError, type Handler } from '@/test/reminders'
import { noticeDetail, preview } from '@/test/notices'
import { useToursStore } from '@/stores/tours'
import { useNoticesStore } from '@/stores/notices'
import NoticeSheet from './NoticeSheet.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

/** Monta la hoja con los borradores controlados como lo hace `NoticesPanel`. */
async function mountSheet(extra: Record<string, unknown> = {}) {
  const w = mount(NoticeSheet, {
    props: {
      show: true,
      noticeUuid: 'N1',
      tourUuid: 'T1',
      drafts: {},
      'onUpdate:drafts': (_uuid: string, d: Record<string, string>) => {
        void w.setProps({ drafts: d })
      },
      ...extra,
    },
    global: { plugins: [i18n] },
  })
  await flushPromises()
  return w
}

function calls(fn: ReturnType<typeof stubFetch>, method: string, path: string) {
  return fn.mock.calls
    .filter(([u, init]) => (init?.method ?? 'GET') === method && String(u).includes(path))
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined))
}

describe('NoticeSheet', () => {
  it('pinta cambio, coste y destinatarios del borrador', async () => {
    stubFetch(() => jsonResponse(noticeDetail()))
    const w = await mountSheet()
    expect(w.get('[data-test="notice-origin"]').text()).toBe('Retraso de vuelo')
    expect(w.get('[data-test="notice-summary"]').text()).toBe('Sale con 45 min de retraso.')
    expect(w.get('[data-test="notice-cost"]').text()).toBe('≈ 12 WhatsApp · 0,30 USD · te quedan 120')
    expect(w.get('[data-test="notice-reach"]').text()).toBe('Llega a 1 de 2')
    expect(w.findAll('[data-test="notice-person"]')).toHaveLength(2)
    expect(w.get('[data-test="notice-unreachable"]').text()).toContain('1 persona sin teléfono')
  })

  it('enviar: confirma con recuento y canal y luego envía sin campos no tocados', async () => {
    const fn = stubFetch((url, init) => {
      if (url.pathname.endsWith('/send/') && init?.method === 'POST') {
        return jsonResponse(
          noticeDetail({
            status: 'sent',
            recipients_count: 1,
            sent_by_name: 'Oscar',
            sent_at: new Date().toISOString(),
            preview: null,
          })
        )
      }
      return jsonResponse(noticeDetail())
    })
    const w = await mountSheet()
    await w.get('[data-test="notice-send"]').trigger('click')
    expect(w.get('[data-test="notice-confirm-send"]').text()).toContain(
      '¿Enviar a 1 persona por WhatsApp?'
    )
    expect(calls(fn, 'POST', '/send/')).toHaveLength(0)
    await w.get('[data-test="notice-confirm-send-yes"]').trigger('click')
    await flushPromises()
    expect(calls(fn, 'POST', '/send/')).toEqual([{}])
    expect(w.get('[data-test="notice-sent-ok"]').text()).toBe('Aviso enviado a 1 persona.')
    expect(w.find('[data-test="notice-send"]').exists()).toBe(false)
    expect(w.emitted('changed')).toBeTruthy()
  })

  it('el texto editado viaja con el envío solo si ha cambiado', async () => {
    const fn = stubFetch((url) =>
      url.pathname.endsWith('/send/')
        ? jsonResponse(noticeDetail({ status: 'sent', preview: null }))
        : jsonResponse(noticeDetail())
    )
    const w = await mountSheet()
    await w.get('[data-test="notice-field-flight_status"]').setValue('Retrasado 50 min')
    await w.get('[data-test="notice-send"]').trigger('click')
    await w.get('[data-test="notice-confirm-send-yes"]').trigger('click')
    await flushPromises()
    expect(calls(fn, 'POST', '/send/')).toEqual([
      { text_overrides: { flight_status: 'Retrasado 50 min' } },
    ])
  })

  it('quitar a una persona hace PATCH solo de excluded_contacts', async () => {
    const fn = stubFetch((_url, init) =>
      init?.method === 'PATCH'
        ? jsonResponse(
            noticeDetail({
              selection: {
                use_activity_audience: true,
                groups: [],
                contacts: [],
                excluded_contacts: ['c-1'],
              },
              preview: preview({ people: [preview().people[1]] }),
            })
          )
        : jsonResponse(noticeDetail())
    )
    const w = await mountSheet()
    await w.findAll('[data-test="notice-person-remove"]')[0].trigger('click')
    await flushPromises()
    expect(calls(fn, 'PATCH', '/notices/N1/')).toEqual([{ selection: { excluded_contacts: ['c-1'] } }])
    expect(w.get('[data-test="notice-excluded-chip"]').text()).toContain('Ana Pérez')
  })

  it('409 al enviar recarga el aviso y enseña su estado real', async () => {
    let gets = 0
    const handler: Handler = (url, init) => {
      if (url.pathname.endsWith('/send/')) {
        return wrappedError(409, 'notice_not_pending', 'status', 'No pendiente')
      }
      if ((init?.method ?? 'GET') === 'GET') {
        gets++
        return jsonResponse(
          gets === 1
            ? noticeDetail()
            : noticeDetail({ status: 'sent', sent_by_name: 'Ana', sent_at: new Date().toISOString(), preview: null })
        )
      }
      return jsonResponse({}, 404)
    }
    stubFetch(handler)
    const w = await mountSheet()
    await w.get('[data-test="notice-send"]').trigger('click')
    await w.get('[data-test="notice-confirm-send-yes"]').trigger('click')
    await flushPromises()
    expect(gets).toBe(2)
    expect(w.get('[data-test="notice-action-error"]').text()).toBe(
      'Este aviso ya no está pendiente: puede que otro administrador lo haya enviado o descartado.'
    )
    expect(w.get('[data-test="notice-status-line"]').text()).toContain('Enviado por Ana')
    expect(w.find('[data-test="notice-send"]').exists()).toBe(false)
  })

  it('409 conserva el borrador de texto si el aviso sigue pendiente', async () => {
    stubFetch((url) =>
      url.pathname.endsWith('/send/')
        ? wrappedError(409, 'tour_notifications_blocked', 'tour', 'Bloqueado')
        : jsonResponse(noticeDetail())
    )
    const w = await mountSheet()
    await w.get('[data-test="notice-field-flight_status"]').setValue('Mi texto')
    await w.get('[data-test="notice-send"]').trigger('click')
    await w.get('[data-test="notice-confirm-send-yes"]').trigger('click')
    await flushPromises()
    expect(
      (w.get('[data-test="notice-field-flight_status"]').element as HTMLInputElement).value
    ).toBe('Mi texto')
  })

  it('caducado: solo lectura con el motivo', async () => {
    stubFetch(() =>
      jsonResponse(noticeDetail({ status: 'expired', close_reason: 'departed', preview: null }))
    )
    const w = await mountSheet()
    expect(w.find('[data-test="notice-readonly"]').exists()).toBe(true)
    expect(w.get('[data-test="notice-status-line"]').text()).toBe(
      'Caducado · El vuelo ya ha despegado'
    )
    expect(w.find('[data-test="notice-send"]').exists()).toBe(false)
    expect(w.find('[data-test="notice-discard"]').exists()).toBe(false)
  })

  it('descartar pide confirmación', async () => {
    const fn = stubFetch((url) =>
      url.pathname.endsWith('/discard/')
        ? jsonResponse(noticeDetail({ status: 'discarded', closed_by_name: 'Oscar', preview: null }))
        : jsonResponse(noticeDetail())
    )
    const w = await mountSheet()
    await w.get('[data-test="notice-discard"]').trigger('click')
    expect(calls(fn, 'POST', '/discard/')).toHaveLength(0)
    expect(w.get('[data-test="notice-confirm-discard"]').text()).toContain(
      '¿Descartar este aviso? No se enviará a nadie.'
    )
    await w.get('[data-test="notice-confirm-discard-yes"]').trigger('click')
    await flushPromises()
    expect(calls(fn, 'POST', '/discard/')).toEqual([{}])
    expect(w.get('[data-test="notice-status-line"]').text()).toBe('Descartado por Oscar')
  })

  it('sin nadie alcanzable no se puede enviar', async () => {
    stubFetch(() =>
      jsonResponse(
        noticeDetail({
          preview: preview({ counts: { total: 1, reachable: 0, no_phone: 1, no_email: 0, no_account: 1 } }),
        })
      )
    )
    const w = await mountSheet()
    expect(w.get('[data-test="notice-send"]').attributes('disabled')).toBeDefined()
  })

  it('404 en una acción no dice "no eres admin"', async () => {
    stubFetch((_u, init) =>
      init?.method === 'PATCH' ? jsonResponse({}, 404) : jsonResponse(noticeDetail())
    )
    const w = await mountSheet()
    await w.get('[data-test="notice-channel-email"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="notice-action-error"]').text()).toBe('Este aviso ya no existe.')
  })

  it('con plan ilimitado o sin suscripción no dice "te quedan"', async () => {
    for (const remaining of [null, -1]) {
      stubFetch(() =>
        jsonResponse(
          noticeDetail({
            preview: preview({
              cost: { whatsapp: 12, cost_usd: 0.3, remaining, over_quota: false },
            }),
          })
        )
      )
      const w = await mountSheet()
      expect(w.get('[data-test="notice-cost"]').text()).toBe('≈ 12 WhatsApp · 0,30 USD')
      w.unmount()
    }
  })

  it('usa el detalle en caché sin pedirlo otra vez', async () => {
    const fn = stubFetch(() => jsonResponse(noticeDetail()))
    useNoticesStore().setDetail(noticeDetail())
    const w = await mountSheet()
    expect(fn).not.toHaveBeenCalled()
    expect(w.get('[data-test="notice-summary"]').text()).toBe('Sale con 45 min de retraso.')
  })

  it('los borradores llegan por prop y se conservan al cerrar y reabrir', async () => {
    stubFetch(() => jsonResponse(noticeDetail()))
    const w = await mountSheet({ drafts: { flight_status: 'Mi borrador' } })
    const input = () => w.get('[data-test="notice-field-flight_status"]').element as HTMLInputElement
    expect(input().value).toBe('Mi borrador')
    await w.setProps({ show: false, noticeUuid: null })
    await w.setProps({ show: true, noticeUuid: 'N1' })
    await flushPromises()
    expect(input().value).toBe('Mi borrador')
  })

  it('cerrar con textos sin guardar pide confirmación', async () => {
    stubFetch(() => jsonResponse(noticeDetail()))
    const w = await mountSheet()
    await w.get('[data-test="notice-field-flight_status"]').setValue('Otro texto')
    w.findComponent({ name: 'NoticeSheetShell' }).vm.$emit('close')
    await flushPromises()
    expect(w.emitted('close')).toBeFalsy()
    expect(w.get('[data-test="notice-confirm-close"]').text()).toContain('textos sin guardar')
    await w.get('[data-test="notice-close-anyway"]').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })

  it('sin borradores cierra directamente', async () => {
    stubFetch(() => jsonResponse(noticeDetail()))
    const w = await mountSheet()
    w.findComponent({ name: 'NoticeSheetShell' }).vm.$emit('close')
    expect(w.emitted('close')).toBeTruthy()
  })

  it('título o mensaje vacíos: aviso y no se puede guardar ni enviar', async () => {
    stubFetch(() =>
      jsonResponse(
        noticeDetail({
          channel: 'email',
          preview: preview({
            channel: 'email',
            editable_keys: [
              { key: 'title', max_length: 200, value: 'Título' },
              { key: 'message', max_length: 2000, value: 'Mensaje' },
            ],
            rendered: { title: 'Título', body: 'Mensaje' },
            variables: null,
            counts: { total: 2, reachable: 2, no_phone: 1, no_email: 0, no_account: 1 },
          }),
        })
      )
    )
    const w = await mountSheet()
    await w.get('[data-test="notice-field-title"]').setValue('   ')
    expect(w.get('[data-test="notice-field-blank-title"]').text()).toContain('No puede quedar vacío')
    expect(w.get('[data-test="notice-save-texts"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="notice-send"]').attributes('disabled')).toBeDefined()
  })

  it('403 en una acción recarga las giras', async () => {
    stubFetch((_u, init) =>
      init?.method === 'PATCH' ? jsonResponse({}, 403) : jsonResponse(noticeDetail())
    )
    const tours = useToursStore()
    const spy = vi.spyOn(tours, 'loadTours').mockResolvedValue()
    const w = await mountSheet()
    await w.get('[data-test="notice-channel-email"]').trigger('click')
    await flushPromises()
    expect(spy).toHaveBeenCalled()
    expect(w.get('[data-test="notice-action-error"]').text()).toBe(
      'Solo los administradores de la gira pueden gestionar sus avisos.'
    )
  })

  it('variables de WhatsApp en orden de plantilla y con etiqueta (hotel, transporte, vuelo)', async () => {
    stubFetch(() =>
      jsonResponse(
        noticeDetail({
          preview: preview({
            variables: {
              activity_driver_info: 'Pepe · 600 000 000',
              recipient_name: 'Ana',
              activity_hotel_name: 'Hotel Sol',
            },
            variable_positions: { recipient_name: 1, activity_hotel_name: 2, activity_driver_info: 3 },
          }),
        })
      )
    )
    const w = await mountSheet()
    const rows = w.findAll('[data-test="notice-preview"] dt').map((d) => d.text())
    expect(rows).toEqual(['Para:', 'Hotel:', 'Conductor:'])
  })

  it('reintentar tras un error vuelve a pedir el detalle', async () => {
    let fail = true
    const fn = stubFetch(() => (fail ? jsonResponse({}, 500) : jsonResponse(noticeDetail())))
    const w = await mountSheet()
    expect(w.find('[data-test="notice-sheet-error"]').exists()).toBe(true)
    fail = false
    await w.get('[data-test="notice-sheet-retry"]').trigger('click')
    await flushPromises()
    expect(fn).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="notice-composer"]').exists()).toBe(true)
  })
})
