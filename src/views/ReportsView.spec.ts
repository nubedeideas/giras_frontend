import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { jsonResponse } from '@/test/http'
import ReportsView from './ReportsView.vue'

const metrics = {
  recipients: 2,
  pending: 0,
  sent: 2,
  delivered: 0,
  read: 0,
  confirmed: 0,
  failed: 0,
}

const SUMMARY = {
  filters: { tour: 'T1', from: '2026-10-23', to: '2026-11-21', tz: 'UTC', channel: null },
  totals: { ...metrics, confirmable_sent: 0 },
  rates: { delivery_rate: null, read_rate: null, confirmation_rate: null },
  notifications: {
    total: 1,
    by_status: { draft: 0, scheduled: 0, sending: 0, sent: 1, failed: 0, cancelled: 0 },
  },
  by_channel: [],
  by_type: [],
  by_tour: [],
  series: [],
  top_failed_contacts: [],
  failure_reasons: [],
  recent_notifications: [],
}

const stubs = {
  CostPanel: {
    props: ['tour', 'from', 'to', 'tz'],
    template: '<div data-testid="cost-panel-stub" :data-tour="tour" :data-from="from" />',
  },
  DailySeriesChart: true,
  ChannelBreakdown: true,
  TypeBreakdown: true,
  RecentNotifications: true,
  ReportsSummaryPanel: true,
  FailuresPanel: true,
}

function setup(
  user: { is_superuser: boolean },
  tourAdmin = false,
  summary: () => Response = () => jsonResponse(SUMMARY)
) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => summary())
  )
  const auth = useAuthStore()
  auth.user = { email: 'me@x.es', ...user } as typeof auth.user
  const tours = useToursStore()
  tours.tours = [
    {
      id: 1,
      uuid: 'T1',
      name: 'Gira',
      artist_name: 'A',
      start_date: '2026-11-01',
      end_date: '2026-11-30',
      status: 'active',
      currency: 'EUR',
      color: '#a8d800',
      current_user_is_admin: tourAdmin,
    } as never,
  ]
}

async function mountView() {
  const w = mount(ReportsView, { global: { plugins: [i18n], stubs } })
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  return w
}

async function selectTour(w: Awaited<ReturnType<typeof mountView>>, uuid: string) {
  await w.get('select').setValue(uuid)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ReportsView: panel de costes', () => {
  it('mounts CostPanel only with tour selected and superuser', async () => {
    setup({ is_superuser: true })
    const w = await mountView()
    // Sin gira seleccionada ("Todas las giras"): no hay panel.
    expect(w.find('[data-testid="cost-panel-stub"]').exists()).toBe(false)

    await selectTour(w, 'T1')
    const panel = w.get('[data-testid="cost-panel-stub"]')
    expect(panel.attributes('data-tour')).toBe('T1')
    expect(panel.attributes('data-from')).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    await selectTour(w, '')
    expect(w.find('[data-testid="cost-panel-stub"]').exists()).toBe(false)
  })

  it('does not mount for tour admin without superuser', async () => {
    setup({ is_superuser: false }, true)
    const w = await mountView()
    await selectTour(w, 'T1')
    // La columna lateral sí se pinta: lo que falta es solo el panel de costes.
    expect(w.find('failures-panel-stub').exists()).toBe(true)
    expect(w.find('[data-testid="cost-panel-stub"]').exists()).toBe(false)
  })

  it('keeps CostPanel when the summary is empty or fails', async () => {
    setup({ is_superuser: true }, false, () =>
      jsonResponse({ ...SUMMARY, totals: { ...SUMMARY.totals, recipients: 0 } })
    )
    const empty = await mountView()
    await selectTour(empty, 'T1')
    expect(empty.text()).toContain('Todavía no hay envíos en este periodo')
    expect(empty.find('[data-testid="cost-panel-stub"]').exists()).toBe(true)

    setActivePinia(createPinia())
    setup({ is_superuser: true }, false, () =>
      jsonResponse({ success: false, error: { message: 'boom', status_code: 500 } }, 500)
    )
    const failed = await mountView()
    await selectTour(failed, 'T1')
    expect(failed.text()).toContain('No se han podido cargar los informes')
    expect(failed.find('[data-testid="cost-panel-stub"]').exists()).toBe(true)
  })
})
