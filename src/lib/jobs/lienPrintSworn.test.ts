import { describe, expect, it } from 'vitest'
import type { LienAffidavitFields } from '../jobsDocuments/lienAffidavitFieldsType'
import type { LienNoticeFields } from '../jobsDocuments/lienNoticeFieldsType'
import { parseSentCopy, sentDocumentInsert, type SentCopy } from '../sent/sentCopies'
import {
  LIEN_PRINT_KINDS,
  LIEN_SWORN_FIELDS,
  lienAffidavitPrintFields,
  lienAffidavitPrintPaper,
  lienChangedSincePrint,
  lienChangedSincePrintWords,
  lienNewestPrints,
  lienNoticePrintFields,
  lienNoticePrintPaper,
  lienNoticesPrintSnapshot,
  lienPrintChangeKey,
  lienPrintChangeWords,
  lienPrintKey,
  lienPrintSnapshotPapers,
  lienPrintSourceSnapshot,
  lienPrintStanding,
} from './lienPrintSworn'

const NOTICE: LienNoticeFields = {
  noticeDate: '2026-09-14',
  projectDescription: 'ZZ Sample Shop, 12 Sample Rd',
  claimantName: 'ZZ Plumbing',
  laborMaterialsType: 'Plumbing labor and materials',
  originalContractorName: 'ZZ Builders',
  contractedWithIfDifferent: '',
  claimAmount: '18400.00',
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
  paidAmount: '21600.00',
  unpaidAmount: '18400.00',
  includeNoticesSworn: true,
  form: 'short',
  isSub: true,
  workMonthsWords: 'July and August 2026',
  noticesSentWords: 'certified mail on September 14, 2026',
}

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

/** A filing as it would come back from the table: written by `sentDocumentInsert`, read by `parseSentCopy`. */
function filed(n: number, kind: string, jobIds: string[], sentAt: string, sourceSnapshot?: Record<string, unknown>, how: 'print' | 'email' = 'print'): SentCopy {
  const row = sentDocumentInsert(ID(n), { kind, title: 'A paper', how, jobIds, ...(sourceSnapshot ? { sourceSnapshot } : {}) }, null)
  return parseSentCopy({ ...row, sent_at: sentAt, sent_by_name: 'ZZ Office' })!
}

const J1 = '10000000-0000-4000-8000-000000000001'
const J2 = '10000000-0000-4000-8000-000000000002'

