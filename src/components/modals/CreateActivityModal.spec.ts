import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { stubFetch, stubMatchMedia } from '@/test/reminders'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'
import CreateActivityModal from './CreateActivityModal.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
})

const TYPE = {
  uuid: 'type-urgent',
  code: 'urgent_meeting',
  name: 'Reunión urgente',
  category: 'meetings',
  is_active: true,
  has_duration: true,
}

function setTour(isAdmin: boolean) {
  const store = useToursStore()
  store.tours = [{ id: 1, uuid: 'T1', name: 'Gira', current_user_is_admin: isAdmin } as Tour]
  store.setActiveTourByUuid('T1')
}

function handler(code = 'urgent_meeting', status = 'scheduled') {
  return stubFetch((url, init) => {
    if (url.pathname.endsWith('/activity-types/')) {
      return jsonResponse({ count: 1, next: null, previous: null, results: [{ ...TYPE, code }] })
    }
    if (url.pathname.endsWith('/events/activities/') && init?.method === 'POST') {
      return jsonResponse({
        uuid: 'A1',
        title: 'Reunión urgente',
        status,
        activity_type: { ...TYPE, code },
      }, 201)
    }
    if (url.pathname.endsWith('/notices/urgent/')) return jsonResponse({}, 500)
    return jsonResponse({}, 404)
  })
}

async function createUrgent() {
  const w = mount(CreateActivityModal, {
    props: { show: false },
    global: { plugins: [i18n], stubs: { UrgentNoticeModal: true } },
  })
  await w.setProps({ show: true })
  await flushPromises()
  await w.get('select').setValue('type-urgent')
  const create = w.findAll('button').find((b) => b.text() === 'Crear Actividad')!
  await create.trigger('click')
  await flushPromises()
  return w
}

describe('CreateActivityModal: oferta de aviso urgente', () => {
  it('al crear una reunión urgente siendo admin ofrece avisar y abre el aviso', async () => {
    setTour(true)
    handler()
    const w = await createUrgent()
    expect(w.emitted('close')).toBeTruthy()
    expect(w.get('[data-test="urgent-offer"]').text()).toContain(
      '¿Quieres avisar ahora al equipo de esta reunión urgente?'
    )
    await w.get('[data-test="urgent-offer-accept"]').trigger('click')
    const modal = w.findComponent({ name: 'UrgentNoticeModal' })
    expect(modal.props('show')).toBe(true)
    expect(modal.props('activityUuid')).toBe('A1')
  })

  it('no lo ofrece a quien no es admin ni para otros tipos', async () => {
    setTour(false)
    handler()
    let w = await createUrgent()
    expect(w.find('[data-test="urgent-offer"]').exists()).toBe(false)
    setActivePinia(createPinia())
    setTour(true)
    handler('team_meeting')
    w = await createUrgent()
    expect(w.find('[data-test="urgent-offer"]').exists()).toBe(false)
  })
})
