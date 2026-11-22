import { describe, expect, it } from 'vitest'
import { ApiError } from '@/utils/apiClient'
import { importJob, teamRow } from '@/test/importJobs'
import {
  apiErrorRows,
  canConfirm,
  detectedTeam,
  linkedContactUuid,
  matchCandidates,
  needsResolver,
  restoreAction,
  rowDisplayName,
  confidenceTone,
  deferredSources,
  errorKey,
  importErrorKey,
  importFileKind,
  pageRanges,
  phaseLabelKey,
  rowStatusKey,
  sortRows,
  validateImportFiles,
} from './importReview'

const MB = 1024 * 1024
const file = (name: string, size = 1000, type = '') => ({ name, size, type })

describe('confidenceTone', () => {
  it.each([
    [1, 'high'],
    [0.9, 'high'],
    [0.89, 'medium'],
    [0.7, 'medium'],
    [0.69, 'low'],
    [0, 'low'],
  ] as const)('%s → %s', (c, tone) => {
    expect(confidenceTone(c)).toBe(tone)
  })
})

describe('phaseLabelKey', () => {
  it('una clave por fase y las terminales caen en la última', () => {
    expect(phaseLabelKey('uploaded')).toBe('importer.progress.uploaded')
    expect(phaseLabelKey('extracting')).toBe('importer.progress.extracting')
    expect(phaseLabelKey('confirming')).toBe('importer.progress.confirming')
    expect(phaseLabelKey('ready')).toBe('importer.progress.normalizing')
  })
})

describe('sortRows', () => {
  it('primero needs_action, luego rojas y después el orden de origen', () => {
    const rows = [
      teamRow({ client_id: 'a' }),
      teamRow({ client_id: 'b', confidence: 0.5 }),
      teamRow({ client_id: 'c' }),
      teamRow({ client_id: 'd', needs_action: true, confidence: 0.5 }),
      teamRow({ client_id: 'e', confidence: 0.4, action: 'skip' }),
      teamRow({ client_id: 'f', needs_action: true }),
    ]
    expect(sortRows(rows).map((r) => r.client_id)).toEqual(['d', 'f', 'b', 'a', 'c', 'e'])
    // No muta la entrada.
    expect(rows[0].client_id).toBe('a')
  })
})

describe('rowStatusKey', () => {
  const m = (status: 'new' | 'existing' | 'existing_adds_info' | 'already_in_tour' | 'name_suggestion') => ({
    ...teamRow().match,
    status,
  })
  it.each([
    [teamRow(), 'new'],
    [teamRow({ match: m('existing'), action: 'link' }), 'existing'],
    [teamRow({ match: m('existing_adds_info'), action: 'link' }), 'adds_info'],
    [teamRow({ match: m('already_in_tour'), action: 'link' }), 'already_in_tour'],
    [teamRow({ match: m('name_suggestion') }), 'name_suggestion'],
    [teamRow({ match: m('name_suggestion'), reviewed: true }), 'new'],
    [teamRow({ match: m('existing'), action: 'skip' }), 'skipped'],
  ])('%#', (row, key) => {
    expect(rowStatusKey(row)).toBe(`importer.status.${key}`)
  })
})

describe('canConfirm', () => {
  it('solo en ready, sin filas por resolver y con alguna fila no omitida', () => {
    expect(canConfirm(importJob())).toBe(true)
    expect(canConfirm(importJob({ status: 'extracting' }))).toBe(false)
    expect(canConfirm(importJob({ status: 'done' }))).toBe(false)
    expect(canConfirm(null)).toBe(false)
    const pending = importJob({
      draft: { team: [teamRow({ needs_action: true }), teamRow({ client_id: 't2' })] },
    })
    expect(canConfirm(pending)).toBe(false)
    const allSkipped = importJob({ draft: { team: [teamRow({ action: 'skip' })] } })
    expect(canConfirm(allSkipped)).toBe(false)
  })
})

