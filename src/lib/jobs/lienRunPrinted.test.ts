import { describe, expect, it } from 'vitest'
import type { LienAffidavitFields } from '../jobsDocuments/lienAffidavitFieldsType'
import type { LienNoticeFields } from '../jobsDocuments/lienNoticeFieldsType'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import { lienAffidavitPrintFields, lienNoticePrintFields, lienPrintKey, type LienPrintFact, type LienPrintFields, type LienPrintPaperKind } from './lienPrintSworn'
import { LIEN_RUN_PRINTED_NONE, LIEN_RUN_PRINTED_WORDS, lienNoticeNowFields, lienRunChanges, lienRunPrinted, lienRunPrintedByWords, lienRunPrintedSameWords, lienRunPrintedUnreadWords, type LienRunPrintedLine } from './lienRunPrinted'

const NOTICE: LienNoticeFields = {
  noticeDate: '2026-11-10',
  projectDescription: 'ZZ Sample Shop, 12 Sample Rd',
  claimantName: 'ZZ Plumbing',
  laborMaterialsType: 'Plumbing labor and materials',
  originalContractorName: 'ZZ Builders',
  contractedWithIfDifferent: '',
  claimAmount: '18400.00',
  claimSplit: 'September 2026 $8,400.00 · October 2026 $10,000.00',
  contactPerson: 'ZZ Office',
  claimantAddress: '1 Shop Way',
}

const AFFIDAVIT: LienAffidavitFields = {
  county: 'Bexar',
  claimantPersonName: 'ZZ Signer',
  claimantCompany: 'ZZ Plumbing',
  claimantAddress: '1 Shop Way',
  legalDescription: 'Lot 1, Block 2, ZZ Sample Addition',
  propertyAddress: '12 Sample Rd',
  contractedWithName: 'ZZ Builders',
  workDescription: 'Plumbing labor and materials',
  workStart: '2026-07-01',
  workEnd: '2026-08-28',
  ownerName: 'ZZ Owner LLC',
  ownerAddress: '9 Owner St',
  originalContractorName: 'ZZ Builders',
  originalContractorAddress: '3 Builder Ave',
  contractAmount: '40000.00',
  paidAmount: '39390.00',
  unpaidAmount: '610.00',
  includeNoticesSworn: true,
  form: 'short',
  isSub: true,
}

const line = (kind: LienPrintPaperKind, jobId: string, printed = false): LienRunPrintedLine => ({ kind, jobId, label: jobId.toUpperCase(), title: 'ZZ Sample Shop', printed })
const fact = (kind: LienPrintPaperKind, jobId: string, fields: LienPrintFields | null, jobIds = [jobId]): [string, LienPrintFact] => [lienPrintKey(kind, jobId), { kind, copyId: `c-${jobId}`, printedAt: '2026-11-25T16:02:00Z', printedBy: 'ZZ Rosa', fields, jobIds, itemIds: [] }]

describe('a notice as it would print today', () => {
  it('is the stored paper with the money the desk would draw now over it', () => {
    expect(lienNoticeNowFields({ fields: NOTICE })).toEqual(lienNoticePrintFields(NOTICE))
    const now = lienNoticeNowFields({ fields: NOTICE, moneyNow: { claimAmount: '6150.00', claimSplit: '', retainageIncluded: '615.00' } })
    expect(now).toMatchObject({ claimAmount: '6150.00', claimSplit: '', retainageIncluded: '615.00', originalContractorName: 'ZZ Builders' })
    // A § 53.057 form gives the claim alone: the rest stays as the paper has it.
    expect(lienNoticeNowFields({ fields: NOTICE, moneyNow: { claimAmount: '6150.00' } })).toMatchObject({ claimAmount: '6150.00', claimSplit: NOTICE.claimSplit })
  })
})

