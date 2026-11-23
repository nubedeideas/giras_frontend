import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { sheetInspect, sheetSub } from '@/test/sheetSubscriptions'
import SheetTabsEditor from './SheetTabsEditor.vue'

const picker = vi.hoisted(() => ({ pick: vi.fn() }))
vi.mock('@/composables/useGooglePicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useGooglePicker')>()
  return { ...actual, pickSpreadsheet: picker.pick, isPickerConfigured: () => true }
})

function stub() {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.endsWith('/inspect/')) return jsonResponse(sheetInspect())
    if (init?.method === 'PATCH') return jsonResponse(sheetSub())
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  picker.pick.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SheetTabsEditor', () => {
  it('el lector: inspect con el id de open_url, pestañas actuales marcadas y PATCH tabs', async () => {
    const fn = stub()
    const w = mount(SheetTabsEditor, {
      props: { sub: sheetSub(), displayName: 'Gira 2027' },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    expect(picker.pick).not.toHaveBeenCalled()
    const inspect = fn.mock.calls.find(([u]) => String(u).endsWith('/inspect/'))
    expect(JSON.parse(String(inspect?.[1]?.body))).toEqual({
      tour: 'T1',
      spreadsheet_id: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
    })
    const checks = w.findAll<HTMLInputElement>('[data-test="sheet-tab-check"]')
    expect(checks.filter((c) => c.element.checked)).toHaveLength(1)
    await checks[2].setValue(true)
    await w.get('[data-test="sheet-tabs-save"]').trigger('click')
    await flushPromises()
    const patch = fn.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ tabs: [{ gid: 0 }, { gid: 22 }] })
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('otro admin (sin open_url) elige la hoja en el selector', async () => {
    stub()
    picker.pick.mockResolvedValue({ id: 'SHEET-ID', name: 'x' })
    const w = mount(SheetTabsEditor, {
      props: {
        sub: sheetSub({ open_url: null, reader: { name: 'Ana', is_me: false, has_access: true } }),
        displayName: 'Gira 2027',
      },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await w.get('[data-test="sheet-tabs-pick"]').trigger('click')
    await flushPromises()
    expect(picker.pick).toHaveBeenCalledOnce()
    expect(w.findAll('[data-test="sheet-tab"]')).toHaveLength(7)
  })
})