describe('deferredSources', () => {
  it('fuentes diferidas enteras y tramos de páginas de un PDF', () => {
    const job = importJob({
      detected: {
        sources: [
          {
            ref: 'd1:Crew',
            document_uuid: 'D1',
            filename: 'Crew.xlsx',
            kind: 'spreadsheet',
            sheet: 'Crew',
            doc_kind: 'team',
            processed: true,
            deferred: false,
            deferred_reason: null,
            rows_scanned: 10,
            truncated: false,
            people_found: 8,
          },
          {
            ref: 'd2',
            document_uuid: 'D2',
            filename: 'gira.ics',
            kind: 'ics',
            sheet: null,
            doc_kind: 'calendar',
            processed: false,
            deferred: true,
            deferred_reason: 'calendar_coming_soon',
            rows_scanned: 0,
            truncated: false,
            people_found: 0,
          },
          {
            ref: 'd3',
            document_uuid: 'D3',
            filename: 'Dossier_MAD.pdf',
            kind: 'pdf_text',
            sheet: null,
            doc_kind: 'mixed',
            processed: true,
            deferred: false,
            deferred_reason: null,
            pages: { total: 8, text: [1, 2, 3, 4, 5, 6, 7, 8], scanned: [], team: [1, 2] },
            deferred_pages: [{ pages: [3, 4, 5, 6, 7, 8], reason: 'itinerary_coming_soon' }],
            rows_scanned: 96,
            truncated: false,
            people_found: 14,
          },
        ],
      },
    })
    expect(deferredSources(job)).toEqual([
      { filename: 'gira.ics', reason: 'calendar_coming_soon', pages: null },
      { filename: 'Dossier_MAD.pdf', reason: 'itinerary_coming_soon', pages: [3, 4, 5, 6, 7, 8] },
    ])
    expect(deferredSources(importJob({ detected: {} }))).toEqual([])
  })
})

describe('deferredSources con una fuente diferida entera que trae tramos', () => {
  it('pinta solo los tramos de páginas, sin la línea de la fuente entera', () => {
    const job = importJob({
      detected: {
        sources: [
          {
            ref: 'd1:scan',
            document_uuid: 'D1',
            filename: 'Escaneado.pdf',
            kind: 'pdf_scan',
            sheet: null,
            doc_kind: 'team',
            processed: false,
            deferred: true,
            deferred_reason: 'unmasked_disabled',
            pages: { total: 3, text: [], scanned: [1, 2, 3], team: [] },
            deferred_pages: [{ pages: [1, 2, 3], reason: 'unmasked_disabled' }],
            rows_scanned: 0,
            truncated: false,
            people_found: 0,
          },
          {
            ref: 'd2',
            document_uuid: 'D2',
            filename: 'Cifrado.pdf',
            kind: 'pdf_text',
            sheet: null,
            doc_kind: 'unknown',
            processed: false,
            deferred: true,
            deferred_reason: 'pdf_encrypted',
            deferred_pages: [],
            rows_scanned: 0,
            truncated: false,
            people_found: 0,
          },
        ],
      },
    })
    expect(deferredSources(job)).toEqual([
      { filename: 'Escaneado.pdf', reason: 'unmasked_disabled', pages: [1, 2, 3] },
      { filename: 'Cifrado.pdf', reason: 'pdf_encrypted', pages: null },
    ])
  })
})

describe('pageRanges', () => {
  it.each([
    [[3, 4, 5, 7], '3-5, 7'],
    [[1], '1'],
    [[8, 3, 4, 4], '3-4, 8'],
    [[], ''],
  ])('%j → %s', (pages, out) => {
    expect(pageRanges(pages)).toBe(out)
  })
})

describe('errorKey / importErrorKey', () => {
  it('traduce los códigos conocidos y nunca devuelve el código crudo', () => {
    expect(errorKey('ai_unavailable')).toBe('importer.errors.ai_unavailable')
    expect(errorKey('expired')).toBe('importer.errors.expired')
    expect(errorKey('invalid_document_format')).toBe('importer.errors.invalidFile')
    expect(errorKey('codigo_nuevo')).toBe('importer.errors.generic')
    expect(errorKey('')).toBe('importer.errors.generic')
  })

  it('lee details.code del envoltorio y cae al estado', () => {
    const wrapped = (code: string, status: number) =>
      new ApiError(status, {
        success: false,
        error: { message: 'x', status_code: status, details: { code: [code] } },
      })
    expect(importErrorKey(wrapped('too_many_active_imports', 429))).toBe(
      'importer.errors.too_many_active_imports'
    )
    expect(importErrorKey(wrapped('empty_import', 400))).toBe('importer.errors.empty_import')
    expect(importErrorKey(new ApiError(429, { detail: 'Throttled' }))).toBe('importer.errors.throttled')
    expect(importErrorKey(new ApiError(404, null))).toBe('importer.errors.notFound')
    expect(importErrorKey(new ApiError(403, null))).toBe('importer.errors.forbidden')
    expect(importErrorKey(new ApiError(0, null))).toBe('importer.errors.network')
    expect(importErrorKey(new Error('boom'))).toBe('importer.errors.generic')
  })
})

