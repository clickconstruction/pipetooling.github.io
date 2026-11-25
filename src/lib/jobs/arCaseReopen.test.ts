import { describe, expect, it } from 'vitest'
import type { ArReturnCaseRow } from './arReturnCase'
import { AR_CASE_REOPENED, arCaseIsOnTestJobs, arCaseJobs, arCaseReopenCall, arCaseReopenConfirm, arCaseReopenDrawn, arCaseReopenProblem, arClosedOthersWords, arClosedTestCases } from './arCaseReopen'

const job = (id: string, name: string) => ({ job_id: id, job_number: '900', job_name: name })
const row = (over: Partial<ArReturnCaseRow> = {}): ArReturnCaseRow => ({
  mercury_transaction_id: 'case-1',
  counterparty_name: 'ZZ Test Payer',
  amount: 125,
  kind: 'checkDeposit',
  posted_at: '2026-11-20T15:00:00Z',
  failed_at: '2026-11-22T15:00:00Z',
  bank_reason: null,
  source: 'bank',
  opened_at: '2026-11-22T15:00:00Z',
  closed_at: '2026-11-24T18:00:00Z',
  closed_reason: 'not_coming',
  closed_note: 'ZZ TEST walk',
  closed_by: 'Priya',
  replaced_by_mercury_transaction_id: null,
  notified_at: null,
  live_payments: [],
  last_job: { ...job('j-zz', 'ZZ TEST walk job'), removed_at: null, removed_by: null },
  recorded_payment: null,
  ...over,
})
const REAL = { ...job('j-real', 'Larkfield Lot 9'), removed_at: null, removed_by: null }

