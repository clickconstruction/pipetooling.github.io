import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { plainWordsFailures } from '../plainWords'
import type { BankCheck } from './checkCleared'
import { PAYOFF_RETURNED_WORDS, paymentsOnReturnedCheck, payoffReturnedView, releaseOnReturnedCheck, returnedCaseJobs, returnedReleaseCase, type PayoffReturnedInput, type ReleasePrint, type ReturnedLienTarget, type ReturnedMarkPayment } from './payoffReturned'

// Every name, address, job, instrument, check and amount here is made up.

/** Check 1184 for two liens at one place, deposited Nov 24. The paying bank sent it back. */
const DEPOSIT: BankCheck = { id: 'dep1', amount: 12580.5, status: 'failed', depositedYmd: '2026-11-24', postedYmd: '2026-11-25', bankDayYmd: '2026-12-02', checkNumber: '01184', failureReason: 'Insufficient funds' }
const typed = (id: string, job: string, amount: number, over: Partial<ReturnedMarkPayment> = {}): ReturnedMarkPayment => ({ id, job_id: job, amount, paid_on: '2026-11-24', payment_type: 'Check', reference_number: '1184', mercury_transaction_id: null, ...over })

const lien = (id: string, job: string, instrument: string): ReturnedLienTarget['affidavit'] => ({ id, job_id: job, county: 'Travis', recording_number: instrument, filed_at: '2026-11-09' })
const A1 = lien('a1', 'j1', '2026-0412207')
const A2 = lien('a2', 'j2', '2026-0412208')
const SAVED = { id: 'r1', created_at: '2026-11-25T16:00:00Z', filed_at: null, fields: { releasesFilingId: 'a1' } }
const RECORDED = { id: 'r1', created_at: '2026-11-25T16:00:00Z', filed_at: '2026-12-03', fields: { releasesFilingId: 'a1', releaseInstrument: '2026-0431955' } }
const PRINT: ReleasePrint = { jobId: 'j1', printedAt: '2026-11-25T17:30:00Z', by: 'Alex Rivera' }

const input = (over: Partial<PayoffReturnedInput> = {}): PayoffReturnedInput => ({
  jobs: [
    { jobId: 'j1', stand: 'counted' },
    { jobId: 'j2', stand: 'counted' },
  ],
  labelByJob: { j1: '#2041 Okafor main house', j2: '#2058 Okafor service visit' },
  targets: [
    { affidavit: A1, release: null },
    { affidavit: A2, release: null },
  ],
  prints: [],
  checkNumber: '1184',
  ...over,
})
const view = (over: Partial<PayoffReturnedInput> = {}) => {
  const v = payoffReturnedView(input(over))
  if (!v) throw new Error('expected a view')
  return v
}

describe('payoffReturnedView, none printed', () => {
  it('says no release has left when none is saved, and the liens stay on record', () => {
    const v = view()
    expect(v.liens.map((l) => l.case)).toEqual(['none', 'none'])
    expect(v.liens.map((l) => l.chip)).toEqual([
      { text: PAYOFF_RETURNED_WORDS.onRecord, tone: 'plain' },
      { text: PAYOFF_RETURNED_WORDS.onRecord, tone: 'plain' },
    ])
    expect(plainSentence(v.liens[0]!.say)).toBe('No release has been made. The lien stays on record until a payment holds.')
    expect(plainSentence(v.line)).toBe('No release has left the office. 2 filed liens stay on record.')
    expect(v.tone).toBe('amber')
    expect(v.counsel).toBe(false)
  })

  it('holds a release that is saved and was never printed', () => {
    const v = view({ targets: [{ affidavit: A1, release: SAVED }, { affidavit: A2, release: null }] })
    const held = v.liens.find((l) => l.affidavitId === 'a1')!
    expect(held.case).toBe('none')
    expect(held.chip).toEqual({ text: PAYOFF_RETURNED_WORDS.held, tone: 'amber' })
    expect(plainSentence(held.say)).toBe('A release was saved Nov 25 and never printed. Do not print it until a payment holds.')
    expect(plainSentence(v.line)).toBe('No release has left the office. 2 filed liens stay on record. 1 saved release waits.')
  })

  it('does not count a print older than the lien, which was for an earlier filing', () => {
    const old: ReleasePrint = { jobId: 'j1', printedAt: '2026-10-01T15:00:00Z', by: 'Alex Rivera' }
    expect(returnedReleaseCase({ affidavit: A1, release: null }, [old])).toBe('none')
  })
})