describe('validateImportFiles', () => {
  it('tipos por extensión (y cualquier imagen por MIME)', () => {
    expect(importFileKind(file('a.PDF'))).toBe('pdf')
    expect(importFileKind(file('a.xls'))).toBe('excel')
    expect(importFileKind(file('a.ics'))).toBe('ics')
    expect(importFileKind(file('IMG_1.HEIC'))).toBe('image')
    expect(importFileKind(file('foto', 1, 'image/jpeg'))).toBe('image')
    expect(importFileKind(file('a.docx'))).toBeNull()
  })

  it('tamaño por tipo, máximo de archivos y total', () => {
    expect(validateImportFiles([file('a.pdf', 15 * MB)])).toBeNull()
    expect(validateImportFiles([file('a.pdf', 15 * MB + 1)])).toEqual({
      code: 'fileTooLarge',
      file: 'a.pdf',
      mb: 15,
    })
    expect(validateImportFiles([file('a.csv', 10 * MB + 1)])).toMatchObject({ mb: 10 })
    expect(validateImportFiles([file('a.ics', 5 * MB + 1)])).toMatchObject({ mb: 5 })
    expect(validateImportFiles([file('a.jpg', 5 * MB + 1)])).toMatchObject({ mb: 5 })
    expect(validateImportFiles([file('a.xlsx', 20 * MB)])).toBeNull()
    expect(validateImportFiles([file('a.exe')])).toEqual({ code: 'fileType', file: 'a.exe' })
    expect(validateImportFiles(Array.from({ length: 7 }, (_, i) => file(`${i}.csv`)))).toEqual({
      code: 'tooManyFiles',
    })
    expect(validateImportFiles([file('a.xlsx', 15 * MB), file('b.pdf', 6 * MB)])).toEqual({
      code: 'too_large',
    })
  })
})

describe('resolutor y filas', () => {
  const cand = (u: string) => ({ contact_uuid: u, contact_name: `N${u}`, contact_phone: null })

  it('matchCandidates: name_suggestion usa los candidatos o el contacto sugerido', () => {
    const withCands = teamRow({
      match: { status: 'name_suggestion', by: null, contact_uuid: 'C1', contact_name: 'Uno', contact_phone: null, candidates: [cand('C2'), cand('C3')] },
    })
    expect(matchCandidates(withCands).map((c) => c.contact_uuid)).toEqual(['C2', 'C3'])
    const single = teamRow({
      match: { status: 'name_suggestion', by: null, contact_uuid: 'C1', contact_name: 'Uno', contact_phone: '+34600', candidates: [] },
    })
    expect(matchCandidates(single)).toEqual([{ contact_uuid: 'C1', contact_name: 'Uno', contact_phone: '+34600' }])
    expect(needsResolver(single)).toBe(true)
    expect(needsResolver({ ...single, action: 'skip' })).toBe(false)
  })

  it('matchCandidates: multiple_matches incluye el elegido y sin duplicados', () => {
    const r = teamRow({
      action: 'link',
      issues: ['multiple_matches'],
      match: { status: 'existing', by: 'phone', contact_uuid: 'C1', contact_name: 'Uno', contact_phone: null, candidates: [cand('C1'), cand('C2')] },
    })
    expect(matchCandidates(r).map((c) => c.contact_uuid)).toEqual(['C1', 'C2'])
    expect(linkedContactUuid(r)).toBe('C1')
    expect(linkedContactUuid({ ...r, link_contact_uuid: 'C2' })).toBe('C2')
    expect(matchCandidates(teamRow())).toEqual([])
  })

  it('restoreAction y rowDisplayName', () => {
    expect(restoreAction(teamRow())).toBe('create')
    expect(
      restoreAction(teamRow({ match: { status: 'existing', by: 'phone', contact_uuid: 'C1', contact_name: null, contact_phone: null, candidates: [] } }))
    ).toBe('link')
    expect(rowDisplayName(teamRow({ display_name: '', first_name: '', last_name: '', company: 'Autocares' }))).toBe('Autocares')
  })

  it('detectedTeam agrupa por documento y omite diferidas', () => {
    const src = (o: Record<string, unknown>) => ({
      ref: 'd1', document_uuid: 'D1', filename: 'a.pdf', kind: 'pdf_text' as const, sheet: null, doc_kind: 'team' as const,
      processed: true, deferred: false, deferred_reason: null, rows_scanned: 1, truncated: false, people_found: 2, ...o,
    })
    const job = importJob({
      detected: {
        sources: [
          src({}),
          src({ ref: 'd1s', kind: 'pdf_scan', people_found: 3 }),
          src({ ref: 'd2', document_uuid: 'D2', filename: 'cal.ics', deferred: true, processed: false, people_found: 0 }),
        ],
      },
    })
    expect(detectedTeam(job)).toEqual([{ key: 'D1', filename: 'a.pdf', people: 5 }])
  })

  it('apiErrorRows lee details.rows envuelto', () => {
    const e = new ApiError(400, {
      success: false,
      error: { message: 'x', status_code: 400, details: { code: ['unresolved_rows'], rows: ['t1', 't3'] } },
    })
    expect(apiErrorRows(e)).toEqual(['t1', 't3'])
    expect(apiErrorRows(new Error('x'))).toEqual([])
    expect(errorKey('invalid_value')).toBe('importer.errors.invalid_value')
  })
})
