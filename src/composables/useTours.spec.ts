import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTours } from './useTours'
import { ApiError } from '@/utils/apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

describe('useTours', () => {
  it('listTours recorre todas las páginas siguiendo next', async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        count: 3,
        next: 'http://api.test/api/tours/?page=2&page_size=100',
        previous: null,
        results: [{ uuid: 'a' }, { uuid: 'b' }],
      }),
      jsonResponse({ count: 3, next: null, previous: null, results: [{ uuid: 'c' }] })
    )

    const tours = await useTours().listTours()

    expect(tours.map((t) => t.uuid)).toEqual(['a', 'b', 'c'])
    expect(callAt(fetchMock, 0).url).toBe('http://api.test/api/tours/?page_size=100')
    expect(callAt(fetchMock, 1).url).toBe('http://api.test/api/tours/?page=2&page_size=100')
  })

  it('deleteTour acepta un 204 sin cuerpo', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }))
    await expect(useTours().deleteTour('a')).resolves.toBeUndefined()
    expect(callAt(fetchMock, 0).init.method).toBe('DELETE')
  })

  it('getTour ante un 404 genérico de DRF usa el mensaje del estado, no el fallback', async () => {
    mockFetch(jsonResponse({ success: false, error: { message: 'No encontrado.', status_code: 404 } }, 404))
    const err = await useTours().getTour('x').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe('No se ha encontrado el recurso.')
  })

  it('updateTour manda la config de la alerta y expone el 400 del campo como mensaje', async () => {
    const fetchMock = mockFetch(
      jsonResponse(
        {
          success: false,
          error: {
            message: 'Error de validación',
            status_code: 400,
            details: {
              show_day_alert_time: ['La hora de la alerta debe ir en tramos de 15 minutos.'],
            },
          },
        },
        400
      )
    )
    const err = await useTours()
      .updateTour('a', { show_day_alert_enabled: true, show_day_alert_time: '09:10' })
      .catch((e: unknown) => e)
    const { init } = callAt(fetchMock, 0)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({
      show_day_alert_enabled: true,
      show_day_alert_time: '09:10',
    })
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe(
      'La hora de la alerta debe ir en tramos de 15 minutos.'
    )
  })
})
