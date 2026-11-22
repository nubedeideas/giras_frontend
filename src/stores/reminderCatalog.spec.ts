import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { jsonResponse, mockFetch } from '@/test/http'
import { catalog, typeSetting } from '@/test/reminders'
import { useReminderCatalogStore } from './reminderCatalog'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reminderCatalog store', () => {
  it('notifiableCodes incluye tipos con pasos efectivos y los sustituidos por regla legada', async () => {
    mockFetch(
      jsonResponse(
        catalog({
          types: [
            typeSetting({ activity_type_code: 'flight' }),
            typeSetting({ activity_type_code: 'show', effective_steps: [], tour_steps: [] }),
            typeSetting({
              activity_type_code: 'hotel',
              effective_steps: [],
              replaced_by_legacy_rule: true,
            }),
          ],
        })
      )
    )
    const store = useReminderCatalogStore()
    await store.load('T1')

    expect([...store.notifiableCodes].sort()).toEqual(['flight', 'hotel'])
    expect(store.error).toBeNull()
    expect(store.forbidden).toBe(false)
  })

  it('un 403 deja forbidden sin error y sin códigos', async () => {
    mockFetch(jsonResponse({ detail: 'No tienes permiso.' }, 403))
    const store = useReminderCatalogStore()
    await store.load('T1')

    expect(store.forbidden).toBe(true)
    expect(store.error).toBeNull()
    expect(store.notifiableCodes.size).toBe(0)
  })

  it('otro error queda en error', async () => {
    mockFetch(jsonResponse({ detail: 'boom' }, 500))
    const store = useReminderCatalogStore()
    await store.load('T1')

    expect(store.forbidden).toBe(false)
    expect(store.error).not.toBeNull()
  })

  it('descarta la respuesta obsoleta al cambiar de gira', async () => {
    let resolveFirst!: (r: Response) => void
    const first = new Promise<Response>((r) => (resolveFirst = r))
    const fn = vi.fn<typeof fetch>()
    fn.mockReturnValueOnce(first)
    fn.mockResolvedValueOnce(
      jsonResponse(catalog({ types: [typeSetting({ activity_type_code: 'show' })] }))
    )
    vi.stubGlobal('fetch', fn)

    const store = useReminderCatalogStore()
    const p1 = store.load('T1')
    const p2 = store.load('T2')
    await p2
    resolveFirst(jsonResponse(catalog({ types: [typeSetting({ activity_type_code: 'flight' })] })))
    await p1

    expect(store.tourUuid).toBe('T2')
    expect([...store.notifiableCodes]).toEqual(['show'])
  })

  it('no repite la llamada para la misma gira salvo force', async () => {
    const fn = mockFetch(jsonResponse(catalog()), jsonResponse(catalog()))
    const store = useReminderCatalogStore()
    await store.load('T1')
    await store.load('T1')
    expect(fn).toHaveBeenCalledTimes(1)
    await store.load('T1', { force: true })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('reminderCatalog store: invalidate', () => {
  it('con la gira cargada recarga forzando; sin uuid vacía', async () => {
    const fn = mockFetch(jsonResponse(catalog()), jsonResponse(catalog()))
    const store = useReminderCatalogStore()
    await store.load('T1')
    await store.invalidate('T1')
    expect(fn).toHaveBeenCalledTimes(2)

    await store.invalidate()
    expect(store.catalog).toBeNull()
    expect(store.tourUuid).toBeNull()
  })
})
