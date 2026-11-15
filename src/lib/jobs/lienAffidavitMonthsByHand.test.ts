import { describe, expect, it } from 'vitest'
import { lienAffidavitMonthChoiceWords, lienAffidavitMonthChoices, lienAffidavitMonthKeyFromText, lienAffidavitMonthsByHandCheck, lienAffidavitMonthsByHandProblem, lienAffidavitMonthsByHandSaveWords, lienAffidavitMonthsByHandWords, lienAffidavitMonthsCleaned, parseLienAffidavitMonthsByHand } from './lienAffidavitMonthsByHand'
import { lienAffidavitSwornMonths } from './lienAffidavitNotices'
import { buildLienAffidavitFieldsForJob } from './lienNoticeDraft'
import { formatYmdMonthDay } from './billedExpectedPay'
import { plainWordsFailures } from '../plainWords'

const ROW = { job_id: 'j1', months: ['2026-08', '2026-04', '2026-04', 'bad'], reason: 'Counsel, Nov 14: the notice’s total covered this job.', set_by_name: 'Robert', set_at: '2026-11-14T17:00:00Z' }

describe('the months set by hand (v2.7270, punch list #356 part 2)', () => {
  it('reads the row with its months cleaned and oldest first, and nothing from a row with no month', () => {
    expect(parseLienAffidavitMonthsByHand(ROW)).toEqual({ jobId: 'j1', months: ['2026-04', '2026-08'], reason: ROW.reason, setByName: 'Robert', setAt: ROW.set_at })
    expect(parseLienAffidavitMonthsByHand({ ...ROW, months: ['bad'] })).toBeNull()
    expect(parseLienAffidavitMonthsByHand(null)).toBeNull()
    expect(lienAffidavitMonthsCleaned(['2026-13', '2026-09', 3, '2026-09'])).toEqual(['2026-09'])
  })

  it('takes a typed month three ways', () => {
    expect(lienAffidavitMonthKeyFromText('2026-09')).toBe('2026-09')
    expect(lienAffidavitMonthKeyFromText('9/2026')).toBe('2026-09')
    expect(lienAffidavitMonthKeyFromText('Sep 2026')).toBe('2026-09')
    expect(lienAffidavitMonthKeyFromText('September 2026')).toBe('2026-09')
    expect(lienAffidavitMonthKeyFromText('13/2026')).toBe('')
    expect(lienAffidavitMonthKeyFromText('soon')).toBe('')
  })

  it('offers the job’s work months, the notice’s and the months already set, each with where it comes from', () => {
    const choices = lienAffidavitMonthChoices({ work: ['2026-09'], named: ['2026-04', '2026-06', '2026-07', '2026-08'], current: ['2026-08', '2026-10'] })
    expect(choices.map((c) => [c.key, c.from])).toEqual([['2026-04', 'notice'], ['2026-06', 'notice'], ['2026-07', 'notice'], ['2026-08', 'notice'], ['2026-09', 'work'], ['2026-10', 'added']])
    expect(lienAffidavitMonthChoices({ work: ['2026-08'], named: ['2026-08'], current: [] })[0]).toMatchObject({ from: 'both', label: 'Aug 2026' })
    expect(lienAffidavitMonthChoiceWords('both')).toBe('worked · on the notice')
  })

  it('needs a month and counsel’s reason, and the press counts the months', () => {
    expect(lienAffidavitMonthsByHandProblem([], 'x')).toBe('Tick at least one month.')
    expect(lienAffidavitMonthsByHandProblem(['2026-09'], '  ')).toBe('Type counsel’s reason: who said the paper may name these months, and when.')
    expect(lienAffidavitMonthsByHandProblem(['2026-09'], 'Counsel said so on Nov 14.')).toBeNull()
    expect(lienAffidavitMonthsByHandSaveWords(['2026-09'])).toBe('Set 1 month by hand')
    expect(lienAffidavitMonthsByHandSaveWords(['2026-08', '2026-09'])).toBe('Set 2 months by hand')
    expect(lienAffidavitMonthsByHandSaveWords([])).toBe('Set the months by hand')
  })

  it('the line and the help sheet’s row name the months, who, when and the reason', () => {
    const m = parseLienAffidavitMonthsByHand(ROW)!
    expect(lienAffidavitMonthsByHandWords(m, formatYmdMonthDay)).toBe('Months set by hand: April and August 2026 · Robert · Nov 14 · Counsel, Nov 14: the notice’s total covered this job.')
    const check = lienAffidavitMonthsByHandCheck(m, formatYmdMonthDay)
    expect(check).toEqual({ lead: 'Months set by hand.', words: 'The paper names April and August 2026, set by Robert on Nov 14. The reason given: Counsel, Nov 14: the notice’s total covered this job.', row: 'Months set by hand: April and August 2026.' })
    expect(plainWordsFailures(check.row)).toEqual([])
  })

  it('the paper swears the months set by hand in place of the record’s, and prints them', () => {
    const facts = { jobName: '', jobAddress: '18 Sample Ln', isSub: true, originalContractorName: 'Ridgeway Builders', originalContractorAddress: '', ownerName: 'O', ownerAddress: 'A', county: 'Alder', legalDescription: 'Lot 1', customerName: 'Ridgeway Builders', revenue: 100, paymentsMade: 0, lastMonth: '2026-09', contactPerson: 'R', issuer: null, noticesRecorded: true, todayYmd: '2026-11-14', workDays: { first_work_date: null, last_work_date: null, lien_last_work_on: '2026-09-11' } }
    const filings = [{ kind: 'notice_53_056', months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', sent_on: '2026-09-22' }], voided_at: null }]
    expect(lienAffidavitSwornMonths({ ...facts, filings })).toEqual([])
    expect(lienAffidavitSwornMonths({ ...facts, filings, monthsByHand: ['2026-08', '2026-04'] })).toEqual(['2026-04', '2026-08'])
    expect(buildLienAffidavitFieldsForJob({ ...facts, filings, monthsByHand: ['2026-04', '2026-08'] }).workMonthsWords).toBe('April and August 2026')
    // An empty list is no setting: the record's months stand.
    expect(lienAffidavitSwornMonths({ ...facts, filings, monthsByHand: [] })).toEqual([])
    expect(lienAffidavitSwornMonths({ ...facts, isSub: false, filings, monthsByHand: ['2026-04'] })).toEqual([])
  })
})
