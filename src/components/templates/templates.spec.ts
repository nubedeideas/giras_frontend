import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import TemplateDetail from './TemplateDetail.vue'
import TemplateForm from './TemplateForm.vue'
import { isSystemTemplate, type NotificationTemplate } from '@/composables/useNotificationTemplates'

function tpl(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    uuid: 't1',
    name: 'Alerta del día de show',
    slug: 'whatsapp_show_day_alert',
    notification_type: 'show_day_alert',
    channel: 'whatsapp',
    is_active: true,
    is_default: true,
    twilio_template_sid: '',
    variables: { '1': 'tour_name' },
    created_at: '2026-11-20T00:00:00Z',
    updated_at: '2026-11-20T00:00:00Z',
    ...overrides,
  }
}

describe('isSystemTemplate', () => {
  it('usa is_system si viene; si no, created_by nulo; sin el campo, no', () => {
    expect(isSystemTemplate({ is_system: true, created_by: 3 })).toBe(true)
    expect(isSystemTemplate({ is_system: false, created_by: null })).toBe(false)
    expect(isSystemTemplate({ created_by: null })).toBe(true)
    expect(isSystemTemplate({ created_by: 3 })).toBe(false)
    expect(isSystemTemplate({})).toBe(false)
  })
})

describe('plantillas del sistema', () => {
  const mountOpts = { global: { plugins: [i18n] } }

  it('TemplateDetail no ofrece editar ni eliminar y lo explica', () => {
    i18n.global.locale.value = 'es'
    const w = mount(TemplateDetail, { props: { template: tpl({ created_by: null }) }, ...mountOpts })
    expect(w.find('[data-testid="template-edit"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Eliminar template')
    expect(w.text()).toContain('Plantilla del sistema, no editable')
    expect(w.text()).toContain('Alerta del día de show')
  })

  it('TemplateDetail de una plantilla propia sigue ofreciendo editar y eliminar', () => {
    const w = mount(TemplateDetail, { props: { template: tpl({ created_by: 7 }) }, ...mountOpts })
    expect(w.find('[data-testid="template-edit"]').exists()).toBe(true)
    expect(w.text()).toContain('Eliminar template')
    expect(w.find('[data-testid="template-system-notice"]').exists()).toBe(false)
  })

  it('TemplateForm con una plantilla del sistema avisa y conserva su tipo en el selector', () => {
    const w = mount(TemplateForm, { props: { template: tpl({ is_system: true }) }, ...mountOpts })
    expect(w.find('[data-testid="template-system-notice"]').exists()).toBe(true)
    const select = w.find<HTMLSelectElement>('select')
    expect(select.element.value).toBe('show_day_alert')
  })
})
