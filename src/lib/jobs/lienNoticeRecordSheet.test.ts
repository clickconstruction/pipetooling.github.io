/**
 * The notice record as a printed page (punch list #322): one page for one paper, packed blocks for a batch, and the
 * rule that neither is ever the paper. Made-up names, numbers and amounts only.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildLienAffidavitBlocks, filingDocFooter, filingDocPrintHtml, lienAffidavitPrintOptions, type LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import { lienAffidavitBatchHelpSheet, lienAffidavitBatchNoticeCopies, lienAffidavitBatchNoticeCopyCount, lienAffidavitBatchNoticeRecords, lienAffidavitPrintRun, type LienAffidavitPrintPaper } from './lienAffidavitBatch'
import { lienAffidavitNoticesWords, lienAffidavitOwnerSends } from './lienAffidavitNotices'
import { LIEN_HELP_BATCH_ASK_LEAD, LIEN_HELP_FOOT_PAPER_NEXT, LIEN_HELP_FOOT_RECORD_NEXT, LIEN_HELP_NOTICES_SEE_RECORD, lienHelpCoverSheetHtml, lienHelpPaperFromFields } from './lienHelpSheet'
import { describeNoticeMonths } from './lienNoticeDraft'
import { lienNoticeRecord, type LienNoticeRecordFiling } from './lienNoticeRecord'
import {
  LIEN_RECORD_ASK,
  LIEN_RECORD_BATCH_LEAD,
  LIEN_RECORD_CLEAR,
  LIEN_RECORD_COPY_BY_HAND,
  LIEN_RECORD_COPY_BY_HAND_NO_FILE,
  LIEN_RECORD_COPY_BY_HAND_NOTE,
  LIEN_RECORD_COPY_DRAWN,
  LIEN_RECORD_COPY_SAVED,
  LIEN_RECORD_ENVELOPE,
  LIEN_RECORD_FIX,
  LIEN_RECORD_MATCH,
  LIEN_RECORD_NO_NOTICE,
  LIEN_RECORD_NOTE_ONLY,
  LIEN_RECORD_NOT_SUB,
  LIEN_RECORD_ON,
  LIEN_RECORD_SAVED_NOTE,
  LIEN_RECORD_STYLES,
  LIEN_RECORD_TOTAL_IN_ALL,
  LIEN_RECORD_WHOLE,
  lienNoticeCopiesHtml,
  lienNoticeCopyNotices,
  lienNoticeRecordBatchHtml,
  lienNoticeRecordSheetHtml,
  lienRecordClaimWords,
  lienRecordDay,
  lienRecordDeliveryLine,
  lienRecordFootNext,
  lienRecordHasPaperTotal,
  lienRecordNoticeWords,
  lienRecordSentAgoWords,
  lienRecordSentWhatWords,
  lienRecordVoidedWords,
  type LienNoticeRecordHead,
} from './lienNoticeRecordSheet'

/** A notice's own words as its row keeps them. */
const snapshot = (noticeDate: string, claimAmount: string) => ({
  noticeDate,
  projectDescription: '1408 Quarry Bend Rd, Marlow, TX 78000',
  claimantName: 'Cedar Fork Plumbing LLC',
  laborMaterialsType: 'Plumbing labor and materials',
  originalContractorName: 'Ridgeway Builders LLC',
  contractedWithIfDifferent: '',
  claimAmount,
  contactPerson: 'Dana Whitlow, Office Manager',
  claimantAddress: 'PO Box 410, Marlow, TX 78000',
})

