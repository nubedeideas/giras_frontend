import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { preset, rule, ruleOptions } from '@/test/rules'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import NotificationRulesManager from './NotificationRulesManager.vue'
import RuleBuilder from './RuleBuilder.vue'

function tour(uuid: string, isAdmin: boolean, id: number): Tour {
  return {
    id,
    uuid,
    name: `Gira ${uuid}`,
    artist_name: 'Artista',
    start_date: '2026-11-01',
    end_date: '2026-12-31',
    status: 'active',
    currency: 'EUR',
    color: 'var(--acid)',
    owner_email: 'owner@giras.pro',
    timezone: 'Europe/Madrid',
    enable_notifications: true,
    notifications_paused_at: null,
    current_user_is_admin: isAdmin,
  }
}

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>

function paginated(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results }
}

/** Respuestas por gira: options, lista y sugeridas. */
function defaultHandler(rulesByTour: Record<string, unknown[]> = {}): Handler {
  return (url) => {
    const tourUuid = url.searchParams.get('tour') ?? ''
    if (url.pathname.endsWith('/rules/options/')) {
      return jsonResponse(ruleOptions({ tour: { uuid: tourUuid, name: tourUuid, default_group: null } }))
    }
    if (url.pathname.endsWith('/rules/presets/')) return jsonResponse([preset()])
    if (url.pathname.endsWith('/notifications/rules/')) {
      return jsonResponse(paginated(rulesByTour[tourUuid] ?? []))
    }
    return jsonResponse({}, 404)
  }
}

function stubFetch(handler: Handler) {
  const fn = vi.fn<typeof fetch>(async (input, init) => handler(new URL(String(input)), init))
  vi.stubGlobal('fetch', fn)
  return fn
}

async function mountAt(
  query: Record<string, string>,
  tours: Tour[]
): Promise<{ w: ReturnType<typeof mount>; router: Router }> {
  useToursStore().tours = tours
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push({ path: '/settings', query: { tab: 'rules', ...query } })
  await router.isReady()
  const w = mount(NotificationRulesManager, {
    global: { plugins: [router, i18n], stubs: { RulePreviewPanel: true, RouterLink: true } },
  })
  await flushPromises()
  return { w, router }
}

const urls = (fn: ReturnType<typeof stubFetch>) => fn.mock.calls.map(([u]) => String(u))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

