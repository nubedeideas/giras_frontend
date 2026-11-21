import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { rulePreview, unconfirmedPreview } from '@/test/rules'
import type { RulePreview } from '@/composables/useNotificationRules'
import RulePreviewPanel from './RulePreviewPanel.vue'

const ACTIVITIES = [
  {
    uuid: 'act-1',
    title: 'Vuelo MAD-BCN',
    scheduled_at: '2026-12-01T09:00:00Z',
    timezone: 'Europe/Madrid',
    activity_type_code: 'flight',
  },
  {
    uuid: 'act-2',
    title: 'Show',
    scheduled_at: '2026-12-02T20:00:00Z',
    timezone: 'Europe/Madrid',
    activity_type_code: 'show',
  },
]

/** El backend filtra por `activity_type_code`; aquí se simula ese filtro. */
function setupFetch(preview: RulePreview | (() => Response)) {
  const fn = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input))
    if (url.pathname.includes('/notifications/rules/')) {
      return typeof preview === 'function' ? preview() : jsonResponse(preview)
    }
    if (url.pathname.endsWith('/events/activities/')) {
      const code = url.searchParams.get('activity_type_code')
      const results = ACTIVITIES.filter((a) => !code || a.activity_type_code === code)
      return jsonResponse({ count: results.length, next: null, previous: null, results })
    }
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const activityCalls = (fn: ReturnType<typeof setupFetch>) =>
  fn.mock.calls
    .map(([u]) => new URL(String(u)))
    .filter((u) => u.pathname.endsWith('/events/activities/'))

const DRAFT = {
  name: 'R',
  tour: 'tour-1',
  trigger: 'activity_upcoming' as const,
  activity_type_codes: ['flight'],
  recipients_type: 'tour_members' as const,
  channel: 'whatsapp' as const,
  template: 'tpl-wa-flight',
  offset_minutes: 1440,
}

async function mountPanel(props: Record<string, unknown>) {
  const w = mount(RulePreviewPanel, {
    props: { tourUuid: 'tour-1', trigger: 'activity_upcoming', ...props },
    global: { plugins: [i18n] },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

describe('RulePreviewPanel', () => {
  it('"se enviaría" con destinatarios y estados', async () => {
    const fn = setupFetch(rulePreview())
    const w = await mountPanel({ draft: DRAFT, activityTypeCodes: ['flight'] })

    const previewCall = fn.mock.calls.find(([u]) => String(u).endsWith('/rules/preview/'))
    expect(previewCall?.[1]?.method).toBe('POST')
    expect(JSON.parse(String(previewCall?.[1]?.body)).trigger).toBe('activity_upcoming')

    expect(w.find('[data-test="preview-would-send"]').text()).toMatch(/^Se enviaría el .*30/)
    const recipients = w.findAll('[data-test="preview-recipient"]')
    expect(recipients).toHaveLength(2)
    expect(recipients[0].text()).toContain('Ana')
    expect(recipients[0].text()).toContain('Recibirá el aviso')
    expect(recipients[1].text()).toContain('Sin teléfono')
    expect(w.text()).toContain('{{1}} Ana')
    expect(w.find('[data-test="preview-default-reminders"]').text()).toContain(
      'Recordatorios automáticos de esta actividad: 3'
    )
    const options = w.findAll('[data-test="preview-activity"] option')
    expect(options).toHaveLength(2)
    expect(options[1].text()).toContain('Vuelo MAD-BCN')
  })

  it('pide las actividades filtradas en el backend por tipo y estado', async () => {
    const fn = setupFetch(rulePreview())
    await mountPanel({ draft: DRAFT, activityTypeCodes: ['flight', 'show'] })
    const calls = activityCalls(fn)
    expect(calls.map((u) => u.searchParams.get('activity_type_code')).sort()).toEqual([
      'flight',
      'show',
    ])
    for (const u of calls) {
      expect(u.searchParams.get('tour')).toBe('tour-1')
      expect(u.searchParams.get('upcoming')).toBe('true')
      expect(u.searchParams.getAll('status')).toEqual(['scheduled', 'confirmed', 'delayed'])
      expect(u.searchParams.get('page_size')).toBe('20')
    }
  })

  it('recarga el selector cuando cambian los tipos del borrador', async () => {
    const fn = setupFetch(rulePreview())
    const w = await mountPanel({ draft: DRAFT, activityTypeCodes: ['flight'] })
    expect(w.findAll('[data-test="preview-activity"] option')).toHaveLength(2)

    await w.setProps({ activityTypeCodes: [] })
    await flushPromises()
    const calls = activityCalls(fn)
    expect(calls).toHaveLength(2)
    expect(calls[1].searchParams.has('activity_type_code')).toBe(false)
    expect(w.findAll('[data-test="preview-activity"] option')).toHaveLength(3)
  })

  it('"no se enviaría" con el motivo', async () => {
    setupFetch(
      rulePreview({ would_fire: false, skip_reason: 'no_recipients', scheduled_for: null })
    )
    const w = await mountPanel({ ruleUuid: 'rule-1' })
    expect(w.find('[data-test="preview-would-not-send"]').text()).toBe(
      'No se enviaría: Nadie tenía teléfono o email para este canal.'
    )
  })

  it('sin actividad que encaje', async () => {
    setupFetch(
      rulePreview({
        would_fire: false,
        skip_reason: 'no_matching_activity',
        activity: null,
        recipients: [],
      })
    )
    const w = await mountPanel({ draft: DRAFT })
    expect(w.find('[data-test="preview-no-activity"]').exists()).toBe(true)
  })

  it('unconfirmed: candidatas con elegibles, excluidos y cupo, sin "Se enviaría el"', async () => {
    const fn = setupFetch(unconfirmedPreview())
    const w = await mountPanel({ ruleUuid: 'rule-1', trigger: 'notification_unconfirmed' })
    expect(w.find('[data-test="preview-activity"]').exists()).toBe(false)
    expect(activityCalls(fn)).toHaveLength(0)
    // scheduled_for es null: no se pinta "Se enviaría el " vacío.
    expect(w.find('[data-test="preview-would-send"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Se enviaría el')
    const c = w.find('[data-test="preview-candidate"]')
    expect(c.text()).toContain('3 por recordar')
    expect(c.text()).toContain('Recordadas hace poco: 1')
    expect(c.text()).toContain('Sin teléfono: 2')
    expect(c.text()).toContain('Ya han confirmado: 4')
    expect(w.find('[data-test="preview-plan"]').text()).toContain(
      'Cupo de WhatsApp restante: 40'
    )
  })

  it('error con reintentar', async () => {
    setupFetch(() =>
      jsonResponse({ success: false, error: { message: 'Demasiadas', status_code: 429 } }, 429)
    )
    const w = await mountPanel({ ruleUuid: 'rule-1' })
    expect(w.find('[data-test="preview-error"]').text()).toContain('Demasiadas solicitudes')
  })
})
