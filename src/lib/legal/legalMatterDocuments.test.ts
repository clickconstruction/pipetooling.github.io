import { describe, expect, it } from 'vitest'
import { parseLegalPortalDocuments, legalDocumentKindWords, legalDocumentMime, legalDocumentProblem, legalDocumentSizeWords, legalDocumentStoragePath, legalDocumentTitleFromName, legalPortalDocumentFromRow, LEGAL_DOCUMENT_MAX_BYTES } from './legalMatterDocuments'

describe('legalMatterDocuments (v2.4810)', () => {
  it('a document needs a title, one line on what it shows, and a kind the portal takes under 10 MB', () => {
    expect(legalDocumentProblem({ title: '', shows: 'x' })).toBe('Give the document a title.')
    expect(legalDocumentProblem({ title: 'Billing report', shows: ' ' })).toBe('Say in one line what it shows.')
    expect(legalDocumentProblem({ title: 'Billing report', shows: 'The itemization.' }, { size: 100, type: 'application/pdf', name: 'report.pdf' })).toBeNull()
    expect(legalDocumentProblem({ title: 'Clip', shows: 'A video.' }, { size: 100, type: 'video/mp4', name: 'clip.mp4' })).toContain('not a kind the portal takes')
    expect(legalDocumentProblem({ title: 'Big', shows: 'Too big.' }, { size: LEGAL_DOCUMENT_MAX_BYTES + 1, type: 'application/pdf', name: 'big.pdf' })).toContain('over 10 MB')
  })

  it('reads the kind from the browser or the name, and builds a safe storage path', () => {
    expect(legalDocumentMime({ type: 'application/pdf', name: 'a.pdf' })).toBe('application/pdf')
    expect(legalDocumentMime({ type: '', name: 'thread.eml' })).toBe('message/rfc822')
    expect(legalDocumentMime({ type: 'application/octet-stream', name: 'Safari.pdf' })).toBe('application/pdf')
    expect(legalDocumentMime({ type: '', name: 'x.exe' })).toBe('')
    expect(legalDocumentStoragePath('m-1', 'd-1', 'Billing report (final) #2.pdf')).toBe('m-1/d-1-Billing report _final_ _2.pdf')
    expect(legalDocumentTitleFromName('BILLING_REPORT_LEARNING_EXP.pdf')).toBe('BILLING REPORT LEARNING EXP')
  })

  it('words the size and the kind, and shapes a row for the firm', () => {
    expect(legalDocumentSizeWords(64075)).toBe('63 KB')
    expect(legalDocumentSizeWords(1_300_000)).toBe('1.2 MB')
    expect(legalDocumentKindWords('message/rfc822')).toBe('Email')
    expect(legalPortalDocumentFromRow({ id: 'd', title: ' Billing report ', shows: 'The itemization.', mime: 'application/pdf', size_bytes: 64075, added_at: '2026-10-07T15:00:00Z' }, 'Robin Ortega', 'https://x/signed', (iso) => iso.slice(0, 10)))
      .toEqual({ id: 'd', title: 'Billing report', shows: 'The itemization.', mime: 'application/pdf', sizeBytes: 64075, addedOn: '2026-10-07', addedByName: 'Robin Ortega', url: 'https://x/signed' })
  })
})

describe('parseLegalPortalDocuments (v2.4810)', () => {
  it('reads what an older or a newer function sends, and keeps only an https link', () => {
    expect(parseLegalPortalDocuments(undefined)).toEqual([])
    const out = parseLegalPortalDocuments([{ id: 'd', title: 'T', shows: 'S', mime: 'application/pdf', sizeBytes: 10, addedOn: '2026-10-07', addedByName: 'R', url: 'javascript:alert(1)' }, { title: 'no id' }, { id: 'e', title: 'U', url: 'https://storage/x' }])
    expect(out.map((d) => [d.id, d.url])).toEqual([['d', ''], ['e', 'https://storage/x']])
  })
})
