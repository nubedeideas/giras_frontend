import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes, setupRouterGuards } from './index'

const fetchMe = vi.hoisted(() => vi.fn())
const useAuthStore = vi.hoisted(() =>
  vi.fn(() => ({
    accessToken: 'access',
    user: null,
    isDemoMode: false,
    isLoggedIn: false,
    fetchMe,
  }))
)
vi.mock('@/stores/auth', () => ({ useAuthStore }))

const TOKEN = `${'a'.repeat(32)}-1.${'b'.repeat(43)}`

function makeRouter() {
  // Componentes vacíos: aquí solo importan los guards.
  const stubbed = routes.map((r) => ({
    ...r,
    component: { template: '<div />' },
    children: r.children?.map((c) => ({ ...c, component: { template: '<div />' } })),
  }))
  const router = createRouter({ history: createMemoryHistory(), routes: stubbed as typeof routes })
  setupRouterGuards(router)
  return router
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMe.mockReset()
  useAuthStore.mockClear()
  window.dataLayer = []
})

describe('router guards', () => {
  it('la ruta del crew no toca la sesión ni empuja page_view', async () => {
    const router = makeRouter()
    await router.push(`/crew/${TOKEN}`)
    expect(router.currentRoute.value.name).toBe('crew-portal')
    expect(useAuthStore).not.toHaveBeenCalled()
    expect(fetchMe).not.toHaveBeenCalled()
    expect(JSON.stringify(window.dataLayer)).not.toContain(TOKEN)
    expect(window.dataLayer.some((e) => (e as { event?: string }).event === 'page_view')).toBe(
      false
    )
  })

  it.each(['/crew/', '/crew', '/crew/abc/extra'])(
    '%s va a la vista del crew sin tocar la sesión',
    async (path) => {
      const router = makeRouter()
      await router.push(path)
      expect(router.currentRoute.value.meta.crew).toBe(true)
      expect(fetchMe).not.toHaveBeenCalled()
      expect(window.dataLayer).toEqual([])
    }
  )

  it('las demás rutas siguen validando la sesión y empujando page_view', async () => {
    const router = makeRouter()
    await router.push('/soporte')
    expect(fetchMe).toHaveBeenCalled()
    expect(window.dataLayer.some((e) => (e as { event?: string }).event === 'page_view')).toBe(
      true
    )
  })

  it('el page_view del callback de OAuth no incluye code ni state', async () => {
    const router = makeRouter()
    await router.push('/auth/callback?code=SECRET_CODE&state=SECRET_STATE&scope=openid')
    const views = window.dataLayer.filter((e) => (e as { event?: string }).event === 'page_view')
    expect(views).toHaveLength(1)
    expect((views[0] as { page_path: string }).page_path).toBe('/auth/callback')
    expect(JSON.stringify(window.dataLayer)).not.toMatch(/SECRET_CODE|SECRET_STATE/)
  })

  it('las demás rutas conservan la query en page_path', async () => {
    const router = makeRouter()
    await router.push('/soporte?utm_source=x')
    const views = window.dataLayer.filter((e) => (e as { event?: string }).event === 'page_view')
    expect((views[0] as { page_path: string }).page_path).toBe('/soporte?utm_source=x')
  })

  it('los enlaces antiguos tours/... redirigen (a /login sin sesión)', async () => {
    const router = makeRouter()
    await router.push('/tours/abc/activities/def')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('/home carga DashboardView', async () => {
    const home = routes.flatMap((r) => r.children ?? []).find((c) => c.name === 'home')
    expect(home?.path).toBe('home')
    const loaded = await (home!.component as () => Promise<{ default: unknown }>)()
    const view = await import('@/views/DashboardView.vue')
    expect(loaded.default).toBe(view.default)
  })

  it('con sesión, /login redirige a /home', async () => {
    const original = useAuthStore.getMockImplementation()!
    useAuthStore.mockImplementation(() => ({
      accessToken: 'access',
      user: { email: 'me@x.es' } as never,
      isDemoMode: false,
      isLoggedIn: true,
      fetchMe,
    }))
    try {
      const router = makeRouter()
      await router.push('/login')
      expect(router.currentRoute.value.path).toBe('/home')
    } finally {
      useAuthStore.mockImplementation(original)
    }
  })
})
