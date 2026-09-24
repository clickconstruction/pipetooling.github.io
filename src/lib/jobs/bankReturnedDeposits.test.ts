import { describe, expect, it } from 'vitest'
import {
  bankReturnedBadgeTitle,
  bankReturnedBadgeWords,
  bankReturnedByJob,
  bankReturnedChipWords,
  jobLabelForBankReturn,
  mercuryBankReturn,
  mercuryBankReturnFromRaw,
  summarizeBankReturnedPayments,
} from './bankReturnedDeposits'

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