describe('payoffReturnedView, printed', () => {
  it('reads Do not record, with the day it was printed and by whom', () => {
    const v = view({ targets: [{ affidavit: A1, release: SAVED }, { affidavit: A2, release: null }], prints: [PRINT] })
    const printed = v.liens[0]!
    expect(printed.affidavitId).toBe('a1')
    expect(printed.case).toBe('printed')
    expect(printed.chip).toEqual({ text: PAYOFF_RETURNED_WORDS.doNotRecord, tone: 'red' })
    expect(plainSentence(printed.say)).toBe('A release was printed Nov 25 by Alex Rivera. Do not record it. Find the paper and keep it back from the county.')
    expect(plainSentence(v.line)).toBe('1 release is printed on check 1184. Do not record it.')
    expect(v.tone).toBe('red')
    expect(v.counsel).toBe(false)
    // The other job's lien has no print of its own.
    expect(v.liens[1]!.case).toBe('none')
  })

  it('counts a paper that was printed and never saved', () => {
    const v = view({ prints: [PRINT] })
    expect(v.liens[0]!.case).toBe('printed')
    expect(plainSentence(v.liens[0]!.say)).toBe('A release was printed Nov 25 by Alex Rivera. It was never saved. Do not record it. Find the paper and keep it back from the county.')
  })

  it('takes the newest print, and reads the day in the company’s calendar', () => {
    const late: ReleasePrint = { jobId: 'j1', printedAt: '2026-11-27T03:30:00Z', by: '' }
    const v = view({ targets: [{ affidavit: A1, release: SAVED }], prints: [PRINT, late] })
    // 03:30 UTC on Nov 27 is the evening of Nov 26 in the company's calendar.
    expect(plainSentence(v.liens[0]!.say)).toBe('A release was printed Nov 26. Do not record it. Find the paper and keep it back from the county.')
  })

  it('treats a saved release as printed when the copies could not be read', () => {
    const v = view({ targets: [{ affidavit: A1, release: SAVED }, { affidavit: A2, release: null }], prints: null })
    expect(v.liens.map((l) => l.case)).toEqual(['printed', 'none'])
    expect(plainSentence(v.liens[0]!.say)).toBe('A release is saved and may have been printed. Do not record it. Keep the paper back from the county.')
    expect(v.printsUnread).toBe(true)
  })
})

describe('payoffReturnedView, recorded', () => {
  it('reads Released, money came back, with the county’s day and number, and sends it to counsel', () => {
    const v = view({ targets: [{ affidavit: A1, release: RECORDED }, { affidavit: A2, release: null }], prints: [PRINT] })
    const recorded = v.liens[0]!
    expect(recorded.case).toBe('recorded')
    expect(recorded.chip).toEqual({ text: PAYOFF_RETURNED_WORDS.moneyBack, tone: 'red' })
    expect(plainSentence(recorded.say)).toBe('The county recorded the release Dec 3 as 2026-0431955. The app cannot undo that. Ask counsel what to do.')
    expect(plainSentence(v.line)).toBe('1 release is recorded on check 1184. Ask counsel.')
    expect(v.counsel).toBe(true)
    expect(v.tone).toBe('red')
  })

  it('puts a recorded release first, then a printed one, and names both in the line', () => {
    const v = view({
      targets: [
        { affidavit: A2, release: { ...SAVED, id: 'r2', fields: { releasesFilingId: 'a2' } } },
        { affidavit: A1, release: RECORDED },
      ],
      prints: [{ ...PRINT, jobId: 'j2' }],
    })
    expect(v.liens.map((l) => l.case)).toEqual(['recorded', 'printed'])
    expect(plainSentence(v.line)).toBe('1 release is recorded on check 1184. Ask counsel. 1 more is printed. Do not record it.')
  })

  it('says the check with no number as the check', () => {
    const v = view({ targets: [{ affidavit: A1, release: { ...RECORDED, fields: {} } }], checkNumber: '' })
    expect(plainSentence(v.line)).toBe('1 release is recorded on the check. Ask counsel.')
    expect(plainSentence(v.liens[0]!.say)).toBe('The county recorded the release Dec 3. The app cannot undo that. Ask counsel what to do.')
  })
})

