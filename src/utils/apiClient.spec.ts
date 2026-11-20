import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError, apiClient, apiErrorMessage } from './apiClient'
import { callAt, jsonResponse, mockFetch } from '@/test/http'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'old-access')
  localStorage.setItem('gs_refresh_token', 'old-refresh')
  setActivePinia(createPinia())
})

describe('apiClient', () => {
  it('en un 401 refresca el token y reintenta una vez con el nuevo', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ detail: 'Token expirado' }, 401),
      jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' }),
      jsonResponse({ uuid: 't1', name: 'Gira' })
    )

    const data = await apiClient.get<{ uuid: string }>('/tours/t1/')

    expect(data).toEqual({ uuid: 't1', name: 'Gira' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(callAt(fetchMock, 0).url).toBe('http://api.test/api/tours/t1/')
    expect(callAt(fetchMock, 0).headers.Authorization).toBe('Bearer old-access')
    expect(callAt(fetchMock, 1).url).toBe('http://api.test/api/auth/refresh/')
    expect(callAt(fetchMock, 2).headers.Authorization).toBe('Bearer new-access')
    expect(localStorage.getItem('gs_refresh_token')).toBe('new-refresh')
  })

  it('convierte el error envuelto del backend en un ApiError con el mensaje del campo', async () => {
    mockFetch(
      jsonResponse(
        {
          success: false,
          error: {
            message: 'Error en la solicitud',
            status_code: 400,
            details: { end_date: ['La fecha de fin debe ser posterior a la de inicio.'] },
          },
        },
        400
      )
    )

    const err = await apiClient
      .post('/tours/', { name: 'X' }, { fallback: 'Error al crear gira' })
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(400)
    expect((err as ApiError).message).toBe('La fecha de fin debe ser posterior a la de inicio.')
    expect((err as ApiError).fieldErrors).toEqual({
      end_date: ['La fecha de fin debe ser posterior a la de inicio.'],
    })
  })

  it('getAll corta si next se repite', async () => {
    const page = { count: 2, next: 'http://api.test/api/x/?page=2', previous: null, results: [1] }
    const fetchMock = mockFetch(jsonResponse(page), jsonResponse(page), jsonResponse(page))
    expect(await apiClient.getAll<number>('/x/?page=2')).toEqual([1])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('solo convierte en error de red los TypeError de fetch', async () => {
    const fetchMock = mockFetch()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const net = await apiClient.get('/x/').catch((e: unknown) => e)
    expect((net as ApiError).status).toBe(0)

    fetchMock.mockRejectedValueOnce(new RangeError('bug'))
    await expect(apiClient.get('/x/')).rejects.toBeInstanceOf(RangeError)
  })

  it('envía FormData sin Content-Type JSON y sin serializar', async () => {
    const fetchMock = mockFetch(jsonResponse({ uuid: 'd1' }, 201))
    const form = new FormData()
    form.append('description', 'Rider')

    await apiClient.post('/tours/t1/documents/', form)

    const { init, headers } = callAt(fetchMock, 0)
    expect(init.body).toBe(form)
    expect(headers['Content-Type']).toBeUndefined()
  })
})

describe('apiErrorMessage', () => {
  it('en el formato plano prefiere error a detail', () => {
    const data = { error: 'La notificación ya se ha enviado.', detail: 'Invalid state transition' }
    expect(apiErrorMessage(400, data, { fallback: 'Error al programar' })).toBe(
      'La notificación ya se ha enviado.'
    )
  })

  it('usa detail del formato plano de DRF', () => {
    expect(apiErrorMessage(400, { detail: 'La gira ya está archivada.' })).toBe(
      'La gira ya está archivada.'
    )
  })

  it('une todos los errores de campo si se pide', () => {
    const data = { phone: ['Formato inválido.'], non_field_errors: ['Contacto duplicado.'] }
    expect(apiErrorMessage(400, data, { allFieldErrors: true })).toBe(
      'phone: Formato inválido.\nContacto duplicado.'
    )
  })

  it('sustituye los mensajes genéricos de DRF por los propios en tuteo', () => {
    const forbidden = {
      success: false,
      error: { message: 'Usted no tiene permiso para realizar esta acción.', status_code: 403 },
    }
    expect(apiErrorMessage(403, forbidden)).toBe('No tienes permiso para realizar esta acción.')
    expect(apiErrorMessage(403, forbidden, { fallback: 'Error al cargar gira' })).toBe(
      'No tienes permiso para realizar esta acción.'
    )
    expect(apiErrorMessage(404, { detail: 'No encontrado.' }, { fallback: 'Error al cargar' })).toBe(
      'No se ha encontrado el recurso.'
    )
    expect(apiErrorMessage(429, { detail: 'Solicitud fue regulada (throttled).' })).toBe(
      'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.'
    )
    expect(apiErrorMessage(500, '<html>', { fallback: 'Error al cargar giras' })).toBe(
      'Error al cargar giras'
    )
  })
})