describe('NotificationRulesManager', () => {
  it('solo ofrece las giras administrables', async () => {
    stubFetch(defaultHandler({ T1: [rule()] }))
    const { w } = await mountAt({}, [tour('T0', false, 1), tour('T1', true, 2), tour('T2', true, 3)])
    const opts = w.findAll('[data-test="rules-tour-select"] option')
    expect(opts.map((o) => o.attributes('value'))).toEqual(['T1', 'T2'])
    expect(w.findAll('[data-test^="rule-rule-"]')).toHaveLength(1)
    expect(w.find('[data-test="presets"]').exists()).toBe(true)
  })

  it('estado vacío sin giras administrables', async () => {
    const fn = stubFetch(defaultHandler())
    const { w } = await mountAt({}, [tour('T0', false, 1)])
    expect(w.find('[data-test="rules-no-admin"]').text()).toBe(
      'Solo los administradores de una gira pueden configurar sus reglas.'
    )
    expect(urls(fn).some((u) => u.includes('/notifications/rules/'))).toBe(false)
  })

  it('estado vacío sin reglas', async () => {
    stubFetch(defaultHandler())
    const { w } = await mountAt({}, [tour('T1', true, 1)])
    expect(w.find('[data-test="rules-empty"]').exists()).toBe(true)
  })

  it('?tour= elige la gira y ?rule= abre la edición (deep link)', async () => {
    const fn = stubFetch(defaultHandler({ T2: [rule({ uuid: 'R2', tour: 'T2' })] }))
    const { w } = await mountAt({ tour: 'T2', rule: 'R2' }, [
      tour('T1', true, 1),
      tour('T2', true, 2),
    ])
    expect(
      (w.find('[data-test="rules-tour-select"]').element as HTMLSelectElement).value
    ).toBe('T2')
    expect(urls(fn).every((u) => new URL(u).searchParams.get('tour') === 'T2')).toBe(true)
    const builder = w.findComponent(RuleBuilder)
    expect(builder.exists()).toBe(true)
    expect(builder.props('rule')).toMatchObject({ uuid: 'R2' })
  })

  it('cambiar de gira escribe ?tour= y recarga', async () => {
    const fn = stubFetch(defaultHandler())
    const { w, router } = await mountAt({}, [tour('T1', true, 1), tour('T2', true, 2)])
    await w.find('[data-test="rules-tour-select"]').setValue('T2')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'rules', tour: 'T2' })
    expect(urls(fn).some((u) => new URL(u).searchParams.get('tour') === 'T2')).toBe(true)
  })

  it('descarta la respuesta de una gira anterior (requestId)', async () => {
    let releaseT1: () => void = () => {}
    const t1Gate = new Promise<void>((r) => (releaseT1 = r))
    const base = defaultHandler({
      T1: [rule({ uuid: 'OLD', name: 'De la gira 1' })],
      T2: [rule({ uuid: 'NEW', name: 'De la gira 2' })],
    })
    stubFetch(async (url, init) => {
      if (url.searchParams.get('tour') === 'T1') await t1Gate
      return base(url, init)
    })
    const { w, router } = await mountAt({}, [tour('T1', true, 1), tour('T2', true, 2)])
    await router.replace({ query: { tab: 'rules', tour: 'T2' } })
    await flushPromises()
    expect(w.find('[data-test="rule-NEW"]').exists()).toBe(true)

    releaseT1()
    await flushPromises()
    expect(w.find('[data-test="rule-OLD"]').exists()).toBe(false)
    expect(w.find('[data-test="rule-NEW"]').exists()).toBe(true)
  })

  it('toggle optimista con reversión si falla', async () => {
    let releaseToggle: (r: Response) => void = () => {}
    const base = defaultHandler({ T1: [rule({ uuid: 'R1', is_active: true })] })
    const fn = stubFetch((url, init) => {
      if (url.pathname.endsWith('/R1/toggle/')) {
        return new Promise<Response>((r) => (releaseToggle = r))
      }
      return base(url, init)
    })
    const { w } = await mountAt({}, [tour('T1', true, 1)])
    const sw = () => w.find('[data-test="rule-R1"] [data-test="rule-toggle"]')
    expect(sw().attributes('aria-checked')).toBe('true')

    await sw().trigger('click')
    await flushPromises()
    // Optimista: ya aparece desactivada antes de que responda el backend.
    expect(sw().attributes('aria-checked')).toBe('false')
    const call = fn.mock.calls.find(([u]) => String(u).endsWith('/R1/toggle/'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ is_active: false })

    releaseToggle(
      jsonResponse({ success: false, error: { message: 'Error del servidor', status_code: 500 } }, 500)
    )
    await flushPromises()
    expect(sw().attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="rules-list-error"]').text()).toContain(
      'No se ha podido cambiar el estado de la regla.'
    )
  })

  it('403 de la gira muestra el estado sin acceso y recarga las giras', async () => {
    const fn = stubFetch((url) => {
      if (url.pathname.endsWith('/tours/')) return jsonResponse(paginated([]))
      return jsonResponse({ success: false, error: { message: 'x', status_code: 403 } }, 403)
    })
    const { w } = await mountAt({}, [tour('T1', true, 1)])
    expect(w.find('[data-test="rules-no-admin"]').exists()).toBe(true)
    expect(urls(fn).some((u) => new URL(u).pathname.endsWith('/tours/'))).toBe(true)
  })

  it('403 con la gira aún en la lista: aviso sin ocultar el selector, y se limpia al cambiar', async () => {
    const base = defaultHandler()
    stubFetch((url, init) => {
      if (url.pathname.endsWith('/tours/')) {
        return jsonResponse(
          paginated([
            { uuid: 'T1', name: 'T1', owner_email: 'x', current_user_is_admin: true },
            { uuid: 'T2', name: 'T2', owner_email: 'x', current_user_is_admin: true },
          ])
        )
      }
      if (url.searchParams.get('tour') === 'T1') {
        return jsonResponse({ success: false, error: { message: 'x', status_code: 403 } }, 403)
      }
      return base(url, init)
    })
    const { w } = await mountAt({}, [tour('T1', true, 1), tour('T2', true, 2)])
    expect(w.find('[data-test="rules-no-access"]').exists()).toBe(true)
    expect(w.find('[data-test="rules-no-admin"]').exists()).toBe(false)
    expect(w.find('[data-test="rules-tour-select"]').exists()).toBe(true)

    await w.find('[data-test="rules-tour-select"]').setValue('T2')
    await flushPromises()
    expect(w.find('[data-test="rules-no-access"]').exists()).toBe(false)
    expect(w.find('[data-test="rules-empty"]').exists()).toBe(true)
  })

  it('sin giras cargadas no enseña el aviso de permisos mientras carga', async () => {
    let release: (r: Response) => void = () => {}
    stubFetch((url) => {
      if (url.pathname.endsWith('/tours/')) return new Promise<Response>((r) => (release = r))
      return jsonResponse({}, 404)
    })
    const { w } = await mountAt({}, [])
    expect(w.find('[data-test="rules-no-admin"]').exists()).toBe(false)
    expect(w.find('[data-test="rules-tours-loading"]').exists()).toBe(true)
    release(jsonResponse(paginated([])))
    await flushPromises()
    expect(w.find('[data-test="rules-no-admin"]').exists()).toBe(true)
  })

  it('error al cargar las giras: rama propia con reintentar', async () => {
    const fn = stubFetch(() =>
      jsonResponse({ success: false, error: { message: 'x', status_code: 500 } }, 500)
    )
    const { w } = await mountAt({}, [])
    const box = w.find('[data-test="rules-tours-error"]')
    expect(box.text()).toContain('No se han podido cargar tus giras.')
    expect(w.find('[data-test="rules-no-admin"]').exists()).toBe(false)
    const before = urls(fn).length
    await box.find('button').trigger('click')
    await flushPromises()
    expect(urls(fn).length).toBe(before + 1)
  })

  it('regla antigua inactiva: el interruptor no la reactiva', async () => {
    stubFetch(
      defaultHandler({
        T1: [
          rule({ uuid: 'L1', trigger: 'event_created', is_editable: false, is_active: false }),
          rule({ uuid: 'L2', trigger: 'event_created', is_editable: false, is_active: true }),
        ],
      })
    )
    const { w } = await mountAt({}, [tour('T1', true, 1)])
    const sw = (id: string) => w.find(`[data-test="rule-${id}"] [data-test="rule-toggle"]`)
    expect(sw('L1').attributes('disabled')).toBeDefined()
    expect(sw('L2').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="rule-L1"] [data-test="rule-edit"]').exists()).toBe(false)
  })

  it('límite de reglas deshabilita "Nueva regla"', async () => {
    stubFetch((url, init) => {
      if (url.pathname.endsWith('/rules/options/')) {
        const o = ruleOptions()
        o.limits.max_rules_per_tour = 1
        return jsonResponse(o)
      }
      return defaultHandler({ T1: [rule()] })(url, init)
    })
    const { w } = await mountAt({}, [tour('T1', true, 1)])
    expect(w.find('[data-test="rules-new"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="rules-limit"]').text()).toBe(
      'Has llegado al máximo de 1 reglas en esta gira.'
    )
  })
})
