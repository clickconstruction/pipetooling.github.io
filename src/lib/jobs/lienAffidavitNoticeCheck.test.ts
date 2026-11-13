import { describe, expect, it } from 'vitest'
import { LIEN_NOTICE_CHECK_LEAD, lienAffidavitNoticeCheck, lienNoticeCheckFlags, lienNoticeCheckLines, lienNoticeCheckMonths, lienNoticeCheckRowLine, noticeMonthsSpanWords } from './lienAffidavitNoticeCheck'
import { noticeDeadlineForMonth } from './lienDeadlines'
import { buildLienAffidavitFieldsForJob, lienAffidavitSwornMonths } from './lienNoticeDraft'
import { plainWordsFailures } from '../plainWords'

const notice = (months: string[], sends: Array<[string, string]>, over: Record<string, unknown> = {}) => ({ kind: 'notice_53_056', months_covered: months, sends: sends.map(([recipient, sent_on]) => ({ recipient, method: 'certified_mail', sent_on })), voided_at: null, ...over })
const check = (propertyKind: string, months: string[], filings: ReturnType<typeof notice>[], isSub = true) => lienAffidavitNoticeCheck({ isSub, propertyKind, months, filings })

describe('the notice behind each sworn month (punch list #314)', () => {
  it('a house: one notice mailed in late September is on time for August alone', () => {
    const c = check('residential', ['2026-04', '2026-06', '2026-07', '2026-08'], [notice(['2026-04', '2026-06', '2026-07', '2026-08'], [['owner', '2026-09-22']])])
    expect(c.months.map((m) => [m.month, m.dueOn, m.ownerSentOn, m.contractorSentOn])).toEqual([
      ['2026-04', '2026-06-15', '2026-09-22', null],
      ['2026-06', '2026-08-17', '2026-09-22', null],
      ['2026-07', '2026-09-15', '2026-09-22', null],
      ['2026-08', '2026-10-15', '2026-09-22', null],
    ])
    expect(c.ownerLate).toEqual(['2026-04', '2026-06', '2026-07'])
    expect(c.contractorMissing).toEqual(['2026-04', '2026-06', '2026-07', '2026-08'])
    expect(c.contractorLate).toEqual([])
    expect(lienNoticeCheckFlags(c)).toBe(true)
    expect(lienNoticeCheckLines(c)).toEqual([
      "The owner's notice went after its date, or is not on record, for April, June and July 2026.",
      'No copy to the original contractor is on record for April, June, July and August 2026.',
    ])
  })

  it('uses the app’s own deadline: the second month on a house, the third on any other property', () => {
    expect(check('residential', ['2026-07'], []).months[0]!.dueOn).toBe(noticeDeadlineForMonth('2026-07-01', 'residential'))
    const shop = check('non_residential', ['2026-07'], [notice(['2026-07'], [['owner', '2026-10-14'], ['original_contractor', '2026-10-14']])])
    expect(shop.months[0]!.dueOn).toBe('2026-10-15')
    expect(lienNoticeCheckFlags(shop)).toBe(false)
    expect(lienNoticeCheckLines(shop)).toEqual([])
    // The same notice on a house was due a month earlier.
    expect(check('residential', ['2026-07'], [notice(['2026-07'], [['owner', '2026-10-14'], ['original_contractor', '2026-10-14']])]).ownerLate).toEqual(['2026-07'])
  })

  it('reads the first send of each kind across every live notice that names the month', () => {
    const c = check('residential', ['2026-08'], [notice(['2026-08'], [['owner', '2026-10-20']]), notice(['2026-07', '2026-08'], [['owner', '2026-10-14'], ['original_contractor', '2026-10-16']]), notice(['2026-08'], [['owner', '2026-09-01']], { voided_at: '2026-09-02T00:00:00Z' })])
    expect(c.months[0]).toMatchObject({ ownerSentOn: '2026-10-14', contractorSentOn: '2026-10-16' })
    expect([c.ownerLate, c.contractorMissing, c.contractorLate]).toEqual([[], [], ['2026-08']])
    expect(lienNoticeCheckLines(c)).toEqual(["The original contractor's copy went after its date for August 2026."])
  })

  it('a month with no notice at all is flagged, and a job contracted with the owner has nothing to check', () => {
    expect(check('residential', ['2026-08'], []).ownerLate).toEqual(['2026-08'])
    expect(check('residential', ['2026-08'], [], false)).toEqual({ months: [], ownerLate: [], contractorMissing: [], contractorLate: [] })
    expect(check('residential', ['bad', '2026-08', '2026-08'], []).months.map((m) => m.month)).toEqual(['2026-08'])
  })

  it('says it in plain words', () => {
    const lines = lienNoticeCheckLines(check('residential', ['2026-04', '2026-08'], [notice(['2026-04', '2026-08'], [['owner', '2026-09-22'], ['original_contractor', '2026-10-20']])]))
    for (const s of [LIEN_NOTICE_CHECK_LEAD, ...lines]) expect(plainWordsFailures(s), s).toEqual([])
  })
})

