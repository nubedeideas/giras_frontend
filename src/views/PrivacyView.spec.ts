import { describe, expect, it } from 'vitest'
import es from '@/i18n/es'
import en from '@/i18n/en'

type Section = {
  id: string
  title: string
  paragraphs?: string[]
  items?: string[]
  paragraphsAfter?: string[]
  statement?: string
  links?: { label: string; href: string }[]
}

const esSections = es.privacy.sections as Section[]
const enSections = en.privacy.sections as Section[]

// El test genérico de i18n trata los arrays como hojas: no compara su contenido.
describe('privacy i18n', () => {
  it('es y en tienen las mismas secciones, en el mismo orden y con la misma forma', () => {
    expect(enSections.map((s) => s.id)).toEqual(esSections.map((s) => s.id))
    esSections.forEach((s, i) => {
      const e = enSections[i]
      expect(Object.keys(e).sort()).toEqual(Object.keys(s).sort())
      expect(e.paragraphs?.length).toBe(s.paragraphs?.length)
      expect(e.items?.length).toBe(s.items?.length)
      expect(e.paragraphsAfter?.length).toBe(s.paragraphsAfter?.length)
      expect(e.links?.map((l) => l.href)).toEqual(s.links?.map((l) => l.href))
    })
  })

  it('incluye la sección de Google con la declaración de uso limitado y sus enlaces', () => {
    const google = esSections.find((s) => s.id === 'datos-de-google')
    const googleEn = enSections.find((s) => s.id === 'datos-de-google')
    expect(google?.statement).toBe(
      'El uso que Giras hace de la información recibida de las APIs de Google se ajusta a la Política de datos de usuario de los servicios de API de Google, incluidos los requisitos de uso limitado.'
    )
    expect(googleEn?.statement).toBe(
      "Giras' use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements."
    )
    const hrefs = google?.links?.map((l) => l.href)
    expect(hrefs).toContain('https://developers.google.com/terms/api-services-user-data-policy')
    expect(hrefs).toContain('https://myaccount.google.com/permissions')
  })

  it('la sección de Google no menciona calendar.events (solo pedimos lectura)', () => {
    for (const sections of [esSections, enSections]) {
      const google = sections.find((s) => s.id === 'datos-de-google')
      expect(google?.items?.length).toBeGreaterThan(0)
      for (const item of google?.items ?? []) expect(item).not.toContain('calendar.events')
    }
  })

  it('las claves leídas con t() no usan sintaxis especial de vue-i18n', () => {
    // t() compila el mensaje: @ (linked), { } (interpolación) y | (plural) romperían el texto.
    const flat = Object.entries(es.privacy).filter(([, v]) => typeof v === 'string')
    const flatEn = Object.entries(en.privacy).filter(([, v]) => typeof v === 'string')
    for (const [, v] of [...flat, ...flatEn]) expect(v).not.toMatch(/[@{}|]/)
  })
})
