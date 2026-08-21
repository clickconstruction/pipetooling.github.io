import { describe, expect, it } from 'vitest'
import { buildPartnerJournal, netPosition, pendingOffsetSignedAmount, summarizePendingOffsets } from './partnerLedgerJournal'

describe('buildPartnerJournal', () => {
  it('books labor, additions, deductions on period end and payouts on their dates, with a running balance', () => {
    const { rows, balance } = buildPartnerJournal({
      stubs: [
        { id: 's1', period_start: '2026-08-09', period_end: '2026-08-15', hours_total: 40.5, gross_pay: 1755 },
      ],
      additional: [{ pay_stub_id: 's1', description: 'Profit share — Job 781', line_total: 1051.05 }],
      deductions: [{ pay_stub_id: 's1', description: 'Back-charge — return trip', amount: 150 }],
      payments: [{ pay_stub_id: 's1', amount: 1625, paid_at: '2026-08-14T18:00:00Z', memo: 'Friday run' }],
    })
    expect(rows.map((r) => r.kind)).toEqual(['payout', 'labor', 'addition', 'deduction'])
    // payout dated 8/14 lands before the stub's 8/15 rows
    expect(rows[0]?.amount).toBe(-1625)
    expect(rows[0]?.balance).toBe(-1625)
    expect(rows[3]?.balance).toBe(1031.05)
    expect(balance).toBe(1031.05)
  })

  it('orders multiple weeks oldest-first and chains the balance', () => {
    const { rows, balance } = buildPartnerJournal({
      stubs: [
        { id: 'b', period_start: '2026-08-09', period_end: '2026-08-15', hours_total: 10, gross_pay: 500 },
        { id: 'a', period_start: '2026-08-02', period_end: '2026-08-08', hours_total: 20, gross_pay: 1000 },
      ],
      additional: [],
      deductions: [],
      payments: [],
    })
    expect(rows[0]?.pay_stub_id).toBe('a')
    expect(rows[1]?.pay_stub_id).toBe('b')
    expect(balance).toBe(1500)
  })

  it('same-date rows keep labor → addition → deduction → payout order', () => {
    const { rows } = buildPartnerJournal({
      stubs: [{ id: 's', period_start: '2026-08-09', period_end: '2026-08-15', hours_total: 1, gross_pay: 50 }],
      additional: [{ pay_stub_id: 's', description: 'add', line_total: 10 }],
      deductions: [{ pay_stub_id: 's', description: 'ded', amount: 5 }],
      payments: [{ pay_stub_id: 's', amount: 20, paid_at: '2026-08-15T09:00:00Z', memo: null }],
    })
    expect(rows.map((r) => r.kind)).toEqual(['labor', 'addition', 'deduction', 'payout'])
    expect(rows[3]?.balance).toBe(35)
  })

  it('handles the empty ledger', () => {
    const out = buildPartnerJournal({ stubs: [], additional: [], deductions: [], payments: [] })
    expect(out.rows).toEqual([])
    expect(out.balance).toBe(0)
  })
})

describe('summarizePendingOffsets', () => {
  it('nets positive and charge types with sign', () => {
    const s = summarizePendingOffsets([
      { type: 'profit_share', amount: 100, occurred_date: '2026-08-10', description: null },
      { type: 'backcharge', amount: 30, occurred_date: '2026-08-11', description: null },
      { type: 'utility_overage', amount: 38.4, occurred_date: '2026-08-12', description: null },
      { type: 'employee_credit', amount: 10, occurred_date: '2026-08-12', description: null },
    ])
    expect(s.count).toBe(4)
    expect(s.net).toBe(100 - 30 - 38.4 + 10)
  })

  it('ignores non-finite amounts', () => {
    expect(summarizePendingOffsets([{ type: 'damage', amount: Number.NaN, occurred_date: 'x', description: null }])).toEqual({ count: 1, net: 0 })
  })
})

describe('pendingOffsetSignedAmount', () => {
  it('signs charges negative and credits positive', () => {
    expect(pendingOffsetSignedAmount({ type: 'backcharge', amount: 49.79, occurred_date: 'x', description: null })).toBe(-49.79)
    expect(pendingOffsetSignedAmount({ type: 'profit_share', amount: 120, occurred_date: 'x', description: null })).toBe(120)
    expect(pendingOffsetSignedAmount({ type: 'damage', amount: Number.NaN, occurred_date: 'x', description: null })).toBe(0)
  })
})

describe('netPosition', () => {
  it('adds pending net to the posted balance with cent rounding', () => {
    expect(netPosition(967.6, -1304.88)).toBe(-337.28)
    expect(netPosition(100, 0)).toBe(100)
    expect(netPosition(0.1, 0.2)).toBe(0.3)
  })
})
