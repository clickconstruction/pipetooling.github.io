/**
 * The notice record behind a lien affidavit (punch list #322): the notices as rows, the month table, the paper's two
 * sentences read against the record, and what the record does not hold. Made-up names, numbers and amounts only.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { lienAffidavitNoticeCheck, lienNoticeCheckLines, lienNoticeCheckShortLines } from './lienAffidavitNoticeCheck'
import { lienAffidavitNoticesWords, lienAffidavitOwnerSends } from './lienAffidavitNotices'
import { describeNoticeMonths } from './lienNoticeDraft'
import {
  lienNoticeRecord,
  lienNoticeRecordAsks,
  lienNoticeRecordDaysBetween,
  lienNoticeRecordGaps,
  lienNoticeRecordMethodWords,
  lienNoticeRecordNotices,
  lienNoticeRecordOwnerSends,
  lienNoticeRecordSpanMonths,
  lienNoticeSnapshot,
  type LienNoticeRecordFiling,
} from './lienNoticeRecord'

/** The hard case: an early notice to the owner alone, a later one to both, one copy with no number. */
const WORDS = { claimantName: 'Cedar Fork Plumbing LLC', claimAmount: '4180.00', projectDescription: '1408 Quarry Bend Rd' }
const FIRST: LienNoticeRecordFiling = {
  fields: WORDS,
  kind: 'notice_53_056',
  created_at: '2026-09-23T15:00:00Z',
  amount: 4180,
  by_hand: true,
  months_covered: ['2026-04', '2026-05', '2026-06', '2026-07'],
  document_url: '',
  document_note: '',
  sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 06', sent_on: '2026-09-22' }],
}
const SECOND: LienNoticeRecordFiling = {
  fields: WORDS,
  kind: 'notice_53_056',
  created_at: '2026-10-14T18:00:00Z',
  amount: 5260,
  months_covered: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
  document_url: 'https://drive.example/notice-2',
  sends: [
    { recipient: 'owner', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 42', sent_on: '2026-10-14' },
    { recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-10-14' },
  ],
}
const HARD = [SECOND, FIRST] // newest first, as the desk and the window read them
const HARD_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08']

/** The clean case: one notice, both copies the same day, both numbers, a saved copy. */
const CLEAN: LienNoticeRecordFiling[] = [
  {
    fields: WORDS,
    kind: 'notice_53_056',
    created_at: '2026-10-14T18:00:00Z',
    amount: 2650,
    months_covered: ['2026-08', '2026-09'],
    document_url: 'https://drive.example/notice',
    sends: [
      { recipient: 'owner', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 17', sent_on: '2026-10-14' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 24', sent_on: '2026-10-14' },
    ],
  },
]
const CLEAN_MONTHS = ['2026-08', '2026-09']

const paperWords = (filings: LienNoticeRecordFiling[], months: string[]) => ({ paperMonthsWords: describeNoticeMonths(months), paperNoticesWords: lienAffidavitNoticesWords(lienAffidavitOwnerSends(filings)) })

const recordOf = (filings: LienNoticeRecordFiling[], months: string[], over: Partial<Parameters<typeof lienNoticeRecord>[0]> = {}) => {
  const record = lienNoticeRecord({ isSub: true, propertyKind: 'residential', swornMonths: months, filings, ...paperWords(filings, months), ...over })
  if (!record) throw new Error('a sub has a record')
  return record
}

describe('lienNoticeRecordNotices · one row for each copy mailed', () => {
  it('numbers the notices by the day they were mailed, whatever order the rows come in', () => {
    const notices = lienNoticeRecordNotices(HARD)
    expect(notices.map((n) => [n.n, n.months.length, n.byHand, n.recordedOn])).toEqual([
      [1, 4, true, '2026-09-23'],
      [2, 5, false, '2026-10-14'],
    ])
  })

  it('lists the owner’s copy, then the original contractor’s, and a copy the record lacks is a row that says so', () => {
    const [first, second] = lienNoticeRecordNotices(HARD)
    expect(first!.copies).toEqual([
      { recipient: 'owner', onRecord: true, sentOn: '2026-09-22', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 06', number: 'held', receipt: false },
      { recipient: 'original_contractor', onRecord: false, sentOn: '', method: '', tracking: '', number: 'none', receipt: false },
    ])
    expect(second!.copies.map((c) => [c.recipient, c.onRecord, c.number])).toEqual([
      ['owner', true, 'held'],
      ['original_contractor', true, 'owed'],
    ])
  })

  it('keeps the claim, the paper’s own total when it differs, and whether a copy of the paper was saved', () => {
    const [first, second] = lienNoticeRecordNotices(HARD)
    expect([first!.claim, first!.printedClaim, first!.savedCopy, first!.savedNote]).toEqual([4180, null, false, ''])
    expect([second!.claim, second!.savedCopy]).toEqual([5260, true])
    const [combined] = lienNoticeRecordNotices([{ ...FIRST, amount: 1200, printed_claim: 4180, document_note: 'in the blue folder' }])
    expect([combined!.claim, combined!.printedClaim, combined!.savedCopy, combined!.savedNote]).toEqual([1200, 4180, false, 'in the blue folder'])
  })

  it('reads a provider’s number that has not come yet, an email, a hand delivery and a receipt photo as they are', () => {
    const [n] = lienNoticeRecordNotices([
      {
        kind: 'notice_53_056',
        months_covered: ['2026-08'],
        sends: [
          { recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-14', via: 'mailhouse', piece_id: 'p-1', receipt_url: 'https://drive.example/receipt' },
          { recipient: 'original_contractor', method: 'hand', tracking: '', sent_on: '2026-10-14' },
        ],
      },
    ])
    expect(n!.copies.map((c) => [c.number, c.receipt])).toEqual([
      ['coming', true],
      ['none', false],
    ])
  })

  it('leaves out a voided notice, another kind of filing and a send to nobody the paper knows', () => {
    const notices = lienNoticeRecordNotices([{ ...FIRST, voided_at: '2026-09-30T00:00:00Z' }, { ...SECOND, kind: 'affidavit' }, { kind: 'notice_53_056', months_covered: ['2026-08'], sends: [{ recipient: 'lender', method: 'email', tracking: 'x', sent_on: '2026-10-01' }] }])
    expect(notices).toHaveLength(1)
    expect(notices[0]!.copies.every((c) => !c.onRecord)).toBe(true)
  })
})

describe('lienNoticeRecord · each month the paper swears', () => {
  it('names the notice behind each copy and how late it went, on the residential clock', () => {
    const { months, commercial } = recordOf(HARD, HARD_MONTHS)
    expect(commercial).toBe(false)
    expect(months.map((m) => [m.month, m.dueOn, m.owner.state, m.owner.sentOn, m.owner.notice, m.owner.daysLate, m.contractor.state, m.contractor.notice, m.contractor.daysLate])).toEqual([
      ['2026-04', '2026-06-15', 'late', '2026-09-22', 1, 99, 'late', 2, 121],
      ['2026-05', '2026-07-15', 'late', '2026-09-22', 1, 69, 'late', 2, 91],
      ['2026-06', '2026-08-17', 'late', '2026-09-22', 1, 36, 'late', 2, 58],
      ['2026-07', '2026-09-15', 'late', '2026-09-22', 1, 7, 'late', 2, 29],
      ['2026-08', '2026-10-15', 'on_time', '2026-10-14', 2, 0, 'on_time', 2, 0],
    ])
  })

  it('agrees with the help sheet’s own check, line for line', () => {
    const record = recordOf(HARD, HARD_MONTHS)
    expect(record.flags).toEqual(lienNoticeCheckLines(lienAffidavitNoticeCheck({ isSub: true, propertyKind: 'residential', months: HARD_MONTHS, filings: HARD })))
    expect(record.flags).toHaveLength(2)
    // The box at the record's foot reads the same check, said shorter.
    expect(record.flagsShort).toEqual(lienNoticeCheckShortLines(lienAffidavitNoticeCheck({ isSub: true, propertyKind: 'residential', months: HARD_MONTHS, filings: HARD })))
    expect(record.flagsShort).toEqual(['Both copies went late for April to July 2026.'])
    expect(lienNoticeRecordAsks(record)).toBe(true)
  })

  it('a copy that never went is missing, not late', () => {
    const { months } = recordOf([FIRST], ['2026-07'])
    expect(months[0]!.contractor).toEqual({ state: 'missing', sentOn: '', notice: null, daysLate: 0 })
  })

  it('gives a commercial property the third month', () => {
    const record = recordOf(CLEAN, CLEAN_MONTHS, { propertyKind: 'non_residential' })
    expect(record.commercial).toBe(true)
    expect(record.months.map((m) => m.dueOn)).toEqual(['2026-11-16', '2026-12-15'])
  })

  it('the clean case stands: every month on time to both, nothing asked, nothing missing', () => {
    const record = recordOf(CLEAN, CLEAN_MONTHS)
    expect(record.flags).toEqual([])
    expect(record.flagsShort).toEqual([])
    expect(record.gaps).toEqual([])
    expect(record.lines.map((l) => l.state)).toEqual(['ok', 'ok'])
    expect(lienNoticeRecordAsks(record)).toBe(false)
    expect(record.months.every((m) => m.owner.state === 'on_time' && m.contractor.state === 'on_time')).toBe(true)
  })

  it('a job contracted with the owner has no record: no notice is owed', () => {
    expect(lienNoticeRecord({ isSub: false, propertyKind: 'residential', swornMonths: [], filings: CLEAN, paperMonthsWords: '', paperNoticesWords: '' })).toBeNull()
  })
})

describe('lienNoticeRecord · the paper against the record', () => {
  it('sentence 6’s two days are the two notices’ days to the owner, read off the record’s own rows', () => {
    const record = recordOf(HARD, HARD_MONTHS)
    expect(lienNoticeRecordOwnerSends(record.notices)).toEqual(lienAffidavitOwnerSends(HARD))
    expect(record.lines[1]).toEqual({ state: 'ok', lead: 'Sentence 6.', words: 'The paper says certified mail on September 22, 2026 and October 14, 2026. The owner’s copies on record say the same.' })
    expect(record.lines[0]).toEqual({ state: 'ok', lead: 'Sentence 5.', words: 'The paper names April, May, June, July and August 2026. A notice on record names each of those months.' })
  })

  it('marks a sentence the record does not back, and says what each holds', () => {
    const record = recordOf(HARD, HARD_MONTHS, { paperNoticesWords: 'certified mail on October 14, 2026', paperMonthsWords: 'August 2026' })
    expect(record.lines[0]).toMatchObject({ state: 'ask', words: 'The paper names August 2026. The notices on record name April, May, June, July and August 2026 for this job.' })
    expect(record.lines[1]).toMatchObject({ state: 'ask', words: 'The paper says certified mail on October 14, 2026. The record shows certified mail on September 22, 2026 and October 14, 2026.' })
    expect(lienNoticeRecordAsks(record)).toBe(true)
  })

  it('a blank on the paper is said as a blank', () => {
    const record = recordOf([], [], { paperMonthsWords: '', paperNoticesWords: '' })
    expect(record.notices).toEqual([])
    expect(record.lines.map((l) => [l.state, l.lead])).toEqual([
      ['ask', 'Sentence 5.'],
      ['ask', 'Sentence 6.'],
    ])
    expect(lienNoticeRecordAsks(record)).toBe(true)
  })

  it('notes a month the notices name that the paper leaves off, and a month of the job’s work no notice names', () => {
    // The paper swears August alone (the job's own span); the notice also named September, for another job at the property.
    const record = recordOf(CLEAN, ['2026-08'], { workStart: '2026-07-06', workEnd: '2026-08-21' })
    expect(record.lines.slice(2)).toEqual([
      { state: 'note', lead: 'Left off the paper.', words: 'The notices also name September 2026. The paper leaves it off, as outside this job’s work dates.' },
      { state: 'note', lead: 'No notice.', words: 'This job’s work dates take in July 2026. No notice on record names it.' },
    ])
    // A note is a fact beside the paper, never a question of its own.
    expect(lienNoticeRecordAsks(record)).toBe(false)
  })

  it('counts a voided notice and shows none of it', () => {
    const record = recordOf([...CLEAN, { ...FIRST, voided_at: '2026-09-30T00:00:00Z' }], CLEAN_MONTHS)
    expect(record.voided).toBe(1)
    expect(record.notices).toHaveLength(1)
  })
})

describe('lienNoticeSnapshot · the words a copy is drawn from', () => {
  it('fills every line of the form from the row, blank where the row has none', () => {
    expect(lienNoticeSnapshot({ claimantName: 'Cedar Fork Plumbing LLC', claimAmount: 4180, noticeDate: '2026-09-22', homesteadStatement: true, claimSplit: 'July 2026 $4,180.00' })).toEqual({
      noticeDate: '2026-09-22',
      projectDescription: '',
      claimantName: 'Cedar Fork Plumbing LLC',
      laborMaterialsType: '',
      originalContractorName: '',
      contractedWithIfDifferent: '',
      claimAmount: '4180',
      contactPerson: '',
      claimantAddress: '',
      claimSplit: 'July 2026 $4,180.00',
      homesteadStatement: true,
    })
  })

  it('is null for a row that keeps no word of the notice, so a copy is never a page of blanks', () => {
    for (const none of [null, undefined, {}, [], 'x', { noticeDate: '2026-09-22' }]) expect(lienNoticeSnapshot(none)).toBeNull()
    expect(lienNoticeRecordNotices([{ ...FIRST, fields: { claimantName: 'Cedar Fork Plumbing LLC' } }])[0]!.snapshot?.claimantName).toBe('Cedar Fork Plumbing LLC')
  })
})

describe('lienNoticeRecordGaps · what the record does not hold', () => {
  it('names each missing copy, number and saved paper by its notice', () => {
    expect(recordOf(HARD, HARD_MONTHS).gaps).toEqual([
      'Notice 1 has no copy to the original contractor on record.',
      'Notice 1 has no saved copy of the paper.',
      'Notice 2 has no mail number for the copy to the original contractor.',
    ])
    expect(recordOf(HARD.map((f) => ({ ...f, fields: {} })), HARD_MONTHS).gaps).toContain('Notice 2 has no record of its words, so no copy of it prints.')
  })

  it('says when one number was typed on both copies, a day is missing, a number is coming, or no month was named', () => {
    const gaps = lienNoticeRecordGaps(
      lienNoticeRecordNotices([
        { kind: 'notice_53_056', fields: WORDS, months_covered: [], document_note: 'filed in the cabinet', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 1', sent_on: '2026-10-01' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '95891', sent_on: '' }] },
        { kind: 'notice_53_056', fields: WORDS, months_covered: ['2026-08'], document_url: 'https://drive.example/n', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-14', via: 'mailhouse', piece_id: 'p-1' }, { recipient: 'original_contractor', method: 'email', tracking: 'resend:1 → office@example.com', sent_on: '2026-10-14' }] },
      ]),
    )
    expect(gaps).toEqual([
      'Notice 1 names no month of work.',
      'Notice 1 has no day mailed for the copy to the original contractor.',
      'Notice 1 has the same mail number on both copies. Each envelope has its own.',
      'Notice 2 waits on the mail provider for the number of the copy to the owner.',
    ])
  })
})

describe('the record’s small helpers', () => {
  it('counts whole days between two days', () => {
    expect(lienNoticeRecordDaysBetween('2026-06-15', '2026-09-22')).toBe(99)
    expect(lienNoticeRecordDaysBetween('2026-10-15', '2026-10-14')).toBe(-1)
    expect(lienNoticeRecordDaysBetween('', '2026-10-14')).toBe(0)
  })

  it('lists the months of a span, across a year’s end, and none for a span it cannot read', () => {
    expect(lienNoticeRecordSpanMonths('2026-11-20', '2027-02-03')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(lienNoticeRecordSpanMonths('2026-08-03', '2026-08-21')).toEqual(['2026-08'])
    expect(lienNoticeRecordSpanMonths('2026-09-01', '2026-08-21')).toEqual([])
    expect(lienNoticeRecordSpanMonths('', '2026-08-21')).toEqual([])
  })

  it('says a method in a few words, and an unknown one as recorded', () => {
    expect(['certified_mail', 'traceable_courier', 'hand', 'email', 'carrier_pigeon'].map(lienNoticeRecordMethodWords)).toEqual(['Certified mail', 'Courier with receipt', 'By hand', 'Email', 'Carrier pigeon'])
  })

  it('every sentence the record writes follows the plain-words rules', () => {
    const records = [
      recordOf(HARD, HARD_MONTHS),
      recordOf(CLEAN, ['2026-08'], { workStart: '2026-07-06', workEnd: '2026-08-21' }),
      recordOf([], [], { paperMonthsWords: '', paperNoticesWords: '' }),
      recordOf(HARD, HARD_MONTHS, { paperNoticesWords: 'certified mail on October 14, 2026', paperMonthsWords: 'August 2026' }),
    ]
    for (const r of records) for (const s of [...r.gaps, ...r.lines.map((l) => l.words)]) expect(plainWordsFailures(s), s).toEqual([])
  })
})
