import { describe, expect, it } from 'vitest'
import { arReturnsByPayer, payerReturnsWords, type ArReturnedCheckPayerRow } from './arReturnedCheckPayers'
import { buildReliabilityLine } from './paymentReliability'

const row = (over: Partial<ArReturnedCheckPayerRow>): ArReturnedCheckPayerRow => ({
  mercury_transaction_id: 'tx',
  came_back_at: '2026-04-13T15:00:00Z',
  job_id: 'job-440',
  job_customer_id: 'cust-poolcorp',
  job_gc_customer_id: null,
  job_bill_to_party: 'customer',
  invoice_bill_to_party: null,
  invoice_bill_to_email: null,
  ...over,
})

describe('arReturnsByPayer — a bounce counts against whoever pays the bill', () => {
  it('Poolcorp twice in April: two distinct checks, the latest day', () => {
    const m = arReturnsByPayer([
      row({ mercury_transaction_id: 'a', came_back_at: '2026-04-01T15:00:00Z' }),
      row({ mercury_transaction_id: 'b' }),
      row({ mercury_transaction_id: 'b', job_id: 'job-441' }),
    ])
    expect(m.get('cust-poolcorp')).toEqual({ count: 2, lastYmd: '2026-04-13' })
  })
  it('a GC job that bills the GC counts the GC, not the homeowner', () => {
    const m = arReturnsByPayer([row({ job_customer_id: 'homeowner', job_gc_customer_id: 'gc-sp', job_bill_to_party: 'gc' })])
    expect(m.get('gc-sp')?.count).toBe(1)
    expect(m.has('homeowner')).toBe(false)
  })
  it('a check that came back in a Central evening reads that day, and its month', () => {
    // 7:30 pm CDT on Oct 31 is Nov 1 in UTC; 6:30 pm CST on Dec 1; noon UTC reads its own day.
    const last = (at: string) => arReturnsByPayer([row({ came_back_at: at })]).get('cust-poolcorp')?.lastYmd
    expect(last('2026-11-01T00:30:00+00:00')).toBe('2026-10-31')
    expect(payerReturnsWords({ count: 1, lastYmd: last('2026-11-01T00:30:00Z') ?? null }, '2026-11-20')).toBe('1 check came back · Oct')
    expect(last('2026-12-02T00:30:00Z')).toBe('2026-12-01')
    expect(last('2026-10-03T12:00:00Z')).toBe('2026-10-03')
  })
  it('a bill sent to someone else by email counts no customer', () => {
    expect(arReturnsByPayer([row({ invoice_bill_to_email: 'ap@other.com' })]).size).toBe(0)
  })
})

describe('payerReturnsWords and the pay history line', () => {
  it('this year by month, an older one with its year', () => {
    expect(payerReturnsWords({ count: 2, lastYmd: '2026-04-13' }, '2026-10-01')).toBe('2 checks came back · Apr')
    expect(payerReturnsWords({ count: 1, lastYmd: '2025-07-11' }, '2026-10-01')).toBe('1 check came back · Jul 2025')
    expect(payerReturnsWords({ count: 0, lastYmd: null }, '2026-10-01')).toBeNull()
    expect(payerReturnsWords(null, '2026-10-01')).toBeNull()
  })
  it('the Billed row reads it after the pay speed and the kept record', () => {
    const line = buildReliabilityLine(null, null, '2 checks came back · Apr')
    expect(line.text).toBe('2 checks came back · Apr')
    expect(line.bounced).toBe('2 checks came back · Apr')
    expect(line.title).toBe('Checks from them the bank sent back in the last year: 2 checks came back, the last in Apr.')
    expect(buildReliabilityLine(null, null).bounced).toBeNull()
  })
})
