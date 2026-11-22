import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from './StatusBadge.vue'

describe('StatusBadge', () => {
  it.each(['sent', 'pending', 'scheduled', 'failed', 'off'] as const)(
    'pinta los tokens de %s y data-status',
    (status) => {
      const w = mount(StatusBadge, { props: { status, label: 'Etiqueta' } })
      expect(w.classes()).toContain(`bg-${status}-bg`)
      expect(w.classes()).toContain(`text-${status}-fg`)
      expect(w.attributes('data-status')).toBe(status)
      expect(w.text()).toBe('Etiqueta')
    }
  )

  it('size md por defecto y sm más compacto', () => {
    const md = mount(StatusBadge, { props: { status: 'sent', label: 'A' } })
    expect(md.classes()).toContain('text-[13px]')
    const sm = mount(StatusBadge, { props: { status: 'sent', label: 'A', size: 'sm' } })
    expect(sm.classes()).toContain('text-[12px]')
    expect(sm.classes()).not.toContain('text-[13px]')
  })
})