describe('lienRunPrinted', () => {
  it('says nothing while the prints are not read: never "nothing printed"', () => {
    expect(lienRunPrinted({ lines: [line('affidavit', 'j1')], notices: [], affidavits: [{ jobId: 'j1', fields: AFFIDAVIT }], prints: null })).toBe(LIEN_RUN_PRINTED_NONE)
  })

  it('an affidavit whose newest print says the same today is printed, and the run does not print it again', () => {
    const out = lienRunPrinted({ lines: [line('affidavit', 'j1'), line('affidavit', 'j2')], notices: [], affidavits: [{ jobId: 'j1', fields: AFFIDAVIT }, { jobId: 'j2', fields: AFFIDAVIT }], prints: new Map([fact('affidavit', 'j1', lienAffidavitPrintFields(AFFIDAVIT))]) })
    expect([...out.printedSame]).toEqual(['j1'])
    expect(out.changed).toEqual([])
    expect(out.unread).toBe(0)
  })

  it('the mock-up’s case: a payment came in after the print, and the affidavit says another amount today', () => {
    // Printed saying $610 unpaid. A $300 payment came in, and today's paper says $310.
    const today = { ...AFFIDAVIT, paidAmount: '39690.00', unpaidAmount: '310.00' }
    const out = lienRunPrinted({ lines: [line('affidavit', 'j1')], notices: [], affidavits: [{ jobId: 'j1', fields: today }], prints: new Map([fact('affidavit', 'j1', lienAffidavitPrintFields(AFFIDAVIT))]) })
    expect(out.printedSame.size).toBe(0)
    expect(out.changed).toHaveLength(1)
    expect(out.changed[0]).toMatchObject({ key: 'affidavit:j1', kind: 'affidavit', label: 'J1', printedAt: '2026-11-25T16:02:00Z', printedBy: 'ZZ Rosa', standIn: false })
    expect(out.changed[0]!.changes.map((c) => plainSentence(c.words))).toEqual(['The amount paid: printed $39,390.00, now $39,690.00.', 'The amount unpaid: printed $610.00, now $310.00.'])
  })

  it('an affidavit printed before a print kept its values counts as to print, and is counted', () => {
    const out = lienRunPrinted({ lines: [line('affidavit', 'j1')], notices: [], affidavits: [{ jobId: 'j1', fields: AFFIDAVIT }], prints: new Map([fact('affidavit', 'j1', null)]) })
    expect(out).toMatchObject({ changed: [], unread: 1 })
    expect(out.printedSame.size).toBe(0)
  })

  it('an affidavit never printed, or with no paper on the desk, is passed over', () => {
    const out = lienRunPrinted({ lines: [line('affidavit', 'j1'), line('affidavit', 'j2')], notices: [], affidavits: [{ jobId: 'j1', fields: AFFIDAVIT }], prints: new Map([fact('affidavit', 'j2', lienAffidavitPrintFields(AFFIDAVIT))]) })
    expect(out).toMatchObject({ changed: [], unread: 0 })
    expect(out.printedSame.size).toBe(0)
  })

  it('a printed notice whose bills moved reads as changed though nobody redrew it', () => {
    const notices = [{ jobId: 'j1', fields: NOTICE, printedAt: '2026-11-25T16:02:00Z', printedBy: 'ZZ Rosa', moneyNow: { claimAmount: '6150.00', claimSplit: NOTICE.claimSplit, retainageIncluded: '' } }]
    const out = lienRunPrinted({ lines: [line('notice', 'j1', true)], notices, affidavits: [], prints: new Map([fact('notice', 'j1', lienNoticePrintFields(NOTICE))]) })
    expect(out.changed).toHaveLength(1)
    expect(out.changed[0]).toMatchObject({ key: 'notice:j1', standIn: false })
    expect(out.changed[0]!.changes.map((c) => plainSentence(c.words))).toEqual(['The claim: printed $18,400.00, now $6,150.00.'])
  })

  it('a printed notice redrawn since reads as changed against what left the printer', () => {
    const redrawn = { ...NOTICE, originalContractorName: 'ZZ Other Builders' }
    const out = lienRunPrinted({ lines: [line('notice', 'j1', true)], notices: [{ jobId: 'j1', fields: redrawn, printedAt: '2026-11-25T16:02:00Z' }], affidavits: [], prints: new Map([fact('notice', 'j1', lienNoticePrintFields(NOTICE))]) })
    expect(out.changed[0]!.changes.map((c) => plainSentence(c.words))).toEqual(['The original contractor: printed ZZ Builders, now ZZ Other Builders.'])
  })

  it('a notice printed before a print kept its values: the stored notice stands in, and the line says so', () => {
    const moved = { jobId: 'j1', fields: NOTICE, printedAt: '2026-11-20T15:00:00Z', printedBy: 'ZZ Malachi', moneyNow: { claimAmount: '6150.00' } }
    const same = { jobId: 'j2', fields: NOTICE, printedAt: '2026-11-20T15:00:00Z', moneyNow: { claimAmount: '18400.00' } }
    const out = lienRunPrinted({ lines: [line('notice', 'j1', true), line('notice', 'j2', true)], notices: [moved, same], affidavits: [], prints: new Map([fact('notice', 'j2', null)]) })
    expect(out.changed.map((p) => [p.key, p.standIn, p.printedAt, p.printedBy])).toEqual([['notice:j1', true, '2026-11-20T15:00:00Z', 'ZZ Malachi']])
    // One paper that spoke for several jobs is no match for one job's paper: the stored notice stands in there too.
    const combined = lienRunPrinted({ lines: [line('notice', 'j1', true)], notices: [moved], affidavits: [], prints: new Map([fact('notice', 'j1', lienNoticePrintFields({ ...NOTICE, claimAmount: '99999.00' }), ['j1', 'j2'])]) })
    expect(combined.changed.map((p) => [p.standIn, plainSentence(p.changes[0]!.words)])).toEqual([[true, 'The claim: printed $18,400.00, now $6,150.00.']])
  })

  it('a notice not yet printed is never changed since printed: it prints as it stands', () => {
    const out = lienRunPrinted({ lines: [line('notice', 'j1', false)], notices: [{ jobId: 'j1', fields: NOTICE, moneyNow: { claimAmount: '1.00' } }], affidavits: [], prints: new Map([fact('notice', 'j1', lienNoticePrintFields(NOTICE))]) })
    expect(out.changed).toEqual([])
  })
})

