import { describe, expect, it } from 'vitest'
import { LEGAL_DOCUMENT_MAX_BYTES, legalDocumentDayWords, legalDocumentKindWords, legalDocumentMime, legalDocumentProblem, legalDocumentSentHowWords, legalDocumentSentProblem, legalDocumentSizeWords, legalDocumentStateOf, legalDocumentStateWords, legalDocumentStoragePath, legalDocumentTimelineDay, legalDocumentTitleFromName, legalPortalDocumentFromRow, parseLegalPortalDocuments } from './legalMatterDocuments'

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
      .toEqual({ id: 'd', title: 'Billing report', shows: 'The itemization.', mime: 'application/pdf', sizeBytes: 64075, addedOn: '2026-10-07', addedByName: 'Robin Ortega', url: 'https://x/signed', datedOn: '', state: 'final', sentOn: '', sentHow: '', sentTo: '', proofDocumentId: '', receivedOn: '' })
  })
})

describe('parseLegalPortalDocuments (v2.4810)', () => {
  it('reads what an older or a newer function sends, and keeps only an https link', () => {
    expect(parseLegalPortalDocuments(undefined)).toEqual([])
    const out = parseLegalPortalDocuments([{ id: 'd', title: 'T', shows: 'S', mime: 'application/pdf', sizeBytes: 10, addedOn: '2026-10-07', addedByName: 'R', url: 'javascript:alert(1)' }, { title: 'no id' }, { id: 'e', title: 'U', url: 'https://storage/x' }])
    expect(out.map((d) => [d.id, d.url])).toEqual([['d', ''], ['e', 'https://storage/x']])
  })
})

describe('the paper’s own day, and draft · final · sent · received (punch list #168, v2.5846)', () => {
  const day = (y: string) => y.slice(5)
  it('reads the new columns off a row, and reads an older row as a final paper with no day of its own', () => {
    const row = legalPortalDocumentFromRow({ id: 'd', title: 'Response letter', shows: 'Our answer.', mime: 'application/pdf', size_bytes: 10, added_at: '2026-10-24T15:00:00Z', dated_on: '2026-10-27', state: 'sent', sent_on: '2026-10-27', sent_how: 'certified_mail', sent_to: 'Burd & Assoc.', proof_document_id: 'r1', received_on: null }, 'Grace', '', (iso) => iso.slice(0, 10))
    expect(row).toEqual(expect.objectContaining({ datedOn: '2026-10-27', state: 'sent', sentOn: '2026-10-27', sentHow: 'certified_mail', sentTo: 'Burd & Assoc.', proofDocumentId: 'r1', receivedOn: '' }))
    const old = legalPortalDocumentFromRow({ id: 'o', title: 'Old', shows: 'x', added_at: '2026-10-07T15:00:00Z' }, '', '', (iso) => iso.slice(0, 10))
    expect(old).toEqual(expect.objectContaining({ datedOn: '', state: 'final', sentOn: '', proofDocumentId: '' }))
    expect(legalDocumentStateOf('bogus')).toBe('final')
  })
  it('words the state and the day', () => {
    const sent = { state: 'sent' as const, sentOn: '2026-10-27', sentHow: 'certified_mail', sentTo: 'Burd & Assoc.', receivedOn: '' }
    expect(legalDocumentStateWords(sent, day)).toBe('Sent 10-27 by certified mail to Burd & Assoc.')
    expect(legalDocumentStateWords({ ...sent, sentHow: 'other', sentTo: '' }, day)).toBe('Sent 10-27')
    expect(legalDocumentStateWords({ state: 'draft', sentOn: '', sentHow: '', sentTo: '', receivedOn: '' })).toBe('Draft')
    expect(legalDocumentStateWords({ state: 'received', sentOn: '', sentHow: '', sentTo: '', receivedOn: '2026-10-22' }, day)).toBe('Received 10-22')
    expect(legalDocumentStateWords({ state: 'final', sentOn: '', sentHow: '', sentTo: '', receivedOn: '' })).toBe('')
    expect(legalDocumentDayWords({ datedOn: '2026-05-12', addedOn: '2026-10-24' }, day)).toBe('dated 05-12 · added 10-24')
    expect(legalDocumentDayWords({ datedOn: '2026-10-24', addedOn: '2026-10-24' }, day)).toBe('added 10-24')
    expect(legalDocumentDayWords({ datedOn: '', addedOn: '2026-10-24' }, day)).toBe('added 10-24')
    expect(legalDocumentTimelineDay({ datedOn: '2026-05-12', addedOn: '2026-10-24' })).toBe('2026-05-12')
    expect(legalDocumentTimelineDay({ datedOn: '', addedOn: '2026-10-24' })).toBe('2026-10-24')
    expect(legalDocumentSentHowWords('hand')).toBe('by hand')
  })
  it('refuses a send record with no day, a day ahead, no way or no one, and a draft with a bad day', () => {
    const ok = { sentOn: '2026-10-27', sentHow: 'email' as const, sentTo: 'Burd', proofDocumentId: '' }
    expect(legalDocumentSentProblem(ok, '2026-10-28')).toBeNull()
    expect(legalDocumentSentProblem({ ...ok, sentOn: '' }, '2026-10-28')).toBe('Pick the day it went out.')
    expect(legalDocumentSentProblem({ ...ok, sentOn: '2026-10-29' }, '2026-10-28')).toMatch(/ahead of today/)
    expect(legalDocumentSentProblem({ ...ok, sentHow: '' }, '2026-10-28')).toBe('Say how it went out.')
    expect(legalDocumentSentProblem({ ...ok, sentTo: ' ' }, '2026-10-28')).toBe('Say who it went to.')
    expect(legalDocumentProblem({ title: 'T', shows: 'S', datedOn: 'May' })).toBe('Pick the day the paper is from.')
    expect(legalDocumentProblem({ title: 'T', shows: 'S', datedOn: '2026-05-12', state: 'received', receivedOn: 'x' })).toBe('Pick the day it was received.')
    expect(legalDocumentProblem({ title: 'T', shows: 'S', datedOn: '2026-05-12', state: 'draft' })).toBeNull()
  })
  it('parses the new keys off the payload and defaults an older payload', () => {
    const [d] = parseLegalPortalDocuments([{ id: 'd', title: 'T', shows: 'S', datedOn: '2026-05-12', state: 'draft', sentOn: '', sentHow: '', sentTo: '', proofDocumentId: '', receivedOn: '' }])
    expect(d).toEqual(expect.objectContaining({ datedOn: '2026-05-12', state: 'draft' }))
    const [o] = parseLegalPortalDocuments([{ id: 'o', title: 'T' }])
    expect(o).toEqual(expect.objectContaining({ datedOn: '', state: 'final', sentOn: '', receivedOn: '' }))
  })
})