describe('arCaseReopenDrawn', () => {
  it('draws the list for a dev and for no other role', () => {
    expect(arCaseReopenDrawn('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(arCaseReopenDrawn(role)).toBe(false)
  })
})

describe('arCaseJobs and arCaseIsOnTestJobs', () => {
  it('reads every job a case names, once each', () => {
    const r = row({
      live_payments: [
        { ...job('j-a', 'ZZ Test A'), payment_id: 'p1', amount: 50, invoice_id: null },
        { ...job('j-a', 'ZZ Test A'), payment_id: 'p2', amount: 75, invoice_id: null },
      ],
      last_job: { ...job('j-b', 'ZZ Test B'), removed_at: null, removed_by: null },
      recorded_payment: { ...job('j-c', 'ZZ Test C'), payment_id: 'p3', amount: 125, paid_on: null },
    })
    expect(arCaseJobs(r).map((j) => j.job_id)).toEqual(['j-a', 'j-b', 'j-c'])
    expect(arCaseIsOnTestJobs(r)).toBe(true)
  })
  it('is no test case when one of its jobs is real, or when it names none', () => {
    expect(arCaseIsOnTestJobs(row({ live_payments: [{ ...job('j-real', 'Larkfield Lot 9'), payment_id: 'p1', amount: 50, invoice_id: null }] }))).toBe(false)
    expect(arCaseIsOnTestJobs(row({ last_job: null }))).toBe(false)
  })
  it('reads the job of a Stripe case', () => {
    const stripe_case = { ...job('j-zz', 'zz test card job'), kind: 'dispute' as const, object_id: 'dp_test', mode: 'test', status: 'lost', due_by: null, lost_at: null, lost_notified_at: null, amount: 125, invoice_id: null, invoice_sequence_order: null, invoice_status: null, payment_live: false }
    expect(arCaseIsOnTestJobs(row({ source: 'stripe_dispute', last_job: null, stripe_case }))).toBe(true)
  })
})

describe('arCaseReopenProblem', () => {
  it('lets a test case the office closed by hand reopen', () => {
    expect(arCaseReopenProblem(row())).toBe('')
    expect(arCaseReopenProblem(row({ closed_reason: 'settled_other_way' }))).toBe('')
  })
  it('refuses a case on a real job', () => {
    expect(arCaseReopenProblem(row({ last_job: REAL }))).toBe('Only a case on a test job can be reopened. This one names a real job.')
    expect(arCaseReopenProblem(row({ live_payments: [{ ...job('j-real', 'Larkfield Lot 9'), payment_id: 'p1', amount: 50, invoice_id: null }] }))).toMatch(/names a real job/)
  })
  it('refuses a case that names no job', () => {
    expect(arCaseReopenProblem(row({ last_job: null }))).toBe('This case names no job, so it cannot be told from a real one. It stays closed.')
  })
  it('refuses a case closed for a reason a reopen does not undo', () => {
    for (const closed_reason of ['replaced', 'won', 'bill_put_back', null]) expect(arCaseReopenProblem(row({ closed_reason }))).toBe('Only a case closed as settled another way or as not coming can be reopened.')
  })
  it('refuses an open case and a case that is gone', () => {
    expect(arCaseReopenProblem(row({ closed_at: null, closed_reason: null }))).toBe('This case is open already.')
    expect(arCaseReopenProblem(null)).toBe('The case is not there any more. Read the page again.')
  })
})

describe('arCaseReopenCall', () => {
  it('names the function of the table the case lives in', () => {
    expect(arCaseReopenCall({ mercury_transaction_id: 'mtx-1', source: 'bank' })).toEqual({ fn: 'reopen_ar_return_case', args: { p_mercury_transaction_id: 'mtx-1' } })
    expect(arCaseReopenCall({ mercury_transaction_id: 'mtx-1', source: 'hand' })).toEqual({ fn: 'reopen_ar_return_case', args: { p_mercury_transaction_id: 'mtx-1' } })
    expect(arCaseReopenCall({ mercury_transaction_id: 'c-1', source: 'unbanked' })).toEqual({ fn: 'reopen_ar_unbanked_check_case', args: { p_case_id: 'c-1' } })
    expect(arCaseReopenCall({ mercury_transaction_id: 'c-2', source: 'stripe_dispute' })).toEqual({ fn: 'reopen_ar_stripe_case', args: { p_case_id: 'c-2' } })
    expect(arCaseReopenCall({ mercury_transaction_id: 'c-3', source: 'stripe_debit' })).toEqual({ fn: 'reopen_ar_stripe_case', args: { p_case_id: 'c-3' } })
  })
})

describe('arClosedTestCases', () => {
  it('lists the closed cases on test jobs, newest closed first, and counts the rest', () => {
    const { lines, others } = arClosedTestCases([
      row({ mercury_transaction_id: 'older', closed_at: '2026-11-23T18:00:00Z', closed_reason: 'settled_other_way', closed_note: null }),
      row({ mercury_transaction_id: 'newer' }),
      row({ mercury_transaction_id: 'open', closed_at: null, closed_reason: null }),
      row({ mercury_transaction_id: 'real', last_job: REAL }),
      row({ mercury_transaction_id: 'no-job', last_job: null }),
    ])
    expect(lines.map((l) => l.id)).toEqual(['newer', 'older'])
    expect(others).toBe(2)
    expect(lines[0]).toEqual({ id: 'newer', payer: 'ZZ Test Payer', amount: 125, closedWords: 'Closed as not coming on Tue, Nov 24. ZZ TEST walk', jobWords: 'ZZ TEST walk job', problem: '' })
    expect(lines[1]!.closedWords).toBe('Closed as settled another way on Mon, Nov 23.')
  })
  it('lists a test case closed as replaced with why it stays', () => {
    const { lines } = arClosedTestCases([row({ closed_reason: 'replaced', counterparty_name: null, amount: '88.50' })])
    expect(lines[0]!.problem).toBe('Only a case closed as settled another way or as not coming can be reopened.')
    expect(lines[0]!.closedWords).toContain('Closed as replaced by a new payment')
    expect(lines[0]!.payer).toBe('No name on record')
    expect(lines[0]!.amount).toBe(88.5)
  })
})

describe('the words', () => {
  it('says what the list leaves out, with a count', () => {
    expect(arClosedOthersWords(0)).toBe('')
    expect(arClosedOthersWords(1)).toBe('1 closed case is not listed. Only a case on a test job can be reopened here.')
    expect(arClosedOthersWords(14)).toBe('14 closed cases are not listed. Only a case on a test job can be reopened here.')
  })
  it('names the act on the confirm button, never OK', () => {
    const c = arCaseReopenConfirm({ payer: 'ZZ Test Payer' })
    expect(c.confirmLabel).toBe('Reopen the case')
    expect(c.title).toBe('Reopen the case of ZZ Test Payer?')
    expect(c.message).toContain('goes back under Came back')
    expect(AR_CASE_REOPENED).toBe('The case is open again. It is under Came back.')
  })
})
