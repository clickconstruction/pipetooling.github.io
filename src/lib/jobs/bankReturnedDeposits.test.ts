import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BANK_RETURN_REASON_PHRASES,
  isBankReturnReason,
  bankReturnedBadgeTitle,
  bankReturnedBadgeWords,
  bankReturnedByJob,
  bankReturnedChipWords,
  jobLabelForBankReturn,
  mercuryBankReturn,
  mercuryBankReturnFromRaw,
  summarizeBankReturnedPayments,
} from './bankReturnedDeposits'
import { arReturnCaseSituation, noticeInputFromCase, type ArReturnCaseRow } from '../../../supabase/functions/_shared/bankReturnedDeposits'

describe('mercuryBankReturn', () => {
  it('is a return only when the deposit posted, then failed, and was money in', () => {
    expect(mercuryBankReturn({ status: 'failed', posted_at: '2026-09-18T22:00:58Z', amount: 13680, failureReason: 'Insufficient funds' })).toEqual({ reason: 'Insufficient funds' })
    // Processing failure: never posted (Mercury "There was an issue…"; the check was re-deposited).
    expect(mercuryBankReturn({ status: 'failed', posted_at: null, amount: 13680, failureReason: 'There was an issue with this transaction.' })).toBeNull()
    // A declined card purchase is money out.
    expect(mercuryBankReturn({ status: 'failed', posted_at: '2026-09-18T22:00:58Z', amount: -101 })).toBeNull()
    expect(mercuryBankReturn({ status: 'sent', posted_at: '2026-09-18T22:00:58Z', amount: 13680 })).toBeNull()
    expect(mercuryBankReturn({ status: ' failed ', posted_at: '2026-06-01', amount: '8000', failureReason: '  Stop payment ' })).toEqual({ reason: 'Stop payment' })
    expect(mercuryBankReturn({ status: 'failed', posted_at: '2026-06-01', amount: 275 })).toEqual({ reason: '' })
  })

  it('reads the same rule off the raw Mercury payload', () => {
    expect(mercuryBankReturnFromRaw({ status: 'failed', reasonForFailure: 'Refer to maker' }, '2025-11-03T00:00:00Z', 1380)).toEqual({ reason: 'Refer to maker' })
    expect(mercuryBankReturnFromRaw({ status: 'sent' }, '2025-11-03T00:00:00Z', 1380)).toBeNull()
    expect(mercuryBankReturnFromRaw({ status: 'failed' }, null, 1380)).toBeNull()
    expect(mercuryBankReturnFromRaw(null, '2025-11-03', 1380)).toBeNull()
    expect(mercuryBankReturnFromRaw('failed', '2025-11-03', 1380)).toBeNull()
  })
})

describe('bankReturnedChipWords', () => {
  it('names the reason when the bank gave one', () => {
    expect(bankReturnedChipWords({ reason: 'Insufficient funds' })).toBe('returned by the bank · Insufficient funds')
    expect(bankReturnedChipWords({ reason: '' })).toBe('returned by the bank')
    expect(bankReturnedChipWords(null)).toBe('returned by the bank')
  })
})

