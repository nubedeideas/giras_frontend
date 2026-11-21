import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useAuthProfile } from './useAuthProfile'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('updateMe', () => {
  it('PATCH de phone_number y actualiza el usuario', async () => {
    const fn = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ uuid: 'u1', phone_number: '+34600000000' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    )
    vi.stubGlobal('fetch', fn)
    const auth = useAuthStore()
    auth.accessToken = 'a'
    await useAuthProfile().updateMe({ phone_number: '+34600000000' })
    const [url, init] = fn.mock.calls[0]
    expect(String(url)).toMatch(/\/auth\/update_me\/$/)
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ phone_number: '+34600000000' })
    expect(auth.user?.phone_number).toBe('+34600000000')
    vi.unstubAllGlobals()
  })

  it('400 de teléfono lanza ApiError con el error de campo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                message: 'x',
                status_code: 400,
                details: { phone_number: ['Teléfono no válido.'] },
              },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
      )
    )
    const auth = useAuthStore()
    auth.accessToken = 'a'
    await expect(useAuthProfile().updateMe({ phone_number: 'abc' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { phone_number: ['Teléfono no válido.'] },
    })
    vi.unstubAllGlobals()
  })
})
