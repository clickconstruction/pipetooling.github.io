/**
 * A sub's company's own papers on People (punch list #403, step 6, PR 2): which copy is the company's line, what the
 * line says, which papers are offered or held, the two windows' checks, and the email's words. Every name is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import {
  COMPANY_PAPER_WORDS,
  companyEntryRefusal,
  companyPaperChoices,
  companyPaperDetail,
  companyPaperEmail,
  companyPaperLines,
  companyPaperSendKey,
  companyPaperStateWords,
  companySendRefusal,
  defaultSigner,
  shortDay,
  workerEmail,
  type CompanyPaperRow,
} from './subCompanyPapers'

const paper = (over: Partial<CompanyPaperRow>): CompanyPaperRow => ({
  id: 'd1',
  company_id: 'c-mech',
  document_name: 'Subcontractor agreement',
  status: 'unsent',
  signed_at: null,
  sent_at: null,
  signer_last_viewed_at: null,
  lineage_version: 1,
  form_template_id: null,
  signer_name: null,
  signer_title: null,
  ...over,
})

describe('the company’s paper lines', () => {
  it('keeps the newest copy of each paper for this company, by name', () => {
    const rows = [
      paper({ id: 'old', lineage_version: 1, status: 'signed' }),
      paper({ id: 'new', lineage_version: 2, status: 'sent' }),
      paper({ id: 'w9', document_name: 'W-9', form_template_id: 'f1' }),
      paper({ id: 'other', company_id: 'c-pipe' }),
    ]
    expect(companyPaperLines(rows, 'c-mech').map((p) => p.id)).toEqual(['new', 'w9'])
  })

  it('at the same version the further state wins', () => {
    expect(companyPaperLines([paper({ id: 'a', status: 'sent' }), paper({ id: 'b', status: 'signed' })], 'c-mech').map((p) => p.id)).toEqual(['b'])
  })

  it('says a signed paper’s version, day and signer, its values marked', () => {
    const line = companyPaperDetail(paper({ lineage_version: 2, status: 'signed', signed_at: '2026-11-14', signer_name: 'Pat Sample', signer_title: 'Owner' }))
    expect(plainSentence(line)).toBe('Version 2 · signed Nov 14 by Pat Sample, Owner')
    expect(line).not.toBe(plainSentence(line))
  })

  it('says a form, a sent paper and whether it was opened, and a paper not sent', () => {
    expect(plainSentence(companyPaperDetail(paper({ form_template_id: 'f1', status: 'sent', sent_at: '2026-11-18T15:00:00Z' })))).toBe('Form · sent Nov 18 · not opened')
    expect(plainSentence(companyPaperDetail(paper({ status: 'sent', sent_at: '2026-11-18T15:00:00Z', signer_last_viewed_at: '2026-11-19T15:00:00Z', signer_name: 'Pat Sample' })))).toBe(
      'sent Nov 18 · opened · with Pat Sample',
    )
    expect(companyPaperDetail(paper({}))).toBe('not sent')
    expect(companyPaperStateWords('signed')).toBe('Signed')
    expect(companyPaperStateWords('sent')).toBe('Sent')
    expect(companyPaperStateWords('unsent')).toBe('Not sent')
  })

  it('reads a day and a moment in the app’s day', () => {
    expect(shortDay('2026-10-30')).toBe('Oct 30')
    // 03:00 on Nov 19 in UTC is still Nov 18 in the office's day.
    expect(shortDay('2026-11-19T03:00:00Z')).toBe('Nov 18')
    expect(shortDay('')).toBe('')
    expect(shortDay('soon')).toBe('')
  })
})

describe('what the windows offer', () => {
  const entries = [
    { id: 'e-agr', document_name: 'Subcontractor agreement', audience: 'sub', form_template_id: null },
    { id: 'e-w9', document_name: 'W-9', audience: 'sub', form_template_id: 'f1' },
    { id: 'e-agr-2', document_name: 'Subcontractor agreement', audience: 'sub', form_template_id: null },
    { id: 'e-hand', document_name: 'Employee handbook', audience: 'staff', form_template_id: null },
  ]

  it('offers the subs’ papers once each, and holds one the company has signed with its reason', () => {
    expect(companyPaperChoices(entries, [paper({ status: 'signed' })])).toEqual([
      { id: 'e-agr', name: 'Subcontractor agreement', held: 'That paper is signed already.' },
      { id: 'e-w9', name: 'W-9', held: null },
    ])
  })

  it('opens on the worker with a title, else the first', () => {
    const lee = { personId: 'p-lee', name: 'Lee Sample', title: '' }
    const pat = { personId: 'p-pat', name: 'Pat Sample', title: 'Owner' }
    expect(defaultSigner([lee, pat])).toEqual(pat)
    expect(defaultSigner([lee])).toEqual(lee)
    expect(defaultSigner([])).toBeNull()
  })

  it('reads a worker’s roster address by name', () => {
    expect(workerEmail(' Pat Sample ', [{ name: 'Pat Sample', email: ' pat@example.test ' }])).toBe('pat@example.test')
    expect(workerEmail('Lee Sample', [{ name: 'Pat Sample', email: 'pat@example.test' }])).toBe('')
  })
})

describe('the checks', () => {
  const ready = { id: 'e-w9', name: 'W-9', held: null }
  it('a send asks for a paper that is not held, who signs, and an address', () => {
    expect(companySendRefusal({ choice: null, signer: 'Pat', email: 'pat@example.test' })).toBe(COMPANY_PAPER_WORDS.pickPaper)
    expect(companySendRefusal({ choice: { ...ready, held: 'That paper is signed already.' }, signer: 'Pat', email: 'pat@example.test' })).toBe('That paper is signed already.')
    expect(companySendRefusal({ choice: ready, signer: ' ', email: 'pat@example.test' })).toBe(COMPANY_PAPER_WORDS.pickSigner)
    expect(companySendRefusal({ choice: ready, signer: 'Pat', email: '' })).toBe('Enter a valid signer email.')
    expect(companySendRefusal({ choice: ready, signer: 'Pat', email: 'pat@example.test' })).toBeNull()
  })

  it('an entry asks for who signed and a day that is not after today', () => {
    const base = { choice: ready, signer: 'Pat', signedOn: '2026-11-20', today: '2026-11-23' }
    expect(companyEntryRefusal(base)).toBeNull()
    expect(companyEntryRefusal({ ...base, signer: '' })).toBe(COMPANY_PAPER_WORDS.signerName)
    expect(companyEntryRefusal({ ...base, signedOn: '' })).toBe(COMPANY_PAPER_WORDS.pickDay)
    expect(companyEntryRefusal({ ...base, signedOn: '2026-11-24' })).toBe(COMPANY_PAPER_WORDS.futureDay)
  })
})

describe('the email', () => {
  it('names the paper, the signer and the company, with a press to sign', () => {
    expect(companyPaperEmail({ paper: ' W-9 ', company: 'ZZ Sample Mechanical LLC', signer: 'Pat Sample' })).toEqual({
      subject: 'Please sign: W-9',
      lines: ['Pat Sample, please sign the W-9 for ZZ Sample Mechanical LLC.', 'Press the button to read it and sign. The link works for 14 days.'],
      actionLabel: 'Read and sign',
    })
  })

  it('keys each press on its own', () => {
    expect(companyPaperSendKey('d1', 5)).toBe('people-company-paper:d1:5')
    expect(companyPaperSendKey('d1', 5)).not.toBe(companyPaperSendKey('d1', 6))
  })
})
