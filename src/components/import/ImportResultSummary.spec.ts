import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportJob, ImportResult } from '@/composables/useImportJobs'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { importJob } from '@/test/importJobs'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import ImportResultSummary from './ImportResultSummary.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const result: ImportResult = {
  contacts_created: 3,
  // `contacts_linked` ya incluye `linked_late` (como lo guarda commit_team).
  contacts_linked: 2,
  linked_late: 1,
  already_in_tour: 1,
  added_to_group: 4,
  skipped: 2,
  team_group_uuid: 'G1',
  team_group_is_default: false,
  contact_uuids: [],
}

describe('ImportResultSummary', () => {
  it('recuentos, aviso de grupo por defecto ajeno e "Importar más"', async () => {
    const w = mount(ImportResultSummary, {
      props: {
        job: {
          result,
          team_group: { uuid: 'G1', name: 'Equipo de la gira', exists: true, is_default: false, default_group_name: 'Todos' },
        },
      },
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    })
    expect(w.get('[data-test="import-result-summary"]').text()).toBe(
      'Contactos nuevos: 3 · Vinculados: 2 · En el Equipo de la gira: 4'
    )
    expect(w.text()).toContain('1 ya estaba en la gira')
    expect(w.text()).toContain('2 omitidos')
    expect(w.get('[data-test="import-result-not-default"]').text()).toContain('«Todos»')
    expect(w.findComponent(RouterLinkStub).props('to')).toEqual({ name: 'contacts' })
    await w.get('[data-test="import-result-more"]').trigger('click')
    expect(w.emitted('importMore')).toHaveLength(1)
  })

  it('el enlace a contactos usa la clase de BtnPrimary y sin confirmer_in_team no hay aviso', () => {
    const w = mount(ImportResultSummary, {
      props: { job: { result: { ...result, team_group_is_default: true }, team_group: null } },
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    })
    const link = w.get('[data-test="import-result-contacts"]')
    expect(link.classes()).toEqual(expect.arrayContaining(['bg-acid', 'text-night', 'min-h-[44px]']))
    expect(w.find('[data-test="import-result-confirmer-outside"]').exists()).toBe(false)
  })

  it('D10: confirmer_in_team=false avisa de que los avisos solo llegarán en la app', () => {
    const mountWith = (confirmer_in_team: boolean) =>
      mount(ImportResultSummary, {
        props: { job: { result: { ...result, confirmer_in_team }, team_group: null } },
        global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
      })
    expect(mountWith(false).get('[data-test="import-result-confirmer-outside"]').text()).toBe(
      'Tú no estás en el Equipo de la gira: los avisos solo te llegarán en la app.'
    )
    expect(mountWith(true).find('[data-test="import-result-confirmer-outside"]').exists()).toBe(false)
  })

  describe('F2: actividades', () => {
    const f2Result = (o: Partial<ImportResult> = {}): ImportResult => ({
      ...result,
      contacts_created: 0,
      contacts_linked: 0,
      linked_late: 0,
      already_in_tour: 0,
      added_to_group: 0,
      skipped: 0,
      team_group_is_default: true,
      activities_created: 44,
      activities_replaced: 1,
      activities_skipped: 2,
      flights_to_enrich: 6,
      tour_activated: true,
      notifications_paused: false,
      post_import: { status: 'done', reminders_created: 120, first_send_at: '2026-11-30T08:00:00Z' },
      ...o,
    })
    const tour = (o: Partial<Tour> = {}) =>
      ({
        id: 1,
        uuid: 'T1',
        name: 'Gira',
        status: 'active',
        timezone: 'Europe/Madrid',
        current_user_is_admin: true,
        enable_notifications: true,
        notifications_paused_at: null,
        ...o,
      }) as Tour
    const mountWith = (r: ImportResult) =>
      mount(ImportResultSummary, {
        props: { job: { uuid: 'J1', tour: 'T1', result: r, team_group: null } },
        global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
      })

    it('recuentos, vuelos, recordatorios con primer envío y enlaces', () => {
      useToursStore().tours = [tour()]
      const w = mountWith(f2Result())
      expect(w.text()).toContain('Importación completada')
      expect(w.get('[data-test="import-result-activities"]').text()).toBe(
        'Actividades creadas: 44 · Sustituidas: 1 · Omitidas: 2'
      )
      expect(
        i18n.global.t('importer.result.activities', { created: 1, replaced: 0, skipped: 0 }, { locale: 'en' })
      ).toBe('Activities created: 1 · Replaced: 0 · Skipped: 0')
      // Sin equipo en el job: no se pinta la línea de contactos.
      expect(w.find('[data-test="import-result-summary"]').exists()).toBe(false)
      expect(w.get('[data-test="import-result-flights"]').text()).toBe(
        '6 vuelos se completarán con los datos de la aerolínea'
      )
      const reminders = w.get('[data-test="import-result-reminders"]')
      expect(reminders.text()).toContain('120 recordatorios programados · primer envío')
      // 08:00 UTC = 09:00 en Madrid, en Space Mono.
      expect(reminders.get('.font-time.tnum').text()).toContain('09:00')
      const links = w.findAllComponents(RouterLinkStub).map((l) => l.props('to'))
      expect(links).toContainEqual({ name: 'events' })
      expect(links).toContainEqual({ name: 'tour', query: { tab: 'crew' } })
      expect(w.get('[data-test="import-result-tour-state"]').text()).toContain('La gira ha pasado a activa.')
      expect(w.find('[data-testid="notif-pause"]').exists()).toBe(true)
    })

    it('sin admin no hay "Enviar enlaces del portal"', () => {
      useToursStore().tours = [tour({ current_user_is_admin: false })]
      const w = mountWith(f2Result())
      expect(w.find('[data-test="import-result-portal"]').exists()).toBe(false)
    })

    it('"Programando avisos…" mientras post_import está pending: sondea cada 2 s', async () => {
      vi.useFakeTimers()
      const done = importJob({
        status: 'done',
        result: f2Result({ post_import: { status: 'done', reminders_created: 3, first_send_at: null } }),
      })
      const fn = vi.fn<typeof fetch>(async () => jsonResponse(done))
      vi.stubGlobal('fetch', fn)
      const w = mountWith(
        f2Result({ post_import: { status: 'pending', reminders_created: null, first_send_at: null } })
      )
      expect(w.get('[data-test="import-result-scheduling"]').text()).toBe('Programando avisos…')
      expect(fn).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(2000)
      await flushPromises()
      expect(fn).toHaveBeenCalledTimes(1)
      expect(String(fn.mock.calls[0][0])).toContain('/integrations/import-jobs/J1/')
      const updated = w.emitted('updated') as [ImportJob][]
      expect(updated[0][0].result).toMatchObject({ post_import: { status: 'done' } })
      await w.setProps({ job: { uuid: 'J1', tour: 'T1', result: updated[0][0].result, team_group: null } })
      expect(w.get('[data-test="import-result-reminders"]').text()).toBe('3 recordatorios programados')
      await vi.advanceTimersByTimeAsync(4000)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('pending más de 60 s o failed → "Los avisos se programarán en unos minutos"', async () => {
      vi.useFakeTimers()
      const pending = f2Result({ post_import: { status: 'pending', reminders_created: null, first_send_at: null } })
      const fn = vi.fn<typeof fetch>(async () => jsonResponse(importJob({ status: 'done', result: pending })))
      vi.stubGlobal('fetch', fn)
      const w = mountWith(pending)
      await vi.advanceTimersByTimeAsync(62_000)
      await flushPromises()
      expect(w.get('[data-test="import-result-scheduling-later"]').text()).toBe(
        'Los avisos se programarán en unos minutos.'
      )
      expect(fn.mock.calls.length).toBeLessThanOrEqual(30)

      const failed = mountWith(
        f2Result({ post_import: { status: 'failed', reminders_created: null, first_send_at: null } })
      )
      expect(failed.find('[data-test="import-result-scheduling-later"]').exists()).toBe(true)
    })

    it('"Volver a borrador" pide confirmación y llama a updateTour({status: "draft"})', async () => {
      const tours = useToursStore()
      tours.tours = [tour()]
      const updateTour = vi.spyOn(tours, 'updateTour').mockImplementation(async () => {
        tours.tours = [tour({ status: 'draft' })]
      })
      const w = mountWith(f2Result())
      await w.get('[data-test="import-result-back-to-draft"]').trigger('click')
      expect(updateTour).not.toHaveBeenCalled()
      const modal = w.get('[data-test="import-result-back-to-draft-modal"]')
      expect(modal.text()).toContain('Los recordatorios siguen programados')
      await w.get('[data-test="import-result-back-to-draft-confirm"]').trigger('click')
      await flushPromises()
      expect(updateTour).toHaveBeenCalledWith('T1', { status: 'draft' })
      expect(w.get('[data-test="import-result-tour-state"]').text()).toBe('La gira está en borrador.')
      expect(w.find('[data-test="import-result-back-to-draft"]').exists()).toBe(false)
    })

    it('recién confirmada con la gira aún en draft en el store: se fía de tour_activated', () => {
      // `loadTours()` todavía no ha respondido: el store sigue con la gira en borrador.
      useToursStore().tours = [tour({ status: 'draft' })]
      const w = mountWith(f2Result())
      expect(w.get('[data-test="import-result-tour-state"]').text()).toContain('La gira ha pasado a activa.')
      expect(w.find('[data-test="import-result-back-to-draft"]').exists()).toBe(true)
    })

    it('error al volver a borrador se muestra traducido', async () => {
      const tours = useToursStore()
      tours.tours = [tour()]
      vi.spyOn(tours, 'updateTour').mockRejectedValue(new Error('boom'))
      const w = mountWith(f2Result())
      await w.get('[data-test="import-result-back-to-draft"]').trigger('click')
      await w.get('[data-test="import-result-back-to-draft-confirm"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="import-result-back-to-draft-error"]').text()).toBe(
        'No se ha podido cambiar el estado de la gira. Inténtalo de nuevo.'
      )
    })
  })
})