describe('summarizeBankReturnedPayments', () => {
  const tx = new Map([
    ['tx-sp', { id: 'tx-sp', status: 'failed', posted_at: '2026-09-18T22:00:58Z', amount: 13680, failure_reason: 'Insufficient funds' }],
    ['tx-dud', { id: 'tx-dud', status: 'failed', posted_at: '2026-06-01T22:01:40Z', amount: 8000, failure_reason: 'Insufficient funds' }],
    ['tx-ok', { id: 'tx-ok', status: 'sent', posted_at: '2026-09-01T00:00:00Z', amount: 500, failure_reason: null }],
    ['tx-never', { id: 'tx-never', status: 'failed', posted_at: null, amount: 11700, failure_reason: 'There was an issue with this transaction.' }],
  ])
  const jobs = new Map([
    ['j-878', { id: 'j-878', hcp_number: '878', job_name: 'Take 5 – Seguin', customer_name: 'Southern Post Construction' }],
    ['j-dud', { id: 'j-dud', hcp_number: null, job_name: null, customer_name: 'Dudley' }],
  ])

  it('lists the payments whose deposit the bank returned, biggest first, and skips everything else', () => {
    const s = summarizeBankReturnedPayments(
      [
        { id: 'p-dud', job_id: 'j-dud', amount: 8000, mercury_transaction_id: 'tx-dud' },
        { id: 'p-sp', job_id: 'j-878', amount: '13680', mercury_transaction_id: 'tx-sp' },
        { id: 'p-ok', job_id: 'j-878', amount: 500, mercury_transaction_id: 'tx-ok' },
        { id: 'p-never', job_id: 'j-878', amount: 11700, mercury_transaction_id: 'tx-never' },
        { id: 'p-hand', job_id: 'j-878', amount: 100, mercury_transaction_id: null },
        { id: 'p-gone', job_id: 'j-878', amount: 100, mercury_transaction_id: 'tx-missing' },
      ],
      tx,
      jobs,
    )
    expect(s.count).toBe(2)
    expect(s.total).toBe(21680)
    expect(s.items.map((i) => i.paymentId)).toEqual(['p-sp', 'p-dud'])
    expect(s.first).toEqual({ paymentId: 'p-sp', jobId: 'j-878', jobLabel: 'J878 Take 5 – Seguin', amount: 13680, reason: 'Insufficient funds', postedYmd: '2026-09-18' })
    expect(s.items[1]?.jobLabel).toBe('Dudley')
  })

  it('is empty with nothing linked', () => {
    expect(summarizeBankReturnedPayments([], tx, jobs)).toEqual({ count: 0, total: 0, first: null, items: [] })
  })

  it('a deposit posted in a Central evening reads that day', () => {
    // 7:30 pm CDT on Oct 2 (PostgREST's +00:00 shape), 6:30 pm CST on Dec 1, and noon UTC.
    const posted = (at: string) =>
      summarizeBankReturnedPayments([{ id: 'p', job_id: 'j-878', amount: 100, mercury_transaction_id: 't' }], new Map([['t', { id: 't', status: 'failed', posted_at: at, amount: 100, failure_reason: 'Insufficient funds' }]]), jobs).first?.postedYmd
    expect(posted('2026-10-03T00:30:00+00:00')).toBe('2026-10-02')
    expect(posted('2026-12-02T00:30:00Z')).toBe('2026-12-01')
    expect(posted('2026-10-03T12:00:00Z')).toBe('2026-10-03')
  })

  it('labels a job by number and name, falling back to the customer', () => {
    expect(jobLabelForBankReturn({ id: 'x', hcp_number: '878', job_name: 'Take 5 – Seguin' })).toBe('J878 Take 5 – Seguin')
    expect(jobLabelForBankReturn({ id: 'x', hcp_number: ' ', job_name: '', customer_name: 'Dudley' })).toBe('Dudley')
    expect(jobLabelForBankReturn(null)).toBe('a job')
  })
})

describe('the Pipeline row badge (v2.3806)', () => {
  const item = (jobId: string, amount: number, reason = 'Insufficient funds') => ({ paymentId: `p-${jobId}-${amount}`, jobId, jobLabel: `J${jobId}`, amount, reason, postedYmd: null })
  it('folds the card\'s items per job, keeping the first reason', () => {
    const by = bankReturnedByJob([item('a', 13680), item('b', 8000, 'Stop payment'), item('a', 8000, '')])
    expect(by.get('a')).toEqual({ count: 2, total: 21680, reason: 'Insufficient funds' })
    expect(by.get('b')).toEqual({ count: 1, total: 8000, reason: 'Stop payment' })
    expect(by.has('c')).toBe(false)
    expect(bankReturnedByJob([item('a', 5, ''), item('a', 5, 'Refer to maker')]).get('a')?.reason).toBe('Refer to maker')
  })
  it('the words and the title', () => {
    expect(bankReturnedBadgeWords({ count: 1, total: 13680, reason: 'Insufficient funds' })).toBe('check returned · $13,680')
    expect(bankReturnedBadgeWords({ count: 2, total: 21680.5, reason: '' })).toBe('2 checks returned · $21,680.50')
    expect(bankReturnedBadgeTitle({ count: 1, total: 13680, reason: 'Insufficient funds' })).toBe(
      'This job still counts a deposit the bank returned (Insufficient funds) — $13,680 — as paid. Open ③ Payments received; Unlink and remove takes it off the job and marks the deposit returned in Accounts Receivable.',
    )
    expect(bankReturnedBadgeTitle({ count: 2, total: 100, reason: '' })).toContain('2 deposits the bank returned — $100 — as paid')
  })
})

