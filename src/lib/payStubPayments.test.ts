import { describe, expect, it } from 'vitest'
import {
  isPayStubFullyPaid,
  lastPayStubPaymentPaidAt,
  payStubPaymentDelay,
  remainingPayStubBalance,
  sumPayStubPaymentAmounts,
  type PayStubPaymentRow,
} from './payStubPayments'

function row(overrides: Partial<PayStubPaymentRow>): PayStubPaymentRow {
  return {
    id: 'p1',
    pay_stub_id: 's1',
    amount: 100,
    paid_at: '2026-07-01',
    memo: null,
    created_at: null,
    created_by: null,
    ...overrides,
  }
}

describe('lastPayStubPaymentPaidAt', () => {
  it('returns null for undefined or empty rows', () => {
    expect(lastPayStubPaymentPaidAt(undefined)).toBeNull()
    expect(lastPayStubPaymentPaidAt([])).toBeNull()
  })

  it('returns the max paid_at regardless of row order', () => {
    const rows = [
      row({ id: 'a', paid_at: '2026-06-15' }),
      row({ id: 'b', paid_at: '2026-07-01' }),
      row({ id: 'c', paid_at: '2026-05-30' }),
    ]
    expect(lastPayStubPaymentPaidAt(rows)).toBe('2026-07-01')
    expect(lastPayStubPaymentPaidAt([...rows].reverse())).toBe('2026-07-01')
  })

  it('handles a single payment and skips blank paid_at values', () => {
    expect(lastPayStubPaymentPaidAt([row({ paid_at: '2026-06-20' })])).toBe('2026-06-20')
    expect(lastPayStubPaymentPaidAt([row({ paid_at: '' }), row({ id: 'b', paid_at: '2026-06-01' })])).toBe('2026-06-01')
  })
})

describe('payStubPaymentDelay', () => {
  // Noon-anchored local ISO timestamps (how paid_at is stored) keep the local calendar day stable.
  const paidIso = (ymd: string) => new Date(`${ymd}T12:00:00`).toISOString()

  it('reports signed days from period end to the last payment', () => {
    expect(payStubPaymentDelay('2026-06-28', paidIso('2026-07-01'), '2026-07-10')).toEqual({ kind: 'paid', days: 3 })
    expect(payStubPaymentDelay('2026-06-28', paidIso('2026-06-28'), '2026-07-10')).toEqual({ kind: 'paid', days: 0 })
    expect(payStubPaymentDelay('2026-06-28', paidIso('2026-06-26'), '2026-07-10')).toEqual({ kind: 'paid', days: -2 })
  })

  it('reports days outstanding for unpaid stubs whose period has ended', () => {
    expect(payStubPaymentDelay('2026-06-28', null, '2026-07-02')).toEqual({ kind: 'outstanding', days: 4 })
    expect(payStubPaymentDelay('2026-06-28', null, '2026-06-28')).toEqual({ kind: 'outstanding', days: 0 })
  })

  it("reports none for unpaid stubs whose period hasn't ended", () => {
    expect(payStubPaymentDelay('2026-07-05', null, '2026-07-02')).toEqual({ kind: 'none' })
  })

  it('reports none for unparseable dates instead of throwing', () => {
    expect(payStubPaymentDelay('not-a-date', paidIso('2026-07-01'), '2026-07-02')).toEqual({ kind: 'none' })
    expect(payStubPaymentDelay('2026-06-28', 'not-a-date', '2026-07-02')).toEqual({ kind: 'none' })
    expect(payStubPaymentDelay('not-a-date', null, '2026-07-02')).toEqual({ kind: 'none' })
  })
})

describe('existing payment math (regression)', () => {
  it('sums amounts to cents and computes remaining balance', () => {
    const rows = [row({ amount: 100.005 }), row({ id: 'b', amount: 49.995 })]
    expect(sumPayStubPaymentAmounts(rows)).toBe(150)
    expect(remainingPayStubBalance(200, 150)).toBe(50)
    expect(isPayStubFullyPaid(150, 150)).toBe(true)
    expect(isPayStubFullyPaid(150.02, 150)).toBe(false)
  })
})
