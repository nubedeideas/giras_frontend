import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import { importJob, teamRow } from '@/test/importJobs'
import { stubMatchMedia } from '@/test/reminders'
import type { ContactRole } from '@/composables/useContactRoles'
import type { ImportJob } from '@/composables/useImportJobs'
import ImportTeamTable from './ImportTeamTable.vue'

const ROLE = { uuid: 'R1', name: 'Sound Engineer' } as ContactRole
const ROLE2 = { uuid: 'R2', name: 'Driver' } as ContactRole

function makeJob(): ImportJob {
  return importJob({
    draft: {
      team: [
        teamRow({ client_id: 't1', confidence: 0.95 }),
        teamRow({ client_id: 't2', display_name: 'Pedro', confidence: 0.75 }),
        teamRow({
          client_id: 't3',
          display_name: 'Marta',
          confidence: 0.5,
          needs_action: true,
          issues: ['phone_invalid'],
        }),
        teamRow({ client_id: 't4', display_name: 'Sara', already_in_group: true, in_group: false }),
      ],
    },
  })
}

function mountTable(props: Record<string, unknown> = {}) {
  return mount(ImportTeamTable, {
    props: { job: makeJob(), saving: new Set<string>(), roles: [ROLE, ROLE2], ...props },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  i18n.global.locale.value = 'es'
})

describe('ImportTeamTable (escritorio)', () => {
  beforeEach(() => stubMatchMedia(false))

  it('confianza por color vía StatusBadge y la fila por resolver primero', () => {
    const w = mountTable()
    const rows = w.findAll('tr[data-row]')
    expect(rows.map((r) => r.attributes('data-row'))).toEqual(['t3', 't1', 't2', 't4'])
    const tone = (id: string) =>
      w.get(`tr[data-row="${id}"] [data-test="import-row-confidence"]`).attributes('data-status')
    expect(tone('t1')).toBe('sent')
    expect(tone('t2')).toBe('pending')
    expect(tone('t3')).toBe('failed')
    expect(w.get('tr[data-row="t3"]').text()).toContain('El teléfono no parece válido')
  })

  it('omitir, casilla del grupo y rol emiten el PATCH correcto', async () => {
    const w = mountTable()
    await w.get('tr[data-row="t1"] [data-test="import-row-skip"]').trigger('click')
    const box = w.get('tr[data-row="t1"] [data-test="import-row-ingroup"]')
    ;(box.element as HTMLInputElement).checked = false
    await box.trigger('change')
    await w.get('tr[data-row="t1"] [data-test="import-row-role"]').setValue('R2')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 't1', action: 'skip' }],
      [{ client_id: 't1', fields: { in_group: false } }],
      [{ client_id: 't1', fields: { role_uuid: 'R2' } }],
    ])
  })

  it('"En el grupo" vuelve a su valor si el PATCH falla (la fila no cambia)', async () => {
    const saving = new Set<string>()
    const w = mountTable({ saving })
    const box = () => w.get('tr[data-row="t1"] [data-test="import-row-ingroup"]')
    const el = () => box().element as HTMLInputElement
    expect(el().checked).toBe(true)
    el().checked = false
    await box().trigger('change')
    // El padre marca la fila como guardando: la casilla se queda como la ha dejado el usuario.
    await w.setProps({ saving: new Set(['t1']) })
    expect(el().checked).toBe(false)
    // Termina el PATCH con error: el job no cambia (in_group sigue true) y la casilla vuelve.
    await w.setProps({ saving: new Set<string>() })
    expect(el().checked).toBe(true)
  })

  it('"En el grupo" se queda con el valor nuevo si el PATCH va bien', async () => {
    const w = mountTable()
    const box = () => w.get('tr[data-row="t1"] [data-test="import-row-ingroup"]')
    ;(box().element as HTMLInputElement).checked = false
    await box().trigger('change')
    await w.setProps({ saving: new Set(['t1']) })
    const job = makeJob()
    job.draft.team = job.draft.team!.map((r) => (r.client_id === 't1' ? { ...r, in_group: false } : r))
    await w.setProps({ job, saving: new Set<string>() })
    expect((box().element as HTMLInputElement).checked).toBe(false)
  })

  it('casilla desactivada (y marcada) con already_in_group', () => {
    const w = mountTable()
    const box = w.get('tr[data-row="t4"] [data-test="import-row-ingroup"]')
    expect(box.attributes('disabled')).toBeDefined()
    expect((box.element as HTMLInputElement).checked).toBe(true)
  })

  it('recuperar una omitida vuelve a create; "Dar por buena" en la roja', async () => {
    const job = makeJob()
    job.draft.team![1] = { ...job.draft.team![1], action: 'skip' }
    const w = mountTable({ job })
    await w.get('tr[data-row="t2"] [data-test="import-row-restore"]').trigger('click')
    await w.get('tr[data-row="t3"] [data-test="import-row-reviewed"]').trigger('click')
    expect(w.emitted('patch')).toEqual([
      [{ client_id: 't2', action: 'create' }],
      [{ client_id: 't3', reviewed: true }],
    ])
  })

  it('solo pendientes y la fila elegida se despliega con el slot', () => {
    const w = mount(ImportTeamTable, {
      props: { job: makeJob(), saving: new Set<string>(), onlyPending: true, selectedId: 't3' },
      slots: { expanded: '<div data-test="slot-editor" />' },
      global: { plugins: [i18n] },
    })
    expect(w.findAll('tr[data-row]').map((r) => r.attributes('data-row'))).toEqual(['t3'])
    expect(w.find('[data-test="slot-editor"]').exists()).toBe(true)
  })
})