describe('v2.4320: a check can come back before it posts', () => {
  it('a check deposit that failed with a bank reason and no posting date is a return (Peter Garza, Jul 2025)', () => {
    expect(mercuryBankReturn({ status: 'failed', posted_at: null, amount: 2700, failureReason: 'Insufficient funds', kind: 'checkDeposit' })).toEqual({ reason: 'Insufficient funds' })
    expect(mercuryBankReturnFromRaw({ status: 'failed', reasonForFailure: 'Stop payment', kind: 'checkDeposit' }, null, 500)).toEqual({ reason: 'Stop payment' })
  })
  it("Mercury's own processing failure is not a return — that check never reached the bank", () => {
    expect(
      mercuryBankReturn({ status: 'failed', posted_at: null, amount: 600, failureReason: 'There was an issue with this transaction. Please contact help@mercury.com.', kind: 'checkDeposit' }),
    ).toBeNull()
  })
  it('an internal transfer short of funds is not a return, even though "transfer" holds "nsf"', () => {
    expect(
      mercuryBankReturn({ status: 'failed', posted_at: null, amount: 3000, failureReason: "Account Taunya 6101 doesn't have enough funds to support a $3,000.00 transfer", kind: 'internalTransfer' }),
    ).toBeNull()
    expect(isBankReturnReason("doesn't have enough funds to support a $3,000.00 transfer")).toBe(false)
  })
  it('without a kind, an unposted failure stays out', () => {
    expect(mercuryBankReturn({ status: 'failed', posted_at: null, amount: 2700, failureReason: 'Insufficient funds' })).toBeNull()
  })
  it('the SQL rule in the migration names the same phrases', () => {
    const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261001230000_ar_returned_check_cases.sql'), 'utf8')
    const block = sql.slice(sql.indexOf('FUNCTION public.mercury_bank_return_reason'), sql.indexOf('$function$;', sql.indexOf('FUNCTION public.mercury_bank_return_reason')))
    const inSql = [...block.matchAll(/^\s+'([a-z ]+)',?$/gm)].map((m) => m[1])
    expect(inSql).toEqual([...BANK_RETURN_REASON_PHRASES])
  })
})

describe('v2.4320: a case row → the notice', () => {
  const base: ArReturnCaseRow = {
    mercury_transaction_id: 'tx-1',
    counterparty_name: 'Loberg',
    amount: '5622.49',
    kind: 'checkDeposit',
    posted_at: '2026-09-28T22:01:00Z',
    failed_at: '2026-10-01T13:41:00Z',
    bank_reason: 'Stop payment',
    source: 'bank',
    opened_at: '2026-10-01T13:41:00Z',
    closed_at: null,
    closed_reason: null,
    closed_note: null,
    closed_by: null,
    replaced_by_mercury_transaction_id: null,
    notified_at: null,
    live_payments: [],
    last_job: { job_id: 'job-650', job_number: '650', job_name: 'ATI Schertz — As per plans', removed_at: '2026-10-01T02:19:00Z', removed_by: 'Taunya' },
    recorded_payment: null,
  }
  it('off its job: the last job and the day it came off, on the company calendar (9:19 PM CT Sep 30 is Sep 30)', () => {
    const input = noticeInputFromCase(base, 'https://clicktooling.com')
    expect(input.situation).toBe('off_job')
    expect(input.lastJob).toEqual({ jobId: 'job-650', jobLabel: 'J650 ATI Schertz — As per plans', offYmd: '2026-09-30' })
    expect(input.postedYmd).toBe('2026-09-28')
    expect(input.amount).toBe(5622.49)
  })
  it('on jobs: the payments fold per job, biggest first', () => {
    const row: ArReturnCaseRow = {
      ...base,
      last_job: null,
      live_payments: [
        { payment_id: 'p1', job_id: 'j963', job_number: '963', job_name: 'Knight Springtown Vet', amount: 2090, invoice_id: 'i1' },
        { payment_id: 'p2', job_id: 'j977', job_number: '977', job_name: 'Springtown', amount: 11181.48, invoice_id: 'i2' },
        { payment_id: 'p3', job_id: 'j963', job_number: '963', job_name: 'Knight Springtown Vet', amount: 1482, invoice_id: 'i3' },
      ],
    }
    const input = noticeInputFromCase(row, 'https://clicktooling.com')
    expect(input.situation).toBe('on_jobs')
    expect(input.jobs.map((j) => [j.jobLabel, j.amount])).toEqual([
      ['J977 Springtown', 11181.48],
      ['J963 Knight Springtown Vet', 3572],
    ])
  })
  it('rejected: the recorded payment it matches', () => {
    const row: ArReturnCaseRow = {
      ...base,
      counterparty_name: 'Sal Iannotti',
      amount: 600,
      posted_at: null,
      source: 'rejected',
      last_job: null,
      recorded_payment: { payment_id: 'p9', job_id: 'job-1040', job_number: '1040', job_name: 'Iannotti PRV', amount: 600, paid_on: '2026-09-29' },
    }
    const input = noticeInputFromCase(row, 'https://clicktooling.com')
    expect(arReturnCaseSituation(row)).toBe('rejected')
    expect(input.recorded).toEqual({ jobId: 'job-1040', jobLabel: 'J1040 Iannotti PRV', amount: 600, paidYmd: '2026-09-29' })
    expect(input.postedYmd).toBeNull()
  })
  it('never on a job', () => {
    expect(arReturnCaseSituation({ source: 'bank', live_payments: [], last_job: null })).toBe('never_on_job')
    expect(arReturnCaseSituation({ source: 'hand', live_payments: null, last_job: null })).toBe('never_on_job')
  })
})
