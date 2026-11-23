import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { jsonResponse } from '@/test/http'
import { importJob } from '@/test/importJobs'
import { stubMatchMedia } from '@/test/reminders'
import ImportDropZone from './ImportDropZone.vue'

const downscale = vi.hoisted(() => vi.fn(async (f: File) => f))
vi.mock('@/utils/imageResize', async (orig) => ({
  ...(await orig<typeof import('@/utils/imageResize')>()),
  downscaleImage: downscale,
}))

const MB = 1024 * 1024

function fakeFile(name: string, size = 1000, type = ''): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

function mountZone(props: { expected?: 'team' | 'itinerary' | 'any' } = { expected: 'team' }) {
  return mount(ImportDropZone, {
    props: { tourUuid: 'T1', entryPoint: 'tour', ...props },
    global: { plugins: [i18n] },
  })
}

async function pick(w: ReturnType<typeof mountZone>, files: File[], selector = '[data-test="import-file-input"]') {
  const input = w.get(selector)
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  i18n.global.locale.value = 'es'
  stubMatchMedia(false)
  downscale.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ImportDropZone', () => {
  it('el input principal no tiene capture; "Hacer foto" solo en móvil y con capture', async () => {
    const w = mountZone()
    const main = w.get('[data-test="import-file-input"]')
    expect(main.attributes('capture')).toBeUndefined()
    expect(main.attributes('accept')).toContain('.pdf')
    expect(main.attributes('accept')).toContain('.xlsx')
    expect(main.attributes('multiple')).toBeDefined()
    expect(w.find('[data-test="import-photo-input"]').exists()).toBe(false)

    stubMatchMedia(true)
    const m = mountZone()
    await flushPromises()
    const photo = m.get('[data-test="import-photo-input"]')
    expect(photo.attributes('capture')).toBe('environment')
    expect(photo.attributes('accept')).toBe('image/*')
    expect(m.get('[data-test="import-file-input"]').attributes('capture')).toBeUndefined()
  })

  it('rechaza tipos no admitidos, más de 6 archivos o más de 20 MB sin llamar a la API', async () => {
    const fn = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fn)
    const w = mountZone()

    await pick(w, [fakeFile('virus.exe')])
    expect(w.get('[data-test="import-error"]').text()).toBe('virus.exe: formato no admitido.')
    expect(w.find('[data-test="import-file-list"]').exists()).toBe(false)

    await pick(w, Array.from({ length: 7 }, (_, i) => fakeFile(`${i}.csv`)))
    expect(w.get('[data-test="import-error"]').text()).toContain('hasta 6 archivos')

    await pick(w, [fakeFile('a.xlsx', 15 * MB), fakeFile('b.pdf', 6 * MB)])
    expect(w.get('[data-test="import-error"]').text()).toBe(
      i18n.global.t('importer.errors.too_large')
    )

    await pick(w, [fakeFile('grande.pdf', 16 * MB)])
    expect(w.get('[data-test="import-error"]').text()).toContain('15 MB')

    expect(w.find('[data-test="import-file-list"]').exists()).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })

  it('acepta un PDF de hasta 15 MB sin aviso; con .ics solo la pista neutra (F3)', async () => {
    const w = mountZone()
    await pick(w, [fakeFile('Dossier.pdf', 15 * MB, 'application/pdf')])
    expect(w.find('[data-test="import-error"]').exists()).toBe(false)
    expect(w.get('[data-test="import-file-list"]').text()).toContain('Dossier.pdf')
    expect(w.find('[data-test="import-ics-hint"]').exists()).toBe(false)

    await pick(w, [fakeFile('gira.ics', 2000, 'text/calendar')])
    expect(w.find('[data-test="import-ics-notice"]').exists()).toBe(false)
    expect(w.text()).not.toContain('llegará pronto')
    expect(w.get('[data-test="import-ics-hint"]').text()).toBe(
      'Las fechas y horas se toman tal cual del calendario.'
    )
    expect(w.find('[data-test="import-error"]').exists()).toBe(false)
  })

  it('las fotos pasan por downscaleImage; si no se puede decodificar, aviso de HEIC', async () => {
    const { ImageDecodeError } = await import('@/utils/imageResize')
    const w = mountZone()
    await pick(w, [fakeFile('lista.jpg', 2 * MB, 'image/jpeg')])
    expect(downscale).toHaveBeenCalledTimes(1)
    expect(w.get('[data-test="import-file-list"]').text()).toContain('lista.jpg')

    downscale.mockRejectedValueOnce(new ImageDecodeError('IMG_1.HEIC'))
    await pick(w, [fakeFile('IMG_1.HEIC', MB, 'image/heic')])
    expect(w.get('[data-test="import-error"]').text()).toContain('HEIC')
  })

  it('429 too_many_active_imports traducido, nunca el código crudo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          {
            success: false,
            error: {
              message: 'too_many_active_imports',
              status_code: 429,
              details: { code: ['too_many_active_imports'] },
            },
          },
          429
        )
      )
    )
    const w = mountZone()
    await pick(w, [fakeFile('crew.csv')])
    await w.get('[data-test="import-submit"]').trigger('click')
    await flushPromises()
    const msg = w.get('[data-test="import-error"]').text()
    expect(msg).toBe('Ya tienes importaciones en curso. Espera a que terminen.')
    expect(msg).not.toContain('too_many_active_imports')
    expect(w.emitted('created')).toBeUndefined()
  })

  it('sin archivos ni texto no deja importar; con texto pegado emite created', async () => {
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(importJob({ status: 'uploaded' }), 202))
    vi.stubGlobal('fetch', fn)
    const w = mountZone()
    expect(w.get('[data-test="import-submit"]').attributes('disabled')).toBeDefined()

    await w.get('[data-test="import-paste-toggle"]').trigger('click')
    await w.get('[data-test="import-text"]').setValue('Juan (FOH) 655 44 33 22')
    await w.get('[data-test="import-submit"]').trigger('click')
    await flushPromises()

    expect(fn).toHaveBeenCalledTimes(1)
    const body = fn.mock.calls[0][1]!.body as FormData
    expect(body.get('text')).toBe('Juan (FOH) 655 44 33 22')
    expect(body.get('entry_point')).toBe('tour')
    expect(body.get('expected')).toBe('team')
    expect(w.emitted('created')?.[0][0]).toMatchObject({ uuid: 'J1', status: 'uploaded' })
  })

  it('el texto largo no se corta: se avisa con textTooLong y no se envía', async () => {
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(importJob({ status: 'uploaded' }), 202))
    vi.stubGlobal('fetch', fn)
    const w = mountZone()
    await w.get('[data-test="import-paste-toggle"]').trigger('click')
    const area = w.get('[data-test="import-text"]')
    expect(area.attributes('maxlength')).toBeUndefined()
    expect(area.attributes('aria-label')).toBe('Texto pegado con el equipo')
    await area.setValue('x'.repeat(20001))
    expect(w.get('[data-test="import-text-count"]').classes()).toContain('text-failed-fg')
    await w.get('[data-test="import-submit"]').trigger('click')
    await flushPromises()
    expect(fn).not.toHaveBeenCalled()
    expect(w.text()).toContain('El texto pegado supera los 20.000 caracteres.')
  })

  const ANY_PLACEHOLDER = 'Pega aquí el itinerario o la lista del equipo'

  it('F2: la ayuda del texto pegado y el campo expected dependen de expected', async () => {
    const fn = vi.fn<typeof fetch>(async () => jsonResponse(importJob({ status: 'uploaded' }), 202))
    vi.stubGlobal('fetch', fn)
    const cases = [
      {
        expected: 'itinerary' as const,
        placeholder: 'Pega aquí el itinerario (de un email, de WhatsApp…)',
        sent: 'itinerary',
      },
      { expected: 'any' as const, placeholder: ANY_PLACEHOLDER, sent: null },
      { expected: undefined, placeholder: ANY_PLACEHOLDER, sent: null },
    ]
    for (const [i, c] of cases.entries()) {
      const w = mountZone(c.expected ? { expected: c.expected } : {})
      await w.get('[data-test="import-paste-toggle"]').trigger('click')
      const area = w.get('[data-test="import-text"]')
      expect(area.attributes('placeholder')).toBe(c.placeholder)
      await area.setValue('3 dic · 21:00 Show en Madrid')
      await w.get('[data-test="import-submit"]').trigger('click')
      await flushPromises()
      const body = fn.mock.calls[i][1]!.body as FormData
      expect(body.get('expected')).toBe(c.sent)
      w.unmount()
    }
  })
})