describe('what a print keeps', () => {
  it('keeps every value a notice prints, as text', () => {
    const f = lienNoticePrintFields({ ...NOTICE, claimSplit: 'July 2026 $0.00 · August 2026 $18,400.00', retainageIncluded: '1760.00', homesteadStatement: true })
    expect(f).toMatchObject({ claimAmount: '18400.00', claimSplit: 'July 2026 $0.00 · August 2026 $18,400.00', retainageIncluded: '1760.00', homesteadStatement: 'yes', noticeDate: '2026-09-14', contactPerson: 'ZZ Office' })
    // A value the draft leaves off is kept as blank, never as "undefined".
    expect(lienNoticePrintFields(NOTICE)).toMatchObject({ claimSplit: '', retainageIncluded: '', homesteadStatement: '' })
    expect(Object.values(lienNoticePrintFields(NOTICE)).every((v) => typeof v === 'string')).toBe(true)
  })

  it('keeps every value an affidavit prints, as text', () => {
    const f = lienAffidavitPrintFields(AFFIDAVIT)
    expect(f).toMatchObject({ form: 'short', isSub: 'yes', includeNoticesSworn: 'yes', homestead: '', unpaidAmount: '18400.00', signingCounty: '' })
    expect(Object.values(f).every((v) => typeof v === 'string')).toBe(true)
  })

  it('keeps more than it compares: every field that counts is in the snapshot', () => {
    const kept = { notice: Object.keys(lienNoticePrintFields(NOTICE)), affidavit: Object.keys(lienAffidavitPrintFields(AFFIDAVIT)) }
    for (const kind of ['notice', 'affidavit'] as const) {
      for (const f of LIEN_SWORN_FIELDS[kind]) expect(kept[kind], `${kind}.${f.key}`).toContain(f.key)
      expect(new Set(LIEN_SWORN_FIELDS[kind].map((f) => f.key)).size).toBe(LIEN_SWORN_FIELDS[kind].length)
    }
    // The three values the pick leaves out are still kept, so the list can grow and read the prints already filed.
    expect(LIEN_SWORN_FIELDS.notice.map((f) => f.key)).not.toContain('noticeDate')
    expect(LIEN_SWORN_FIELDS.notice.map((f) => f.key)).not.toContain('contactPerson')
    expect(LIEN_SWORN_FIELDS.affidavit.map((f) => f.key)).not.toContain('signingCounty')
    expect(kept.notice).toEqual(expect.arrayContaining(['noticeDate', 'contactPerson']))
    expect(kept.affidavit).toContain('signingCounty')
  })

  it('names every job and desk item of a notice combined at one property', () => {
    expect(lienNoticePrintPaper({ jobId: J1, itemId: 'it1', fields: NOTICE })).toMatchObject({ kind: 'notice', jobIds: [J1], itemIds: ['it1'] })
    const combined = lienNoticePrintPaper({ jobId: J1, itemId: 'it1', fields: NOTICE, parts: [{ jobId: J1, itemId: 'it1' }, { jobId: J2, itemId: 'it2' }] })
    expect(combined).toMatchObject({ jobIds: [J1, J2], itemIds: ['it1', 'it2'] })
    expect(lienAffidavitPrintPaper({ jobId: J1, fields: AFFIDAVIT })).toMatchObject({ kind: 'affidavit', jobIds: [J1], itemIds: [] })
  })

  it('comes back from the table as it went in', () => {
    const snapshot = lienNoticesPrintSnapshot([{ jobId: J1, itemId: 'it1', fields: NOTICE }, { jobId: J2, itemId: 'it2', fields: { ...NOTICE, claimAmount: '950.00' } }])
    const copy = filed(1, 'lien_notice_packet', [J1, J2], '2026-09-14T15:00:00Z', snapshot)
    const papers = lienPrintSnapshotPapers(copy.sourceSnapshot)
    expect(papers.map((p) => [p.kind, p.jobIds, p.itemIds, p.fields.claimAmount])).toEqual([['notice', [J1], ['it1'], '18400.00'], ['notice', [J2], ['it2'], '950.00']])
    expect(papers[0]!.fields).toEqual(lienNoticePrintFields(NOTICE))
  })

  it('reads a snapshot defensively', () => {
    expect(lienPrintSnapshotPapers(null)).toEqual([])
    expect(lienPrintSnapshotPapers({})).toEqual([])
    expect(lienPrintSnapshotPapers({ lienPrint: 'x' })).toEqual([])
    expect(lienPrintSnapshotPapers({ lienPrint: { v: 1, papers: [null, { kind: 'other', jobIds: [J1], fields: {} }, { kind: 'notice', jobIds: [], fields: {} }, { kind: 'notice', jobIds: [J1], fields: [] }] } })).toEqual([])
    // A value that is not text is dropped, the rest of the paper kept.
    expect(lienPrintSnapshotPapers({ lienPrint: { v: 1, papers: [{ kind: 'affidavit', jobIds: [J1], fields: { county: 'Bexar', unpaidAmount: 5 } }] } })).toEqual([{ kind: 'affidavit', jobIds: [J1], itemIds: [], fields: { county: 'Bexar' } }])
    // Another filing's snapshot sits beside it untouched.
    expect(lienPrintSnapshotPapers({ totals: { a: 1 }, ...lienPrintSourceSnapshot([lienAffidavitPrintPaper({ jobId: J1, fields: AFFIDAVIT })]) })).toHaveLength(1)
  })
})

