import { describe, expect, it } from 'vitest'
import type { ArReturnCaseRow } from './arReturnCase'
import { AR_CASE_REOPENED, arCaseJobs, arCaseReopenCall, arCaseReopenConfirm, arCaseReopenDrawn, arCaseReopenProblem, arClosedCases, arClosedCasesShown, arClosedOlderLabel, arClosedOthersWords } from './arCaseReopen'

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
  it('draws the list for the four roles the reopen functions let in', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) expect(arCaseReopenDrawn(role)).toBe(true)
  })
  it('draws nothing for an estimator or any other role', () => {
    for (const role of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(arCaseReopenDrawn(role)).toBe(false)
  })
})

describe('arCaseJobs', () => {
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
  })
  it('reads the job of a Stripe case', () => {
    const stripe_case = { ...job('j-zz', 'zz test card job'), kind: 'dispute' as const, object_id: 'dp_test', mode: 'test', status: 'lost', due_by: null, lost_at: null, lost_notified_at: null, amount: 125, invoice_id: null, invoice_sequence_order: null, invoice_status: null, payment_live: false }
    expect(arCaseJobs(row({ source: 'stripe_dispute', last_job: null, stripe_case })).map((j) => j.job_id)).toEqual(['j-zz'])
  })
})

describe('arCaseReopenProblem', () => {
  it('lets a case the office closed by hand reopen', () => {
    expect(arCaseReopenProblem(row())).toBe('')
    expect(arCaseReopenProblem(row({ closed_reason: 'settled_other_way' }))).toBe('')
  })
  it('lets a case on a real job reopen, and one that names no job', () => {
    expect(arCaseReopenProblem(row({ last_job: REAL }))).toBe('')
    expect(arCaseReopenProblem(row({ live_payments: [{ ...job('j-real', 'Larkfield Lot 9'), payment_id: 'p1', amount: 50, invoice_id: null }] }))).toBe('')
    expect(arCaseReopenProblem(row({ last_job: null }))).toBe('')
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

describe('arClosedCases', () => {
  const TODAY = '2026-11-25'
  it('lists the cases closed by hand on any job, newest closed first, and counts the rest', () => {
    const { lines, others } = arClosedCases(
      [
        row({ mercury_transaction_id: 'older', closed_at: '2026-11-23T18:00:00Z', closed_reason: 'settled_other_way', closed_note: null }),
        row({ mercury_transaction_id: 'newer' }),
        row({ mercury_transaction_id: 'open', closed_at: null, closed_reason: null }),
        row({ mercury_transaction_id: 'real', closed_at: '2026-11-21T18:00:00Z', last_job: REAL }),
        row({ mercury_transaction_id: 'no-job', closed_at: '2026-11-20T18:00:00Z', last_job: null }),
        row({ mercury_transaction_id: 'replaced', closed_reason: 'replaced' }),
        row({ mercury_transaction_id: 'won', closed_reason: 'won' }),
      ],
      TODAY,
    )
    expect(lines.map((l) => l.id)).toEqual(['newer', 'older', 'real', 'no-job'])
    expect(others).toBe(2)
    expect(lines[0]).toEqual({ id: 'newer', payer: 'ZZ Test Payer', amount: 125, closedWords: 'Closed as not coming on Tue, Nov 24. ZZ TEST walk', jobWords: 'ZZ TEST walk job', older: false })
    expect(lines[1]!.closedWords).toBe('Closed as settled another way on Mon, Nov 23.')
    expect(lines[2]!.jobWords).toBe('Larkfield Lot 9')
    expect(lines[3]!.jobWords).toBe('')
  })
  it('reads a case with no name and an amount sent as text', () => {
    const { lines } = arClosedCases([row({ counterparty_name: null, amount: '88.50' })], TODAY)
    expect(lines[0]!.payer).toBe('No name on record')
    expect(lines[0]!.amount).toBe(88.5)
  })
  it('marks a case closed more than 90 days ago as older, and one closed 90 days ago as not', () => {
    const { lines } = arClosedCases(
      [
        row({ mercury_transaction_id: 'day-90', closed_at: '2026-08-27T18:00:00Z' }),
        row({ mercury_transaction_id: 'day-91', closed_at: '2026-08-26T18:00:00Z' }),
      ],
      TODAY,
    )
    expect(lines.map((l) => [l.id, l.older])).toEqual([
      ['day-90', false],
      ['day-91', true],
    ])
  })
})

describe('arClosedCasesShown', () => {
  const line = (id: string, older: boolean) => ({ id, payer: 'ZZ Test Payer', amount: 1, closedWords: '', jobWords: '', older })
  it('draws the recent ones and counts the folded', () => {
    const got = arClosedCasesShown([line('a', false), line('b', true), line('c', true)], false)
    expect(got.shown.map((l) => l.id)).toEqual(['a'])
    expect(got.folded).toBe(2)
  })
  it('draws every one once Show older is pressed', () => {
    const got = arClosedCasesShown([line('a', false), line('b', true)], true)
    expect(got.shown.map((l) => l.id)).toEqual(['a', 'b'])
    expect(got.folded).toBe(0)
  })
  it('draws the older ones at once when nothing is recent', () => {
    const got = arClosedCasesShown([line('b', true), line('c', true)], false)
    expect(got.shown.map((l) => l.id)).toEqual(['b', 'c'])
    expect(got.folded).toBe(0)
  })
  it('names the press with its count', () => {
    expect(arClosedOlderLabel(1)).toBe('Show 1 older case')
    expect(arClosedOlderLabel(12)).toBe('Show 12 older cases')
  })
})

describe('the words', () => {
  it('says what the list leaves out, with a count', () => {
    expect(arClosedOthersWords(0)).toBe('')
    expect(arClosedOthersWords(1)).toBe('1 closed case is not listed. A case closed by a new payment or by Stripe’s answer stays closed.')
    expect(arClosedOthersWords(14)).toBe('14 closed cases are not listed. A case closed by a new payment or by Stripe’s answer stays closed.')
  })
  it('names the act on the confirm button, never OK', () => {
    const c = arCaseReopenConfirm({ payer: 'ZZ Test Payer' })
    expect(c.confirmLabel).toBe('Reopen the case')
    expect(c.title).toBe('Reopen the case of ZZ Test Payer?')
    expect(c.message).toContain('goes back under Came back')
    expect(c.message).toContain('It stands open there until someone closes it again.')
    expect(AR_CASE_REOPENED).toBe('The case is open again. It is under Came back.')
  })
})
