import { describe, expect, it } from 'vitest'
import { LEGAL_DOCUMENT_FILTERS, LEGAL_DOCUMENT_GROUP_ORDER, LEGAL_DOCUMENT_MAX_BYTES, groupLegalDocumentsByWhose, legalDocumentDayWords, legalDocumentFilterCounts, legalDocumentFilterEmptyWords, legalDocumentFilterWords, legalDocumentGroupOf, legalDocumentGroupWords, legalDocumentPassesFilter, legalDocumentPayerPossessive, legalDocumentStateChipWords, legalDocumentWhoseChoices, legalDocumentWhoseGuess, legalDocumentWhoseOf, legalDocumentKindWords, legalDocumentMime, legalDocumentProblem, legalDocumentSentHowWords, legalDocumentSentProblem, legalDocumentSizeWords, legalDocumentStateOf, legalDocumentStateWords, legalDocumentStoragePath, legalDocumentTimelineDay, legalDocumentTitleFromName, legalPortalDocumentFromRow, parseLegalPortalDocuments } from './legalMatterDocuments'

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

describe('whose paper it is (punch list #214, v2.6108)', () => {
  const payer = 'Northline Builders LLC'
  const guess = (title: string, over: { shows?: string; state?: string } = {}) => legalDocumentWhoseGuess({ title, ...over }, payer, 'Click Plumbing and Electrical')

  it('reads the column, words the groups and the payer as a possessive', () => {
    expect(legalDocumentWhoseOf('theirs')).toBe('theirs')
    expect(legalDocumentWhoseOf('record')).toBeNull()
    expect(legalDocumentWhoseOf(null)).toBeNull()
    expect(legalDocumentPayerPossessive('Northline Builders')).toBe('Northline Builders’')
    expect(legalDocumentPayerPossessive('Northline')).toBe('Northline’s')
    expect(legalDocumentPayerPossessive('Burd & Assoc.')).toBe('Burd & Assoc.’s')
    expect(legalDocumentPayerPossessive('')).toBe('The payer’s')
    expect(LEGAL_DOCUMENT_GROUP_ORDER.map((k) => legalDocumentGroupWords(k, 'Northline'))).toEqual(['Northline’s', 'Ours', 'Public record', 'The supplier’s', 'Our record'])
    expect(legalDocumentWhoseChoices('Northline').map((c) => c.value)).toEqual(['theirs', 'ours', 'public', 'supplier', ''])
  })

  it('guesses the payer’s paper from their name first, as a possessive, or opening the shows line, and from a received state', () => {
    expect(guess('Northline Notice of Termination, Oct 21, 2026')).toBe('theirs')
    expect(guess('Northline’s reply to the Oct 27 letter, J. Dalton')).toBe('theirs')
    expect(guess("Northline's JobTread page for the job, as read Oct 27")).toBeNull()
    expect(guess('Unconditional waiver on progress payment, Sept 10', { shows: 'Northline’s form for the $15,750 rough-in payment.' })).toBe('theirs')
    expect(guess('Letter about the schedule', { state: 'received' })).toBe('theirs')
  })

  it('guesses ours from *to <payer>*, a sent state, our own name or a letter’s opening word', () => {
    expect(guess('Email to Northline: the response letter and the final invoice (sent Oct 27)')).toBe('ours')
    expect(guess('Final invoice to Northline, for October 27, 2026')).toBe('ours')
    expect(guess('Settlement offer to Northline, Rule 408')).toBe('ours')
    expect(guess('Final Invoice No. 742-2611261112 with the warranty letter', { state: 'sent' })).toBe('ours')
    expect(guess('Click proposal, May 8, 2026')).toBe('ours')
    expect(guess('Response to Notice of Termination and materials demand')).toBe('ours')
  })

  it('guesses the public record, the supplier’s, and our own record from captures, reports and transcripts', () => {
    expect(guess('City inspection report, Plumbing Top-Out passed Sept 17')).toBe('public')
    expect(guess('City permit 2025-196, current version')).toBe('public')
    expect(guess('Licensing law behind the Board complaint')).toBe('public')
    expect(guess('Pecan Supply invoice 52417, July 10, 2026')).toBe('supplier')
    expect(guess('Pecan Supply payment receipt, October 22, 2026')).toBe('supplier')
    expect(guess('USPS certified mail receipt, Oct 27, 2026')).toBeNull()
    expect(guess('Rough-in job cost report')).toBeNull()
    expect(guess('Affidavit of D. Alvarez, signed and notarized Oct 22')).toBeNull()
    expect(guess('Texts with the superintendent, Aug 10 and Aug 27')).toBeNull()
    expect(guess('Northline’s JobTread schedule, captured Oct 27')).toBeNull()
    expect(guess('Subcontract agreement, PandaDoc copy, May 28')).toBeNull()
    expect(guess('Case summary for counsel, revised October 23')).toBeNull()
  })

  it('skips *The* and *LLC* when it reads the payer’s name, and guesses nothing with no name', () => {
    expect(legalDocumentWhoseGuess({ title: 'The Quarry notice of backcharge' }, 'The Quarry at Oak Hill LLC')).toBe('theirs')
    expect(legalDocumentWhoseGuess({ title: 'The schedule as we read it' }, 'The Quarry at Oak Hill LLC')).toBeNull()
    expect(legalDocumentWhoseGuess({ title: 'Reply to our letter' }, '')).toBeNull()
    expect(legalDocumentWhoseGuess({ title: 'Letter about the schedule' }, '')).toBe('ours')
  })

  it('a row’s own whose wins over the guess; the groups read in order, newest paper first, an empty group left out', () => {
    expect(legalDocumentGroupOf({ whose: 'supplier', title: 'Northline Notice of Termination' }, payer)).toEqual({ key: 'supplier', guessed: false })
    expect(legalDocumentGroupOf({ whose: null, title: 'Northline Notice of Termination' }, payer)).toEqual({ key: 'theirs', guessed: true })
    expect(legalDocumentGroupOf({ whose: null, title: 'Rough-in job cost report' }, payer)).toEqual({ key: 'record', guessed: false })
    const rows = [
      { id: 'a', whose: null, title: 'Rough-in job cost report', day: '2026-10-21' },
      { id: 'b', whose: null, title: 'Northline Notice of Termination', day: '2026-10-21' },
      { id: 'c', whose: null, title: 'Northline’s reply', day: '2026-10-28' },
      { id: 'd', whose: 'ours', title: 'Settlement offer to Northline', day: '2026-10-27' },
      { id: 'e', whose: null, title: 'Pecan Supply invoice 52417', day: '2026-07-10' },
    ]
    const groups = groupLegalDocumentsByWhose(rows, payer, (r) => r.day)
    expect(groups.map((g) => [g.key, g.words, g.rows.map((r) => r.id)])).toEqual([
      ['theirs', 'Northline Builders LLC’s', ['c', 'b']],
      ['ours', 'Ours', ['d']],
      ['supplier', 'The supplier’s', ['e']],
      ['record', 'Our record', ['a']],
    ])
  })

  it('words the state as a chip, and the filters count and pass the rows', () => {
    expect(legalDocumentStateChipWords({ state: 'sent', sentHow: 'certified_mail' })).toBe('sent · certified mail')
    expect(legalDocumentStateChipWords({ state: 'sent', sentHow: 'other' })).toBe('sent')
    expect(legalDocumentStateChipWords({ state: 'received', sentHow: '' })).toBe('received')
    expect(legalDocumentStateChipWords({ state: 'final', sentHow: '' })).toBe('final')
    const rows = [
      { state: 'sent', held: false, addedOn: '2026-10-27' },
      { state: 'received', held: false, addedOn: '2026-10-29' },
      { state: 'final', held: true, addedOn: '2026-10-22' },
      { state: 'draft', held: false, addedOn: '2026-10-22' },
    ]
    expect(legalDocumentFilterCounts(rows, '2026-10-25')).toEqual({ all: 4, sent: 1, received: 1, draft: 1, held: 1, week: 2 })
    expect(legalDocumentPassesFilter(rows[2]!, 'held', '2026-10-25')).toBe(true)
    expect(legalDocumentPassesFilter(rows[2]!, 'week', '')).toBe(false)
    expect(LEGAL_DOCUMENT_FILTERS.map(legalDocumentFilterWords)).toEqual(['All', 'Sent', 'Received', 'Drafts', 'Held', 'Added this week'])
    expect(legalDocumentFilterEmptyWords('week')).toBe('Nothing added this week.')
  })
})