describe('lienChangedSincePrint', () => {
  const printed = lienNoticePrintFields(NOTICE)

  it('finds nothing when the paper would print the same', () => {
    expect(lienChangedSincePrint('notice', printed, lienNoticePrintFields(NOTICE))).toEqual([])
    // Money to the cent, whatever its commas; words whatever their spacing and case.
    const same = lienNoticePrintFields({ ...NOTICE, claimAmount: '$18,400.00', claimantName: '  zz   plumbing ', retainageIncluded: '0.00' })
    expect(lienChangedSincePrint('notice', printed, same)).toEqual([])
  })

  it('does not count the day, the contact person or the county it is signed in', () => {
    expect(lienChangedSincePrint('notice', printed, lienNoticePrintFields({ ...NOTICE, noticeDate: '2026-10-02', contactPerson: 'ZZ Other' }))).toEqual([])
    const a = lienAffidavitPrintFields(AFFIDAVIT)
    expect(lienChangedSincePrint('affidavit', a, lienAffidavitPrintFields({ ...AFFIDAVIT, signingCounty: 'Comal' }))).toEqual([])
  })

  it('names each change with both values, in the paper’s order', () => {
    const now = lienNoticePrintFields({ ...NOTICE, claimAmount: '6150.00', originalContractorName: 'ZZ Other Builders', retainageIncluded: '615.00' })
    const changes = lienChangedSincePrint('notice', printed, now)
    expect(changes.map((c) => c.key)).toEqual(['originalContractorName', 'claimAmount', 'retainageIncluded'])
    expect(changes[1]).toEqual({ key: 'claimAmount', label: 'the claim', printed: '18400.00', now: '6150.00' })
    expect(lienPrintChangeWords(changes[1]!)).toBe('the claim: printed “18400.00”, now “6150.00”')
    expect(lienPrintChangeWords(changes[2]!)).toBe('the retainage inside the claim: printed nothing, now “615.00”')
    expect(lienChangedSincePrintWords(changes)).toBe('The original contractor: printed “ZZ Builders”, now “ZZ Other Builders”, and 2 more changes.')
    expect(lienChangedSincePrintWords(changes.slice(0, 2))).toBe('The original contractor: printed “ZZ Builders”, now “ZZ Other Builders”, and 1 more change.')
    expect(lienChangedSincePrintWords(changes.slice(1, 2))).toBe('The claim: printed “18400.00”, now “6150.00”.')
    expect(lienChangedSincePrintWords([])).toBe('')
  })

  it('reads an affidavit’s money, days and flags', () => {
    const a = lienAffidavitPrintFields(AFFIDAVIT)
    const now = lienAffidavitPrintFields({ ...AFFIDAVIT, paidAmount: '25000.00', unpaidAmount: '15000.00', workEnd: '2026-09-04', includeNoticesSworn: false, form: undefined })
    expect(lienChangedSincePrint('affidavit', a, now).map((c) => c.key)).toEqual(['form', 'workEnd', 'paidAmount', 'unpaidAmount', 'includeNoticesSworn'])
  })

  it('does not compare a field the print did not keep', () => {
    const { claimAmount: _dropped, ...older } = printed
    expect(lienChangedSincePrint('notice', older, lienNoticePrintFields({ ...NOTICE, claimAmount: '1.00' }))).toEqual([])
  })
})

describe('lienPrintChangeKey', () => {
  const printed = lienNoticePrintFields(NOTICE)
  const diff = (now: Partial<LienNoticeFields>) => lienChangedSincePrint('notice', printed, lienNoticePrintFields({ ...NOTICE, ...now }))

  it('is the same for the same difference, however the values are written', () => {
    const a = lienPrintChangeKey('notice', diff({ claimAmount: '6150.00' }))
    expect(a).toMatch(/^notice:1:[0-9a-z]+$/)
    expect(lienPrintChangeKey('notice', diff({ claimAmount: '$6,150.00' }))).toBe(a)
    expect(a.length).toBeLessThanOrEqual(200)
  })

  it('is another key when a statement moves again, or another one moves', () => {
    const a = lienPrintChangeKey('notice', diff({ claimAmount: '6150.00' }))
    expect(lienPrintChangeKey('notice', diff({ claimAmount: '5000.00' }))).not.toBe(a)
    expect(lienPrintChangeKey('notice', diff({ claimAmount: '6150.00', originalContractorName: 'ZZ Other Builders' }))).not.toBe(a)
    // The same fields in another order are one difference.
    const two = diff({ claimAmount: '6150.00', originalContractorName: 'ZZ Other Builders' })
    expect(lienPrintChangeKey('notice', [...two].reverse())).toBe(lienPrintChangeKey('notice', two))
    // No difference has no key, so nothing can be said to stand through it.
    expect(lienPrintChangeKey('notice', [])).toBe('')
  })
})