describe('ImportTeamTable (móvil y compacto)', () => {
  it('móvil: "Por resolver" primero y "Listas" plegadas', async () => {
    stubMatchMedia(true)
    const w = mountTable()
    expect(w.find('table').exists()).toBe(false)
    expect(w.get('[data-test="import-section-pending"]').text()).toBe('Por resolver (1)')
    expect(w.findAll('[data-row]').map((r) => r.attributes('data-row'))).toEqual(['t3'])
    await w.get('[data-test="import-section-ready"]').trigger('click')
    expect(w.findAll('[data-row]').map((r) => r.attributes('data-row'))).toEqual(['t3', 't1', 't2', 't4'])
  })

  it('compacto: tarjetas sin matchMedia, sin "Editar" y con el resolutor en línea', async () => {
    const job = importJob({
      draft: {
        team: [
          teamRow({
            client_id: 't1',
            needs_action: true,
            match: {
              status: 'name_suggestion',
              by: null,
              contact_uuid: 'C1',
              contact_name: 'Juan Pérez',
              contact_phone: '+34600111222',
              candidates: [],
            },
          }),
        ],
      },
    })
    const w = mount(ImportTeamTable, {
      props: { job, saving: new Set<string>(), compact: true },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-test="import-row-edit"]').exists()).toBe(false)
    expect(w.get('[data-test="import-row-link"]').text()).toContain('Es Juan Pérez')
    await w.get('[data-test="import-row-other"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ client_id: 't1', action: 'create', reviewed: true }]])
  })
})

describe('ImportTeamTable (F5a: secciones y deslizar)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('section="pending": solo las tarjetas por resolver, sin cabecera ni "Listas"', () => {
    stubMatchMedia(true)
    const w = mountTable({ section: 'pending' })
    expect(w.find('[data-test="import-section-pending"]').exists()).toBe(false)
    expect(w.find('[data-test="import-section-ready"]').exists()).toBe(false)
    expect(w.findAll('[data-row]').map((r) => r.attributes('data-row'))).toEqual(['t3'])
  })

  it('section="ready": solo "Listas", plegadas mientras quede algo por resolver', async () => {
    stubMatchMedia(true)
    const w = mountTable({ section: 'ready' })
    expect(w.find('[data-test="import-section-pending"]').exists()).toBe(false)
    expect(w.findAll('[data-row]')).toHaveLength(0)
    await w.get('[data-test="import-section-ready"]').trigger('click')
    expect(w.findAll('[data-row]').map((r) => r.attributes('data-row'))).toEqual(['t1', 't2', 't4'])
  })

  it('deslizar una tarjeta a la izquierda omite como el botón (omit + patch)', async () => {
    stubMatchMedia(true)
    vi.stubGlobal('innerWidth', 375)
    const w = mountTable({ section: 'pending' })
    const el = w.get('[data-row="t3"] [data-test="import-swipe-content"]')
    await el.trigger('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 100 })
    await el.trigger('pointermove', { pointerType: 'touch', clientX: 200, clientY: 101 })
    await el.trigger('pointermove', { pointerType: 'touch', clientX: 60, clientY: 101 })
    await el.trigger('pointerup', { pointerType: 'touch', clientX: 60, clientY: 101 })
    expect(w.emitted('omit')?.[0]?.[0]).toMatchObject({ client_id: 't3' })
    expect(w.emitted('patch')).toEqual([[{ client_id: 't3', action: 'skip' }]])
    expect(w.get('[data-row="t3"] [data-test="import-row-skip"]').attributes('aria-label')).toBe(
      'Omitir: Marta'
    )
  })
})