describe('payoffReturnedView, the jobs', () => {
  it('says nothing when none of the check’s jobs holds a filed lien', () => {
    expect(payoffReturnedView(input({ targets: [] }))).toBeNull()
    expect(payoffReturnedView(input({ jobs: [{ jobId: 'j9', stand: 'counted' }] }))).toBeNull()
    expect(payoffReturnedView(input({ targets: [{ affidavit: { ...A1, filed_at: null }, release: null }] }))).toBeNull()
  })

  it('names a job the check was typed on by hand, which the case’s take off does not reach', () => {
    const v = view({ jobs: [{ jobId: 'j1', stand: 'typed' }, { jobId: 'j2', stand: 'off' }] })
    const byJob = Object.fromEntries(v.liens.map((l) => [l.jobId, l.typed && plainSentence(l.typed)]))
    expect(byJob).toEqual({ j1: 'Check 1184 still counts as paid on this job. Take it off on the job’s Bill tab.', j2: null })
  })

  it('keeps every sentence to plain words', () => {
    const all = [
      view(),
      view({ targets: [{ affidavit: A1, release: SAVED }], prints: [PRINT] }),
      view({ targets: [{ affidavit: A1, release: SAVED }], prints: null }),
      view({ targets: [{ affidavit: A1, release: RECORDED }, { affidavit: A2, release: SAVED }], prints: [{ ...PRINT, jobId: 'j2' }], jobs: [{ jobId: 'j1', stand: 'typed' }, { jobId: 'j2', stand: 'typed' }] }),
    ]
    for (const v of all) {
      for (const s of [v.line, ...v.liens.flatMap((l) => [l.say, l.typed ?? ''])]) expect(plainWordsFailures(plainSentence(s))).toEqual([])
    }
    for (const s of [PAYOFF_RETURNED_WORDS.unread, PAYOFF_RETURNED_WORDS.printsUnread, PAYOFF_RETURNED_WORDS.reading]) expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('returnedCaseJobs', () => {
  const none = { takeOff: null, recorded: null, billsItPaid: [], promiseJob: null }

  it('takes the jobs that still count the check, the ones typed by hand, and the ones it came off', () => {
    const jobs = returnedCaseJobs({ takeOff: { jobs: [{ jobId: 'j1' }] }, recorded: null, billsItPaid: [{ jobId: 'j3' }], promiseJob: { jobId: 'j3' } }, [{ job_id: 'j2' }])
    expect(jobs).toEqual([
      { jobId: 'j1', stand: 'counted' },
      { jobId: 'j2', stand: 'typed' },
      { jobId: 'j3', stand: 'off' },
    ])
  })

  it('names a job once: a payment the case knows wins over the mark, and either wins over taken off', () => {
    expect(returnedCaseJobs({ ...none, takeOff: { jobs: [{ jobId: 'j1' }] }, billsItPaid: [{ jobId: 'j1' }] }, [{ job_id: 'j1' }])).toEqual([{ jobId: 'j1', stand: 'counted' }])
    expect(returnedCaseJobs({ ...none, billsItPaid: [{ jobId: 'j1' }] }, [{ job_id: 'j1' }])).toEqual([{ jobId: 'j1', stand: 'typed' }])
    expect(returnedCaseJobs({ ...none, recorded: { jobId: 'j4' } }, [])).toEqual([{ jobId: 'j4', stand: 'counted' }])
  })

  it('is empty for a check on no job', () => {
    expect(returnedCaseJobs(none, [])).toEqual([])
  })
})

describe('paymentsOnReturnedCheck, the check’s mark', () => {
  it('finds the payments one check was typed as, across jobs, by its number', () => {
    const found = paymentsOnReturnedCheck(DEPOSIT, [typed('p1', 'j1', 7420), typed('p2', 'j2', 5160.5), typed('p3', 'j7', 300, { reference_number: '2290' })])
    expect(found.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('leaves out a payment already linked to a deposit, cash, and a check of another number', () => {
    const found = paymentsOnReturnedCheck(DEPOSIT, [
      typed('p1', 'j1', 7420, { mercury_transaction_id: 'dep1' }),
      typed('p2', 'j2', 5160.5, { payment_type: 'Cash' }),
      typed('p3', 'j3', 100, { reference_number: '1185' }),
    ])
    expect(found).toEqual([])
  })

  it('refuses a group that comes to more than the check', () => {
    expect(paymentsOnReturnedCheck(DEPOSIT, [typed('p1', 'j1', 7420), typed('p2', 'j2', 5160.5), typed('p3', 'j3', 0.01)])).toEqual([])
  })

  it('picks the group that comes to the check exactly over another payer’s check of the same number', () => {
    const other = [typed('x1', 'j8', 900, { paid_on: '2026-11-23' })]
    const found = paymentsOnReturnedCheck(DEPOSIT, [...other, typed('p1', 'j1', 7420), typed('p2', 'j2', 5160.5)])
    expect(found.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('with no exact group, picks the one typed nearest the deposit’s day', () => {
    const found = paymentsOnReturnedCheck(DEPOSIT, [typed('far', 'j8', 900, { paid_on: '2026-10-20' }), typed('near', 'j1', 7420, { paid_on: '2026-11-23' })])
    expect(found.map((p) => p.id)).toEqual(['near'])
  })

  it('reads nothing without a deposit, or when the bank read no number off the check', () => {
    expect(paymentsOnReturnedCheck(null, [typed('p1', 'j1', 7420)])).toEqual([])
    expect(paymentsOnReturnedCheck({ ...DEPOSIT, checkNumber: '' }, [typed('p1', 'j1', 7420)])).toEqual([])
  })
})

describe('releaseOnReturnedCheck', () => {
  it('is true only when the bank says the payment came back', () => {
    expect(releaseOnReturnedCheck({ state: 'came_back' })).toBe(true)
    for (const state of ['cleared', 'posted', 'at_bank', 'late', 'unread', 'no_deposit', 'not_check'] as const) expect(releaseOnReturnedCheck({ state })).toBe(false)
    expect(releaseOnReturnedCheck(null)).toBe(false)
  })
})