const HARD: LienNoticeRecordFiling[] = [
  { kind: 'notice_53_056', created_at: '2026-09-23T15:00:00Z', amount: 4180, by_hand: true, fields: snapshot('2026-09-22', '4180.00'), months_covered: ['2026-04', '2026-05', '2026-06', '2026-07'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 06', sent_on: '2026-09-22' }] },
  {
    kind: 'notice_53_056',
    created_at: '2026-10-14T18:00:00Z',
    amount: 5260,
    fields: snapshot('2026-10-14', '5260.00'),
    months_covered: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
    document_url: 'https://drive.example/notice-2',
    sends: [
      { recipient: 'owner', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 42', sent_on: '2026-10-14' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-10-14' },
    ],
  },
]
const HARD_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08']
const CLEAN: LienNoticeRecordFiling[] = [
  {
    kind: 'notice_53_056',
    created_at: '2026-10-14T18:00:00Z',
    amount: 2650,
    fields: snapshot('2026-10-14', '2650.00'),
    months_covered: ['2026-08', '2026-09'],
    document_url: 'https://drive.example/notice',
    sends: [
      { recipient: 'owner', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 17', sent_on: '2026-10-14' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 24', sent_on: '2026-10-14' },
    ],
  },
]
const CLEAN_MONTHS = ['2026-08', '2026-09']

const HEAD: LienNoticeRecordHead = { jobLabel: '4417 · Quarry Bend rough-in', propertyAddress: '1408 Quarry Bend Rd, Marlow, TX 78000', ownerName: 'Hollis Family Trust', contractorName: 'Ridgeway Builders LLC', claim: '$5,260.00' }

const recordOf = (filings: LienNoticeRecordFiling[], months: string[]) => {
  const record = lienNoticeRecord({ isSub: true, propertyKind: 'residential', swornMonths: months, filings, paperMonthsWords: describeNoticeMonths(months), paperNoticesWords: lienAffidavitNoticesWords(lienAffidavitOwnerSends(filings)) })
  if (!record) throw new Error('a sub has a record')
  return record
}

const fieldsFor = (filings: LienNoticeRecordFiling[], months: string[], over: Partial<LienAffidavitFields> = {}): LienAffidavitFields => ({
  county: 'Alder',
  claimantPersonName: 'Dana Whitlow, Office Manager',
  claimantCompany: 'Cedar Fork Plumbing LLC',
  claimantAddress: 'PO Box 410, Marlow, TX 78000',
  legalDescription: 'Lot 7, Block 3, Quarry Bend Section 2',
  propertyAddress: '1408 Quarry Bend Rd, Marlow, TX 78000',
  contractedWithName: 'Ridgeway Builders LLC',
  workDescription: 'plumbing labor and materials',
  workStart: `${months[0] ?? '2026-08'}-06`,
  workEnd: `${months[months.length - 1] ?? '2026-08'}-21`,
  ownerName: 'Hollis Family Trust',
  ownerAddress: '22 Larkspur Ct, Marlow, TX 78000',
  originalContractorName: 'Ridgeway Builders LLC',
  originalContractorAddress: '900 Commerce Row, Suite 4, Marlow, TX 78000',
  contractAmount: '9800.00',
  paidAmount: '4540.00',
  unpaidAmount: '5260.00',
  includeNoticesSworn: true,
  form: 'short',
  isSub: true,
  workMonthsWords: describeNoticeMonths(months),
  noticesSentWords: lienAffidavitNoticesWords(lienAffidavitOwnerSends(filings)),
  ...over,
})

const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('lienNoticeRecordSheetHtml · one page in front of one paper', () => {
  const html = lienNoticeRecordSheetHtml(HEAD, recordOf(HARD, HARD_MONTHS), 'November 12, 2026', { jobCode: '<img alt="" src="data:image/png;base64,AA=="/>' })

  it('is a help page of its own: striped, marked not to be filed, and it ends its page', () => {
    expect(html.startsWith('<section class="lien-help" data-lien-help="record">')).toBe(true)
    expect(html).toContain('lien-help-stripe')
    expect(html).toContain('Notice record · do not file this page')
    expect(html).toContain('What was mailed before this affidavit')
    expect(html).toContain('Printed November 12, 2026')
    expect(html).toContain('Scan to open the job’s filings')
    expect(html).toContain('data-lien-record-code')
    expect(html).toContain(LIEN_HELP_FOOT_PAPER_NEXT)
  })

  it('its foot says what the next page is: the paper, or the copies of the notices', () => {
    expect([lienRecordFootNext(0), lienRecordFootNext(1), lienRecordFootNext(2)]).toEqual([LIEN_HELP_FOOT_PAPER_NEXT, 'A copy of the notice is next, then the paper to sign', 'Copies of the notices are next, then the paper to sign'])
    expect(lienNoticeRecordSheetHtml(HEAD, recordOf(HARD, HARD_MONTHS), '', { copiesFollow: 2 })).toContain('Copies of the notices are next, then the paper to sign')
  })

  it('heads the page with the job, the property, the owner, the original contractor and what the paper claims', () => {
    for (const fact of ['4417 · Quarry Bend rough-in', '1408 Quarry Bend Rd, Marlow, TX 78000', 'Hollis Family Trust', 'Ridgeway Builders LLC', '$5,260.00']) expect(html).toContain(fact)
  })

  it('closes with the question when a month does not stand: the batch row’s lead once, then the check in one short sentence (the owner, 2026-11-13)', () => {
    expect(LIEN_RECORD_ASK).toBe(LIEN_HELP_BATCH_ASK_LEAD)
    // The box says what the row leaves out, which copy raised the question, in as few words.
    expect(html).toContain(`<div class="lien-record-verdict" data-lien-record-verdict="ask"><span class="lien-record-verdict-lead">Ask the attorney first.</span> Both copies went late for April to July 2026.</div>`)
    // Read as the page reads: the lead, the reasons, and then the foot. No closing sentence repeats the lead.
    expect(textOf(html)).toContain(`${LIEN_RECORD_ASK} Both copies went late for April to July 2026. Notice record for 4417`)
    // The long lines are the cover sheet's and the Lien window's. The box is one short sentence (the owner, 2026-11-13: this sentence looks like it is too long).
    expect(html).not.toContain('went after its date')
    expect(html.match(/Ask the attorney first\./g)).toHaveLength(1)
    expect(html).not.toContain('Ask the attorney before this is signed.')
  })

  it('the box is the last thing on the page above the foot: the facts first, the question about them last', () => {
    const at = (needle: string) => html.indexOf(needle)
    const order = [at('data-lien-record-notices'), at('data-lien-record-lines'), at('data-lien-record-gaps'), at('data-lien-record-verdict='), at('lien-help-foot')]
    expect(order.every((n) => n > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('the box is grey, never the cover sheet’s black band, and a question is set apart by its fill', () => {
    expect(html).not.toContain('lien-help-ask')
    expect(html).not.toContain('ASK FIRST')
    expect(LIEN_RECORD_STYLES).toMatch(/\.lien-record-verdict \{ border: 0\.75pt solid #8a9099; border-left-width: 3pt;/)
    expect(LIEN_RECORD_STYLES).toMatch(/\.lien-record-verdict\[data-lien-record-verdict="ask"\] \{ background: #e2e4e8;/)
    expect(LIEN_RECORD_STYLES.split('\n').filter((l) => l.includes('lien-record-verdict')).join('')).not.toContain('#111418')
  })

  it('lists each notice with its months, claim, day entered and saved copy, then a row for each copy', () => {
    expect(html).toContain('Notice 1 · Names April, May, June and July 2026 · Claim $4,180.00 · Entered after the fact Sep 23, 2026 · No saved copy')
    expect(html).toContain('Notice 2 · Names April, May, June, July and August 2026 · Claim $5,260.00 · Entered Oct 14, 2026 · Saved copy on file')
    expect(html).toContain('<tr data-lien-record-copy="owner"><td>Owner</td><td>Sep 22, 2026</td><td>Certified mail</td><td>9589 0000 0000 0000 0000 06</td></tr>')
    expect(html).toContain('<tr data-lien-record-copy="original_contractor" data-on-record="no"><td>Original contractor</td><td colspan="3" class="lien-record-none">No copy on record</td></tr>')
    expect(html).toContain('<td><strong>No number on record</strong></td>')
    expect(html).toContain(LIEN_RECORD_ENVELOPE)
  })

  it('draws no table of the months: the owner asked not to see it, and the lines above say which months do not stand', () => {
    expect(html).not.toContain('Each month the paper swears')
    expect(html).not.toContain('Last day to mail')
    expect(html).not.toContain('days late')
  })

  it('reads the paper’s two sentences against the record, and lists what is missing with where to add it', () => {
    expect(html).toContain('<li data-state="ok"><span class="lien-help-mark">✓</span><span><strong>Sentence 6.</strong> The paper says certified mail on September 22, 2026 and October 14, 2026. The owner’s copies on record say the same.</span></li>')
    expect(html).toContain('<li>Notice 2 has no mail number for the copy to the original contractor.</li>')
    expect(html).toContain(LIEN_RECORD_FIX)
  })

  it('the clean case says so in every place', () => {
    const clean = lienNoticeRecordSheetHtml(HEAD, recordOf(CLEAN, CLEAN_MONTHS), '')
    // Its line sits in the same spot as a question's box, in the same family, with no fill.
    expect(clean).toContain(`<div class="lien-record-verdict" data-lien-record-verdict="clear"><span class="lien-record-verdict-lead">${LIEN_RECORD_ON}</span> ${LIEN_RECORD_CLEAR}</div>`)
    expect(clean.indexOf('data-lien-record-gaps')).toBeLessThan(clean.indexOf('data-lien-record-verdict='))
    expect(clean).not.toContain('ON RECORD')
    expect(clean).toContain(LIEN_RECORD_WHOLE)
    expect(clean).toContain('data-lien-record-gaps="none"')
    expect(clean).not.toContain('Printed ')
    expect(clean).not.toContain('data-lien-record-code')
  })

  it('a job with no notice on record says that, and asks', () => {
    const none = lienNoticeRecordSheetHtml(HEAD, lienNoticeRecord({ isSub: true, propertyKind: '', swornMonths: [], filings: [], paperMonthsWords: '', paperNoticesWords: '' })!, '')
    expect(none).toContain('data-lien-record-no-notice')
    expect(none.match(new RegExp(LIEN_RECORD_NO_NOTICE.replace(/[.§]/g, '\\$&'), 'g'))).toHaveLength(2)
    expect(none).toContain('data-lien-record-verdict="ask"')
  })

  it('counts a voided notice in one line and draws no row for it', () => {
    const record = lienNoticeRecord({ isSub: true, propertyKind: 'residential', swornMonths: CLEAN_MONTHS, filings: [...CLEAN, { ...HARD[0]!, voided_at: '2026-09-30T00:00:00Z' }], paperMonthsWords: describeNoticeMonths(CLEAN_MONTHS), paperNoticesWords: lienAffidavitNoticesWords(lienAffidavitOwnerSends(CLEAN)) })!
    const sheet = lienNoticeRecordSheetHtml(HEAD, record, '')
    expect(sheet).toContain(`data-lien-record-voided>${lienRecordVoidedWords(1)}`)
    expect(sheet.match(/data-lien-record-notice="/g)).toHaveLength(1)
  })

  it('escapes what the record holds', () => {
    const record = recordOf([{ ...CLEAN[0]!, document_url: '', document_note: '<b>bin 4</b>' }], CLEAN_MONTHS)
    const sheet = lienNoticeRecordSheetHtml({ ...HEAD, ownerName: 'A & B <Trust>' }, record, '')
    expect(sheet).toContain('A &amp; B &lt;Trust&gt;')
    expect(sheet).toContain(`<td>${LIEN_RECORD_SAVED_NOTE}</td><td colspan="3">&lt;b&gt;bin 4&lt;/b&gt;</td>`)
    expect(sheet).not.toContain('<b>bin 4</b>')
  })
})

describe('the record’s words', () => {
  it('writes a day short, and leaves alone what is not a day', () => {
    expect(lienRecordDay('2026-09-22')).toBe('Sep 22, 2026')
    expect(lienRecordDay('2026-01-05')).toBe('Jan 5, 2026')
    expect(lienRecordDay('soon')).toBe('soon')
  })

  it('says a notice’s paper total beside this job’s share, and a saved copy’s note', () => {
    const base = { n: 1, recordedOn: '', byHand: false, months: ['2026-08'], claim: 1200, printedClaim: 4180, savedCopy: false, savedNote: 'in the blue folder', copies: [], snapshot: null }
    expect(lienRecordNoticeWords(base)).toBe(`Names August 2026 · The notice claimed $4,180.00 in all, $1,200.00 of it for this job · ${LIEN_RECORD_NOTE_ONLY}`)
    expect(lienRecordNoticeWords({ ...base, months: [], claim: null, printedClaim: null, byHand: true, savedNote: '' })).toBe('Names no month · Entered after the fact · No saved copy')
  })

  it('names a paper total as the notice’s, never as this paper’s claim (the owner, 2026-11-13)', () => {
    // One notice over several jobs at a property: the total is the notice's, the job's part is a part of it.
    expect(lienRecordClaimWords({ claim: 1200, printedClaim: 4180 })).toBe('The notice claimed $4,180.00 in all, $1,200.00 of it for this job')
    // A figure set by hand under the job's amount is not a part of anything: the two are said apart.
    expect(lienRecordClaimWords({ claim: 1200, printedClaim: 900 })).toBe('The notice claimed $900.00, and this job’s amount on record is $1,200.00')
    expect(lienRecordClaimWords({ claim: 1200, printedClaim: null })).toBe('Claim $1,200.00')
    expect(lienRecordClaimWords({ claim: null, printedClaim: 4180 })).toBe('')
    expect(lienRecordClaimWords({ claim: 1200, printedClaim: 4180 })).not.toContain('on the paper')
  })

  it('says whose figure a total is, once, only where a notice carries one', () => {
    const shared: LienNoticeRecordFiling[] = CLEAN.map((f, i) => (i === 0 ? { ...f, printed_claim: 9999 } : f))
    const withTotal = recordOf(shared, CLEAN_MONTHS)
    expect(lienRecordHasPaperTotal(withTotal)).toBe(true)
    expect(lienRecordHasPaperTotal(recordOf(CLEAN, CLEAN_MONTHS))).toBe(false)
    expect(lienRecordHasPaperTotal(null)).toBe(false)

    const page = lienNoticeRecordSheetHtml(HEAD, withTotal, '')
    expect(page).toContain('in all, ')
    expect(page.match(/data-lien-record-total-in-all/g)).toHaveLength(1)
    expect(textOf(page)).toContain(`${LIEN_RECORD_ENVELOPE} ${LIEN_RECORD_TOTAL_IN_ALL}`)
    expect(lienNoticeRecordSheetHtml(HEAD, recordOf(CLEAN, CLEAN_MONTHS), '')).not.toContain('data-lien-record-total-in-all')

    const batch = lienNoticeRecordBatchHtml([{ head: HEAD, record: withTotal }, { head: HEAD, record: recordOf(CLEAN, CLEAN_MONTHS) }, { head: HEAD, record: null }], '')
    expect(batch.match(/data-lien-record-total-in-all/g)).toHaveLength(1)
    expect(textOf(batch)).toContain(`${LIEN_RECORD_FIX} ${LIEN_RECORD_TOTAL_IN_ALL}`)
    expect(lienNoticeRecordBatchHtml([{ head: HEAD, record: recordOf(CLEAN, CLEAN_MONTHS) }], '')).not.toContain('data-lien-record-total-in-all')
  })

  it('says the voided count', () => {
    expect([lienRecordVoidedWords(0), lienRecordVoidedWords(2)]).toEqual(['', '2 voided notices on this job are not counted and are not shown.'])
  })

  it('every sentence the page writes follows the plain-words rules', () => {
    const sentences = [LIEN_RECORD_CLEAR, LIEN_RECORD_ASK, LIEN_RECORD_ON, LIEN_RECORD_ENVELOPE, LIEN_RECORD_TOTAL_IN_ALL, LIEN_RECORD_FIX, LIEN_RECORD_WHOLE, LIEN_RECORD_NOT_SUB, LIEN_RECORD_BATCH_LEAD, LIEN_RECORD_MATCH, LIEN_HELP_NOTICES_SEE_RECORD, LIEN_RECORD_COPY_DRAWN, LIEN_RECORD_COPY_BY_HAND, LIEN_RECORD_COPY_BY_HAND_NO_FILE, LIEN_RECORD_COPY_BY_HAND_NOTE, LIEN_RECORD_COPY_SAVED, lienRecordVoidedWords(1), lienRecordVoidedWords(3)]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })
})

describe('lienNoticeRecordBatchHtml · a block for each paper, packed', () => {
  const papers = [
    { head: { ...HEAD, jobLabel: '4402 · Larkspur repipe', claim: '$2,650.00' }, record: recordOf(CLEAN, CLEAN_MONTHS) },
    { head: HEAD, record: recordOf(HARD, HARD_MONTHS) },
    { head: { jobLabel: '4440 · Elm St drain', propertyAddress: '5 Elm St, Marlow, TX 78000', ownerName: 'Pat Sample', contractorName: '', claim: '$900.00' }, record: null },
  ]
  const html = lienNoticeRecordBatchHtml(papers, 'November 12, 2026')

  it('is one striped section in front of the stack that says how many papers follow and how many wait for the attorney', () => {
    expect(html.match(/<section class="lien-help"/g)).toHaveLength(1)
    expect(html).toContain('data-lien-help="records"')
    expect(html).toContain('Notice records · do not file these pages')
    expect(html).toContain('What was mailed before each of 3 affidavits')
    expect(html).toContain('1 waits for the attorney')
    expect(html).toContain('3 papers follow these pages')
    expect(html).toContain(`${LIEN_RECORD_BATCH_LEAD} ${LIEN_RECORD_ENVELOPE} ${LIEN_RECORD_FIX}`)
  })

  it('numbers each block as the batch sheet numbers its row', () => {
    expect([...html.matchAll(/data-lien-record-paper="(\d+)"/g)].map((m) => m[1])).toEqual(['1', '2', '3'])
    expect(html).toContain('<strong>2 · 4417 · Quarry Bend rough-in</strong>')
    expect(html).toContain('The paper claims $2,650.00')
  })

  it('a paper that stands takes a few lines: its copies, and one line for the rest', () => {
    const block = html.slice(html.indexOf('data-lien-record-paper="1"'), html.indexOf('data-lien-record-paper="2"'))
    expect(block).toContain('data-lien-record-verdict="clear"')
    expect(block).toContain(`${LIEN_RECORD_ON}</span> ${LIEN_RECORD_CLEAR}`)
    expect(block).toContain('9589 0000 0000 0000 0000 24')
    expect(block).toContain(`${LIEN_RECORD_MATCH} Nothing is missing from the record.`)
    expect(block).not.toContain('lien-help-box" data-lien-record-lines')
  })

  it('a paper with a question says which months do not stand and names what is missing', () => {
    const block = html.slice(html.indexOf('data-lien-record-paper="2"'), html.indexOf('data-lien-record-paper="3"'))
    expect(block).toContain('data-lien-record-verdict="ask"')
    expect(block).toContain('<span class="lien-record-verdict-lead">Ask the attorney first.</span> Both copies went late for April to July 2026.</div>')
    expect(block).not.toContain('days late')
    expect(block.match(/data-lien-record-gap/g)).toHaveLength(3)
    expect(block).toContain(LIEN_RECORD_MATCH)
    expect(block).not.toContain('Nothing is missing')
  })

  it('every block ends on its verdict, under the table and the lines (the owner, 2026-11-13: move the box to the bottom of the section)', () => {
    for (const [n, next] of [['1', '2'], ['2', '3']] as const) {
      const block = html.slice(html.indexOf(`data-lien-record-paper="${n}"`), html.indexOf(`data-lien-record-paper="${next}"`))
      const order = [block.indexOf('data-lien-record-notices'), block.indexOf('data-lien-record-close'), block.indexOf('data-lien-record-verdict=')]
      expect(order.every((i) => i > 0), n).toBe(true)
      expect([...order].sort((a, b) => a - b), n).toEqual(order)
      // Nothing of the block follows the box but the block's own end.
      expect(block.slice(block.indexOf('data-lien-record-verdict=')).replace(/^[^>]*>.*?<\/div><\/div>/, '')).not.toContain('<li')
    }
    expect(html).not.toContain('lien-help-ask')
    expect(html).not.toContain('ASK FIRST')
  })

  it('a job contracted with the owner gets its line and no table', () => {
    const block = html.slice(html.indexOf('data-lien-record-paper="3"'))
    expect(block).toContain(LIEN_RECORD_NOT_SUB)
    expect(block).not.toContain('<table')
  })

  it('an empty batch draws nothing, and one paper is counted as one', () => {
    expect(lienNoticeRecordBatchHtml([], 'November 12, 2026')).toBe('')
    const one = lienNoticeRecordBatchHtml(papers.slice(0, 1), '')
    expect(one).toContain('What was mailed before this affidavit')
    expect(one).toContain('1 paper follows these pages')
    expect(lienNoticeRecordBatchHtml(papers, '', true)).toContain('Copies of the notices are next, then 3 papers')
  })
})

describe('lienNoticeCopiesHtml · a copy of each notice, drawn from its own record', () => {
  const record = recordOf(HARD, HARD_MONTHS)
  const html = lienNoticeCopiesHtml(record, { jobLabel: HEAD.jobLabel, refJob: 'Job #4417', todayYmd: '2026-11-12', letterhead: { company: 'Cedar Fork Plumbing LLC', licenseLine: 'License M-00000', contactLines: ['PO Box 410', 'Marlow, TX 78000'] } })

  it('prints a page for each notice, the first mailed first, each a striped help page that ends its sheet', () => {
    expect([...html.matchAll(/data-lien-record-copy-of="(\d+)"/g)].map((m) => m[1])).toEqual(['1', '2'])
    expect(html.match(/<section class="lien-help" data-lien-help="notice-copy"/g)).toHaveLength(2)
    expect(html.match(/lien-help-stripe/g)).toHaveLength(2)
    expect(html).toContain('Copy of notice 1 · do not mail or file this page')
    expect(html.match(/data-lien-record-watermark aria-hidden="true">COPY</g)).toHaveLength(2)
    // The slanted mark is wider than its box, and a print wider than the sheet is shrunk whole by the browser, the sworn paper with it. The box clips it.
    expect(LIEN_RECORD_STYLES).toMatch(/\.lien-record-paper \{[^}]*overflow: hidden/)
  })

  it('is the notice’s own form, with the words its row keeps and nothing from today', () => {
    const [first, second] = html.split('data-lien-record-copy-of="2"')
    expect(first).toContain('Notice of Claim for Unpaid Labor or Materials')
    expect(first).toContain('September 22, 2026')
    expect(first).toContain('$4,180.00')
    expect(first).not.toContain('$5,260.00')
    expect(second).toContain('October 14, 2026')
    expect(second).toContain('$5,260.00')
    expect(first).toContain('Cedar Fork Plumbing LLC')
    expect(first).toContain('Job #4417')
    expect(first).toContain('Work months April, May, June and July 2026')
  })

  it('opens with the delivery record: a big check, how many days ago it went, what went, and a line for each copy', () => {
    const [first, second] = html.split('data-lien-record-copy-of="2"')
    // The delivery record leads the page, above the notice.
    expect(first!.indexOf('data-lien-record-sent="sent"')).toBeGreaterThan(0)
    expect(first!.indexOf('data-lien-record-sent="sent"')).toBeLessThan(first!.indexOf('Notice of Claim for Unpaid Labor or Materials'))
    expect(first).toContain('<div class="lien-record-sent-mark" aria-hidden="true">✓</div>')
    expect(first).toContain('data-lien-record-sent-ago>Sent 51 days ago</div>')
    expect(first).toContain('<div class="lien-record-sent-what">September 22, 2026 · Notice of claim for $4,180.00 · for April, May, June and July 2026</div>')
    expect(second).toContain('data-lien-record-sent-ago>Sent 29 days ago</div>')
    // Each copy has its own line and mark, so the one the record lacks is plain beside the check.
    expect(first).toContain('<li data-state="ok"><span class="lien-help-mark">✓</span><span>Owner of record — certified mail · 9589 0000 0000 0000 0000 06 · September 22, 2026</span></li>')
    expect(first).toContain('<li data-state="ask"><span class="lien-help-mark">!</span><span><strong>Original contractor — no copy on record</strong></span></li>')
    // It is said once, at the top: the notice under it carries no second delivery record.
    expect(first!.match(/no copy on record/g)).toHaveLength(1)
    const [n1, n2] = record.notices
    expect(n1!.copies.map(lienRecordDeliveryLine)).toEqual(['Owner of record — certified mail · 9589 0000 0000 0000 0000 06 · September 22, 2026', 'Original contractor — no copy on record'])
    expect(n2!.copies.map(lienRecordDeliveryLine)[1]).toBe('Original contractor — certified mail · no number on record · October 14, 2026')
    expect(html).toContain('9589 0000 0000 0000 0000 42')
  })

  it('says how long ago in plain counts, the day itself when it has no today, and an exclamation mark when no copy has a day', () => {
    expect(lienRecordSentAgoWords('2026-11-12', '2026-11-12')).toBe('Sent today')
    expect(lienRecordSentAgoWords('2026-11-11', '2026-11-12')).toBe('Sent 1 day ago')
    expect(lienRecordSentAgoWords('2026-09-22', '2026-11-12', true)).toBe('First copy sent 51 days ago')
    expect(lienRecordSentAgoWords('2026-09-22', '')).toBe('Sent September 22, 2026')
    expect(lienRecordSentAgoWords('2026-12-01', '2026-11-12')).toBe('Sent December 1, 2026')
    expect(lienRecordSentAgoWords('', '2026-11-12')).toBe('No day mailed on record')
    expect(lienRecordSentWhatWords(record.notices[1]!, '2026-10-14')).toBe('October 14, 2026 · Notice of claim for $5,260.00 · for April, May, June, July and August 2026')
    const undated = lienNoticeCopiesHtml(recordOf([{ ...CLEAN[0]!, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 1', sent_on: '' }] }], CLEAN_MONTHS), { jobLabel: HEAD.jobLabel, todayYmd: '2026-11-12' })
    expect(undated).toContain('data-lien-record-sent="none"')
    expect(undated).toContain('<div class="lien-record-sent-mark" aria-hidden="true">!</div>')
    expect(undated).toContain('data-lien-record-sent-ago>No day mailed on record</div>')
    // Copies that went on different days say so in the headline.
    const split = lienNoticeCopiesHtml(recordOf([{ ...CLEAN[0]!, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 1', sent_on: '2026-10-14' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9589 2', sent_on: '2026-10-16' }] }], CLEAN_MONTHS), { jobLabel: HEAD.jobLabel, todayYmd: '2026-11-12' })
    expect(split).toContain('data-lien-record-sent-ago>First copy sent 29 days ago</div>')
  })

  it('says what the page is drawn from, and where the paper that went is', () => {
    const [first, second] = html.split('data-lien-record-copy-of="2"')
    expect(first).toContain(LIEN_RECORD_COPY_DRAWN)
    // The first notice was entered after the fact with no file saved; the second was saved to the job.
    expect(first).toContain(LIEN_RECORD_COPY_BY_HAND_NO_FILE)
    expect(second).toContain(LIEN_RECORD_COPY_SAVED)
    expect(second).not.toContain('entered after it was mailed')
    const noted = lienNoticeCopiesHtml(recordOf([{ ...HARD[0]!, document_note: 'in the blue folder' }], ['2026-07']), { jobLabel: HEAD.jobLabel })
    expect(noted).toContain(LIEN_RECORD_COPY_BY_HAND_NOTE)
    expect(noted).not.toContain(LIEN_RECORD_COPY_BY_HAND_NO_FILE)
    expect(lienNoticeCopiesHtml(recordOf([{ ...HARD[0]!, document_url: 'https://drive.example/n' }], ['2026-07']), { jobLabel: HEAD.jobLabel })).toContain(LIEN_RECORD_COPY_BY_HAND)
  })

  it('prints the office’s note on a saved copy whole: a row under the notice’s copies, and a line that closes the delivery record', () => {
    // A receipt and the day of delivery are written beside the saved copy, so that line is the certified mail's own detail.
    const note = 'USPS receipt 10/14 4:02 PM Cedar Fork · delivered 10/17 11:20 AM, Cedar Fork 75001'
    const record = recordOf([{ ...CLEAN[0]!, document_url: 'https://drive.example/n', document_note: note }], CLEAN_MONTHS)
    const sheet = lienNoticeRecordSheetHtml(HEAD, record, '')
    expect(sheet).toContain('Saved copy on file')
    expect(sheet).toContain(`<tr data-lien-record-saved-note="1"><td>${LIEN_RECORD_SAVED_NOTE}</td><td colspan="3">${note}</td></tr>`)
    // The row sits under the notice's last copy, inside the same table.
    expect(sheet.indexOf('data-lien-record-saved-note="1"')).toBeGreaterThan(sheet.lastIndexOf('data-lien-record-copy="'))
    const copies = lienNoticeCopiesHtml(record, { jobLabel: HEAD.jobLabel, todayYmd: '2026-11-12' })
    expect(copies).toContain(`<li data-state="note" data-lien-record-sent-note><span class="lien-help-mark">•</span><span>${LIEN_RECORD_SAVED_NOTE} — ${note}</span></li></ul>`)
    // Said once on the page: the line above the notice names where the copy opens, not the note again.
    expect(copies.split(note)).toHaveLength(2)
    // A batch block carries the row too, and a notice with no note has neither.
    expect(lienNoticeRecordBatchHtml([{ head: HEAD, record }], '')).toContain('data-lien-record-saved-note="1"')
    const bare = recordOf(CLEAN, CLEAN_MONTHS)
    expect(lienNoticeRecordSheetHtml(HEAD, bare, '') + lienNoticeCopiesHtml(bare, { jobLabel: HEAD.jobLabel })).not.toMatch(/data-lien-record-saved-note|data-lien-record-sent-note/)
  })

  it('each band says what the next page is, and the page has no foot to run onto a second sheet', () => {
    expect(html).not.toContain('lien-help-foot')
    const [first, second] = html.split('data-lien-record-copy-of="2"')
    expect(first).toContain('Copy of notice 2 is the next page')
    expect(second).toContain(LIEN_HELP_FOOT_PAPER_NEXT)
  })

  it('a notice whose row keeps no words prints no copy, and the record says so', () => {
    const bare = recordOf([{ ...CLEAN[0]!, fields: {} }], CLEAN_MONTHS)
    expect(lienNoticeCopyNotices(bare)).toEqual([])
    expect(lienNoticeCopiesHtml(bare, { jobLabel: HEAD.jobLabel })).toBe('')
    expect(bare.gaps).toContain('Notice 1 has no record of its words, so no copy of it prints.')
    expect(lienNoticeCopiesHtml(null, { jobLabel: HEAD.jobLabel })).toBe('')
  })
})

describe('the record in the two prints', () => {
  const paper = (jobId: string, filings: LienNoticeRecordFiling[], months: string[], over: Partial<LienAffidavitPrintPaper> = {}): LienAffidavitPrintPaper => {
    const fields = fieldsFor(filings, months)
    return { jobId, jobNumber: jobId.replace('job-', ''), fields, label: `${jobId.replace('job-', '')} · Sample`, noticeRecord: lienNoticeRecord({ isSub: true, propertyKind: 'residential', swornMonths: months, filings, paperMonthsWords: fields.workMonthsWords ?? '', paperNoticesWords: fields.noticesSentWords ?? '' }), ...over }
  }
  const papers = [paper('job-4402', CLEAN, CLEAN_MONTHS), paper('job-4417', HARD, HARD_MONTHS)]

  it('the batch prints its help sheet, then the records, then the papers, and no job’s filed copy has either', () => {
    const helpSheet = lienAffidavitBatchHelpSheet(papers, [], 'November 12, 2026', { recordFollows: true })
    const records = lienAffidavitBatchNoticeRecords(papers, 'November 12, 2026')
    const run = lienAffidavitPrintRun(papers, helpSheet, records)
    const at = (needle: string) => run.html.indexOf(needle)
    expect(at('data-lien-help="batch"')).toBeGreaterThan(0)
    expect(at('data-lien-help="batch"')).toBeLessThan(at('data-lien-help="records"'))
    expect(at('data-lien-help="records"')).toBeLessThan(at('<div class="filing-paper'))
    // Nothing of a record sits between two papers: every help section closes before the first paper opens.
    expect(run.html.lastIndexOf('</section>')).toBeLessThan(at('<div class="filing-paper'))
    expect(run.html).toContain('The notice records are next, then 2 papers')
    expect(run.html).toContain('.lien-record-block')
    expect(run.copies).toHaveLength(2)
    for (const copy of run.copies) {
      expect(copy.html).not.toContain('lien-help')
      expect(copy.html).not.toContain('lien-record')
      expect(copy.html).toContain('BEFORE ME')
    }
  })

  it('a batch’s copies follow its records, are named by the paper’s row, and are in no job’s filed copy', () => {
    expect(lienAffidavitBatchNoticeCopyCount(papers)).toBe(3)
    const copies = lienAffidavitBatchNoticeCopies(papers)
    expect([...copies.matchAll(/class="lien-help-tag">([^<]+)</g)].map((m) => m[1])).toEqual([
      'Paper 1 · Copy of notice 1 · do not mail or file this page',
      'Paper 2 · Copy of notice 1 · do not mail or file this page',
      'Paper 2 · Copy of notice 2 · do not mail or file this page',
    ])
    expect(copies).toContain('Paper 2’s copies are next')
    expect(copies).toContain('The papers to sign are next')
    expect(copies).toContain('Job #4417')
    const run = lienAffidavitPrintRun(papers, null, lienAffidavitBatchNoticeRecords(papers, '', true), copies)
    expect(run.html.indexOf('data-lien-help="records"')).toBeLessThan(run.html.indexOf('data-lien-help="notice-copy"'))
    expect(run.html.lastIndexOf('</section>')).toBeLessThan(run.html.indexOf('<div class="filing-paper'))
    expect(run.html).toContain('Copies of the notices are next, then 2 papers')
    for (const copy of run.copies) expect(copy.html).not.toContain('lien-help')
    expect(lienAffidavitBatchNoticeCopies([])).toBe('')
  })

  it('the records print without the help sheet, and the papers alone with neither', () => {
    const records = lienAffidavitBatchNoticeRecords(papers, '')
    const alone = lienAffidavitPrintRun(papers, null, records)
    expect(alone.html).toContain('data-lien-help="records"')
    expect(alone.html).not.toContain('data-lien-help="batch"')
    const bare = lienAffidavitPrintRun(papers, null, null)
    expect(bare.html).not.toContain('lien-help')
    expect(bare.html).not.toContain('lien-record')
  })

  it('a batch whose papers carry no record prints none', () => {
    expect(lienAffidavitBatchNoticeRecords(papers.map(({ noticeRecord: _drop, ...p }) => p), '')).toBe('')
    expect(lienAffidavitBatchHelpSheet(papers, [], '', {})).toContain('2 papers follow this page')
  })

  it('a job contracted with the owner is a block with no contractor named', () => {
    const owner = paper('job-4440', [], [], { noticeRecord: null })
    owner.fields = { ...owner.fields, isSub: false }
    const records = lienAffidavitBatchNoticeRecords([owner], '')
    expect(records).toContain(LIEN_RECORD_NOT_SUB)
    expect(records).not.toContain('Contractor Ridgeway')
  })

  it('the cover sheet points at the record when it follows, and keeps its own words when it does not', () => {
    const fields = fieldsFor(HARD, HARD_MONTHS)
    const help = lienHelpPaperFromFields({ jobLabel: HEAD.jobLabel, fileBy: 'Mon, Nov 16, 2026', claimWords: '$5,260.00', fields, checked: { propertyKind: 'residential', homestead: false, noticeLines: recordOf(HARD, HARD_MONTHS).flags } })
    const withRecord = lienHelpCoverSheetHtml(help, '', { recordFollows: true })
    expect(withRecord).toContain(`<strong>Notices.</strong> ${LIEN_HELP_NOTICES_SEE_RECORD}`)
    expect(withRecord).not.toContain('went after its date')
    expect(withRecord).toContain('data-lien-help-ask')
    expect(withRecord).toContain(LIEN_HELP_FOOT_RECORD_NEXT)
    const alone = lienHelpCoverSheetHtml(help, '')
    expect(alone).toContain('went after its date')
    expect(alone).toContain(LIEN_HELP_FOOT_PAPER_NEXT)
    // A notices line that stands is left as it is: there is nothing to point at.
    const clean = lienHelpPaperFromFields({ jobLabel: HEAD.jobLabel, fileBy: '', claimWords: '$2,650.00', fields: fieldsFor(CLEAN, CLEAN_MONTHS), checked: { propertyKind: 'residential', homestead: false, noticeLines: [] } })
    expect(lienHelpCoverSheetHtml(clean, '', { recordFollows: true })).toContain('A notice went on time for every month sworn')
  })

  it('the paper’s own print document carries no word of the record', () => {
    const fields = fieldsFor(HARD, HARD_MONTHS)
    const html = filingDocPrintHtml(buildLienAffidavitBlocks(fields), 'Lien Affidavit — Job 4417', filingDocFooter('affidavit'), lienAffidavitPrintOptions(fields))
    expect(html).not.toContain('lien-record')
    expect(html).toContain('6. Notice of the claim was sent to the owner by certified mail on September 22, 2026 and October 14, 2026.')
  })
})
