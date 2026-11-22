import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import TourSelect from './TourSelect.vue'

const TOUR: Tour = {
  id: 1,
  uuid: 'T1',
  name: 'Gira de invierno',
  artist_name: 'Rosalía',
  start_date: '2026-12-01',
  end_date: '2026-12-31',
  status: 'active',
  currency: 'EUR',
  color: 'rgb(255, 0, 0)',
  owner_email: 'a@b.es',
}

function mountSelect(open = false) {
  return mount(TourSelect, { props: { open }, global: { plugins: [i18n] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
})

describe('TourSelect', () => {
  it('con gira: punto de color, nombre móvil y escritorio, estado solo en sm+', () => {
    const tours = useToursStore()
    tours.tours = [TOUR]
    tours.setActiveTour(1)
    const w = mountSelect()

    const dot = w.find('[data-test="tour-select-dot"]')
    expect((dot.element as HTMLElement).style.background).toBe('rgb(255, 0, 0)')

    const mobile = w.find('[data-test="tour-select-mobile"]')
    expect(mobile.text()).toBe('Rosalía')
    expect(mobile.classes()).toEqual(expect.arrayContaining(['sm:hidden', 'max-w-[120px]', 'truncate']))

    const desktop = w.find('[data-test="tour-select-desktop"]')
    expect(desktop.text()).toBe('Rosalía · Gira de invierno')
    expect(desktop.classes()).toEqual(expect.arrayContaining(['hidden', 'sm:inline']))

    const badge = w.find('[data-status]')
    expect(badge.attributes('data-status')).toBe('sent')
    expect(badge.text()).toBe('Activa')
    expect(badge.classes()).toEqual(expect.arrayContaining(['hidden', 'sm:inline-flex']))

    const btn = w.find('[data-test="tour-select"]')
    expect(btn.attributes('aria-label')).toBe(
      'Gira: Rosalía · Gira de invierno, Activa. Cambiar gira'
    )
    expect(btn.attributes('title')).toContain('2026')
  })

  it('aria-expanded refleja open', () => {
    expect(mountSelect(false).find('button').attributes('aria-expanded')).toBe('false')
    expect(mountSelect(true).find('button').attributes('aria-expanded')).toBe('true')
  })

  it('sin gira: "Todas las Giras" sin punto ni estado', () => {
    useToursStore().tours = [TOUR]
    const w = mountSelect()
    expect(w.text()).toContain('Todas las Giras')
    expect(w.find('[data-test="tour-select-dot"]').exists()).toBe(false)
    expect(w.find('[data-status]').exists()).toBe(false)
  })

  it('clic emite toggle con el rect del botón', async () => {
    const w = mountSelect()
    await w.find('button').trigger('click')
    const ev = w.emitted('toggle')
    expect(ev).toHaveLength(1)
    expect(ev![0][0]).toHaveProperty('width')
  })
})