describe('the check in one sentence, for the batch help sheet’s row (the owner, 2026-11-13)', () => {
  const APR_JUL = ['2026-04', '2026-05', '2026-06', '2026-07']
  it('names the months once, whichever copy raised the question', () => {
    // The owner's copy and the contractor's copy both went late for the same four months: two lines, one sentence.
    const both = check('residential', APR_JUL, [notice(APR_JUL, [['owner', '2026-09-22'], ['original_contractor', '2026-09-22']])])
    expect(lienNoticeCheckLines(both)).toHaveLength(2)
    expect(lienNoticeCheckMonths(both)).toEqual(APR_JUL)
    expect(lienNoticeCheckRowLine(both)).toBe('Notices for April to July 2026 went late or are not on record.')
    // The owner's copy alone on record: the months of either question, each once.
    const ownerOnly = check('residential', ['2026-07', '2026-08'], [notice(['2026-07', '2026-08'], [['owner', '2026-10-01']])])
    expect(ownerOnly.ownerLate).toEqual(['2026-07'])
    expect(ownerOnly.contractorMissing).toEqual(['2026-07', '2026-08'])
    expect(lienNoticeCheckRowLine(ownerOnly)).toBe('Notices for July and August 2026 went late or are not on record.')
  })
  it('says one month in the singular, and nothing when every month has a timely notice to both', () => {
    expect(lienNoticeCheckRowLine(check('residential', ['2026-07'], []))).toBe('The notice for July 2026 went late or is not on record.')
    const clear = check('residential', ['2026-08'], [notice(['2026-08'], [['owner', '2026-10-01'], ['original_contractor', '2026-10-01']])])
    expect(lienNoticeCheckFlags(clear)).toBe(false)
    expect(lienNoticeCheckRowLine(clear)).toBe('')
    expect(lienNoticeCheckRowLine(check('residential', ['2026-08'], [], false))).toBe('')
  })
  it('reads three or more months in a row as a span, and lists the rest', () => {
    expect(noticeMonthsSpanWords(APR_JUL)).toBe('April to July 2026')
    expect(noticeMonthsSpanWords(['2026-07', '2026-05', '2026-06', '2026-06'])).toBe('May to July 2026')
    expect(noticeMonthsSpanWords(['2026-11', '2026-12', '2027-01'])).toBe('November 2026 to January 2027')
    expect(noticeMonthsSpanWords(['2026-06', '2026-07'])).toBe('June and July 2026')
    expect(noticeMonthsSpanWords(['2026-04', '2026-05', '2026-07'])).toBe('April, May and July 2026')
    expect(noticeMonthsSpanWords(['2026-07'])).toBe('July 2026')
    expect(noticeMonthsSpanWords(['bad'])).toBe('')
  })
  it('follows the plain-words rules', () => {
    for (const months of [APR_JUL, ['2026-07'], ['2026-04', '2026-05', '2026-07'], ['2026-11', '2026-12', '2027-01']]) {
      const s = lienNoticeCheckRowLine(check('residential', months, []))
      expect(plainWordsFailures(s), s).toEqual([])
    }
  })
})

describe('the months an affidavit swears, as keys', () => {
  const facts = { jobName: '', jobAddress: '18 Sample Ln', isSub: true, originalContractorName: 'Ridgeway Builders', originalContractorAddress: '', ownerName: 'O', ownerAddress: 'A', county: 'Alder', legalDescription: 'Lot 1', customerName: 'Ridgeway Builders', revenue: 100, paymentsMade: 0, lastMonth: '2026-08', contactPerson: 'R', issuer: null, noticesRecorded: true, todayYmd: '2026-11-11' }
  const filings = [notice(['2026-04', '2026-06', '2026-07', '2026-08'], [['owner', '2026-09-22']])]
  it('are the noticed months inside the job’s own span, the ones the short form prints in words', () => {
    const days = { first_work_date: '2026-07-06', last_work_date: '2026-08-20', lien_last_work_on: null }
    expect(lienAffidavitSwornMonths({ ...facts, workDays: days, filings })).toEqual(['2026-07', '2026-08'])
    expect(buildLienAffidavitFieldsForJob({ ...facts, workDays: days, filings }).workMonthsWords).toBe('July and August 2026')
    expect(lienAffidavitSwornMonths({ ...facts, isSub: false, workDays: days, filings })).toEqual([])
  })
})
