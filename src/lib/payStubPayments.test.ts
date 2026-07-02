import { describe, expect, it } from 'vitest'
import {
  isPayStubFullyPaid,
  lastPayStubPaymentPaidAt,
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

describe('existing payment math (regression)', () => {
  it('sums amounts to cents and computes remaining balance', () => {
    const rows = [row({ amount: 100.005 }), row({ id: 'b', amount: 49.995 })]
    expect(sumPayStubPaymentAmounts(rows)).toBe(150)
    expect(remainingPayStubBalance(200, 150)).toBe(50)
    expect(isPayStubFullyPaid(150, 150)).toBe(true)
    expect(isPayStubFullyPaid(150.02, 150)).toBe(false)
  })
})