describe('lienNewestPrints', () => {
  const affidavitSnap = (fields: LienAffidavitFields, jobId = J1) => lienPrintSourceSnapshot([lienAffidavitPrintPaper({ jobId, fields })])

  it('takes each job’s newest print of each paper, whatever order the rows come in', () => {
    const older = filed(1, 'lien_affidavit', [J1], '2026-09-10T15:00:00Z', affidavitSnap(AFFIDAVIT))
    const newer = filed(2, 'lien_affidavit', [J1], '2026-09-12T15:00:00Z', affidavitSnap({ ...AFFIDAVIT, unpaidAmount: '15000.00' }))
    const packet = filed(3, 'lien_notice_packet', [J1, J2], '2026-09-11T15:00:00Z', lienNoticesPrintSnapshot([{ jobId: J1, itemId: 'it1', fields: NOTICE }, { jobId: J2, itemId: 'it2', fields: NOTICE }]))
    const prints = lienNewestPrints([older, packet, newer])
    expect([...prints.keys()].sort()).toEqual([lienPrintKey('affidavit', J1), lienPrintKey('notice', J1), lienPrintKey('notice', J2)].sort())
    expect(prints.get(lienPrintKey('affidavit', J1))).toMatchObject({ copyId: ID(2), printedAt: '2026-09-12T15:00:00Z', printedBy: 'ZZ Office', jobIds: [J1] })
    expect(prints.get(lienPrintKey('affidavit', J1))!.fields!.unpaidAmount).toBe('15000.00')
    expect(prints.get(lienPrintKey('notice', J2))).toMatchObject({ copyId: ID(3), itemIds: ['it2'] })
  })

  it('counts a print filed before the fields rode along, with nothing to compare', () => {
    const prints = lienNewestPrints([filed(1, 'lien_affidavit', [J1], '2026-09-10T15:00:00Z')])
    expect(prints.get(lienPrintKey('affidavit', J1))).toMatchObject({ copyId: ID(1), fields: null, jobIds: [J1], itemIds: [] })
  })

  it('passes over a copy that is no lien print, or went another way than a printer', () => {
    const prints = lienNewestPrints([
      filed(1, 'lien_grid', [J1], '2026-09-10T15:00:00Z'),
      filed(2, 'lien_release', [J1], '2026-09-10T15:00:00Z'),
      filed(3, 'lien_affidavit', [J1], '2026-09-10T15:00:00Z', affidavitSnap(AFFIDAVIT), 'email'),
    ])
    expect(prints.size).toBe(0)
    expect(Object.keys(LIEN_PRINT_KINDS).sort()).toEqual(['lien_affidavit', 'lien_notice', 'lien_notice_53_056', 'lien_notice_packet'])
  })

  it('reads a combined notice on every job it stood for', () => {
    const combined = filed(1, 'lien_notice', [J1, J2], '2026-09-10T15:00:00Z', lienNoticesPrintSnapshot([{ jobId: J1, itemId: 'it1', fields: NOTICE, parts: [{ jobId: J1, itemId: 'it1' }, { jobId: J2, itemId: 'it2' }] }]))
    const prints = lienNewestPrints([combined])
    expect(prints.get(lienPrintKey('notice', J2))).toMatchObject({ jobIds: [J1, J2], itemIds: ['it1', 'it2'] })
  })
})

describe('lienPrintStanding', () => {
  const fact = (fields: LienAffidavitFields | null, jobIds = [J1]) => ({ kind: 'affidavit' as const, copyId: ID(1), printedAt: '2026-09-12T15:00:00Z', printedBy: 'ZZ Office', fields: fields ? lienAffidavitPrintFields(fields) : null, jobIds, itemIds: [] })
  const now = lienAffidavitPrintFields(AFFIDAVIT)

  it('is never with no print filed', () => {
    expect(lienPrintStanding('affidavit', undefined, now)).toEqual({ state: 'never' })
    expect(lienPrintStanding('affidavit', null, now)).toEqual({ state: 'never' })
  })

  it('is printed when the paper would say the same today', () => {
    expect(lienPrintStanding('affidavit', fact(AFFIDAVIT), now)).toMatchObject({ state: 'printed', fact: { copyId: ID(1) } })
  })

  it('is changed when a statement moved, with what moved', () => {
    const s = lienPrintStanding('affidavit', fact({ ...AFFIDAVIT, unpaidAmount: '15000.00' }), now)
    expect(s.state).toBe('changed')
    expect(s.state === 'changed' ? s.changes : []).toEqual([{ key: 'unpaidAmount', label: 'the amount unpaid', printed: '15000.00', now: '18400.00' }])
  })

  it('is unread for a print with no fields, and for one paper that spoke for several jobs', () => {
    expect(lienPrintStanding('affidavit', fact(null), now).state).toBe('unread')
    expect(lienPrintStanding('affidavit', fact(AFFIDAVIT, [J1, J2]), now).state).toBe('unread')
  })
})