describe('the words', () => {
  it('says each value as a person reads it', () => {
    const says = (kind: LienPrintPaperKind, key: string, printed: string, now: string) => plainSentence(lienRunChanges(kind, [{ key, label: 'the thing', printed, now }])[0]!.words)
    expect(says('notice', 'retainageIncluded', '', '615.00')).toBe('The thing: printed none, now $615.00.')
    expect(says('affidavit', 'workEnd', '2026-08-28', '2026-09-04')).toBe('The thing: printed August 28, 2026, now September 4, 2026.')
    expect(says('affidavit', 'includeNoticesSworn', 'yes', '')).toBe('The thing: printed sworn, now left out.')
    expect(says('affidavit', 'form', '', 'short')).toBe('The thing: printed the earlier form, now the short form.')
    expect(says('notice', 'homesteadStatement', '', 'yes')).toBe('The thing: printed not printed, now printed.')
    expect(says('affidavit', 'ownerName', 'ZZ Owner LLC', '')).toBe('The thing: printed ZZ Owner LLC, now nothing.')
  })

  it('counts the affidavits that do not print again, and the ones with nothing to compare', () => {
    expect(lienRunPrintedSameWords(0)).toBe('')
    expect(plainSentence(lienRunPrintedSameWords(1))).toBe('1 affidavit printed already and says the same today. It does not print again here. The Board’s Print for notarization press still prints it.')
    expect(plainSentence(lienRunPrintedSameWords(3))).toBe('3 affidavits printed already and say the same today. They do not print again here. The Board’s Print for notarization press still prints them.')
    expect(lienRunPrintedUnreadWords(0)).toBe('')
    expect(plainSentence(lienRunPrintedUnreadWords(1))).toBe('1 affidavit printed before the desk kept what a paper said. It prints again.')
    expect(plainSentence(lienRunPrintedUnreadWords(2))).toBe('2 affidavits printed before the desk kept what a paper said. They print again.')
  })

  it('says when and who, as much as the row keeps', () => {
    expect(plainSentence(lienRunPrintedByWords({ printedBy: 'ZZ Rosa' }, 'Nov 25, 10:02 AM'))).toBe('Printed Nov 25, 10:02 AM by ZZ Rosa.')
    expect(plainSentence(lienRunPrintedByWords({ printedBy: '' }, 'Nov 25, 10:02 AM'))).toBe('Printed Nov 25, 10:02 AM.')
    expect(plainSentence(lienRunPrintedByWords({ printedBy: '' }, ''))).toBe('Printed.')
  })

  it('keeps to plain words', () => {
    const all = [LIEN_RUN_PRINTED_WORDS.lead, LIEN_RUN_PRINTED_WORDS.standIn, LIEN_RUN_PRINTED_WORDS.affidavitNext, LIEN_RUN_PRINTED_WORDS.noticeNext, LIEN_RUN_PRINTED_WORDS.failed, plainSentence(lienRunPrintedSameWords(3)), plainSentence(lienRunPrintedUnreadWords(2))]
    for (const w of all) for (const sentence of w.split(/(?<=\.)\s+/)) expect(plainWordsFailures(sentence), sentence).toEqual([])
  })
})
