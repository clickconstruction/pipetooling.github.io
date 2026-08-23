import { describe, expect, it } from 'vitest'
import {
  buildAllPersonLedgers,
  buildPeopleLedgerRoster,
  buildPersonLedger,
  ledgerEquationTerms,
  offsetTypeLabel,
  personKey,
  rosterCaption,
  type LedgerOffset,
  type LedgerStub,
} from './personLedger'

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`

const stub = (over: Partial<LedgerStub> & { id: string }): LedgerStub => ({
  person_name: 'Tristen',
  period_start: '2026-07-19',
  period_end: '2026-07-25',
  hours_total: 41.34,
  gross_pay: 620.06,
  ...over,
})
const offset = (over: Partial<LedgerOffset> & { id: string }): LedgerOffset => ({
  person_name: 'Tristen',
  type: 'backcharge',
  amount: 100,
  occurred_date: '2026-07-01',
  description: null,
  ...over,
})

describe('buildPersonLedger', () => {
  it('books labor, payouts and every offset at its date, running balance + = we owe them (Tristen shape)', () => {
    const l = buildPersonLedger({
      name: 'Tristen ',
      stubs: [stub({ id: 's1' }), stub({ id: 's2', period_start: '2026-07-26', period_end: '2026-08-01', hours_total: 49.56, gross_pay: 743.34 })],
      payments: [{ pay_stub_id: 's2', amount: 743.34, paid_at: '2026-08-03T15:00:00Z', memo: 'Cashapp' }],
      deductions: [],
      additional: [],
      offsets: [
        offset({ id: 'o1', type: 'damage', amount: 1800, occurred_date: '2025-10-20', description: "Drove skid steer into back of Trace's truck" }),
        offset({ id: 'o2', type: 'employee_credit', amount: 50, occurred_date: '2026-07-30', description: 'Tool reimbursement' }),
      ],
    })
    expect(l.key).toBe('Tristen')
    expect(l.rows.map((r) => [r.date, r.amount, r.balance])).toEqual([
      ['2025-10-20', -1800, -1800],
      ['2026-07-25', 620.06, -1179.94],
      ['2026-07-30', 50, -1129.94], // credit counts the day it happened — no statement needed
      ['2026-08-01', 743.34, -386.6],
      ['2026-08-03', -743.34, -1129.94],
    ])
    expect(l.balance).toBe(-1129.94)
    expect(l.totals).toEqual({ earned: 1363.4, additions: 0, deductions: 0, paidOut: 743.34, charges: 1800, credits: 50 })
    expect(l.unpaid).toEqual({ count: 1, amount: 620.06, oldestPeriodStart: '2026-07-19', partialCount: 0, partialRemaining: 0 })
    expect(l.stubPay.get('s1')?.state).toBe('unpaid')
    expect(l.stubPay.get('s2')?.state).toBe('paid')
    expect(l.counts).toEqual({ stubs: 2, offsets: 2, charges: 1, credits: 1 })
    expect(l.lastPostingDate).toBe('2026-08-03')
    expect(l.rows.find((r) => r.offset_id === 'o1')?.label).toBe("Drove skid steer into back of Trace's truck")
  })

  it('skips a statement deduction that mirrors a charge offset (no double count); keeps manual deductions and additions; partial pay state', () => {
    const l = buildPersonLedger({
      name: 'Taunya',
      stubs: [stub({ id: 's1', person_name: 'Taunya', gross_pay: 1000, period_start: '2026-08-02', period_end: '2026-08-08' })],
      payments: [{ pay_stub_id: 's1', amount: 400, paid_at: '2026-08-10T12:00:00Z', memo: null }],
      deductions: [
        { pay_stub_id: 's1', description: 'Back-charge — overnight loan', amount: 805, person_offset_id: 'o1' },
        { pay_stub_id: 's1', description: 'Tool advance', amount: 25, person_offset_id: null },
      ],
      additional: [{ pay_stub_id: 's1', description: 'Per diem', line_total: 60 }],
      offsets: [offset({ id: 'o1', person_name: 'Taunya', amount: 805, occurred_date: '2026-07-20', description: 'Overnight loan' })],
    })
    // journal: charge −805 (Jul 20) · labor +1000 · addition +60 · manual deduction −25 (Aug 8) · payout −400 (Aug 10)
    expect(l.rows.map((r) => r.amount)).toEqual([-805, 1000, 60, -25, -400])
    expect(l.balance).toBe(-170)
    expect(l.totals.deductions).toBe(25) // the mirrored 805 is the charge, not a second deduction
    // per-stub net uses ALL stub deductions (the stub really withheld 805): 1000 + 60 − 805 − 25 = 230, paid 400 → paid
    expect(l.stubPay.get('s1')).toEqual({ stubId: 's1', net: 230, paid: 400, remaining: -170, state: 'paid' })
  })

  it('partial payments count as partial with the remaining amount; empty person is even', () => {
    const l = buildPersonLedger({
      name: 'Michael A',
      stubs: [stub({ id: 's1', person_name: 'Michael A', gross_pay: 700 })],
      payments: [{ pay_stub_id: 's1', amount: 500, paid_at: '2026-07-28T00:00:00Z', memo: null }],
      deductions: [],
      additional: [],
      offsets: [],
    })
    expect(l.unpaid).toEqual({ count: 0, amount: 0, oldestPeriodStart: '2026-07-19', partialCount: 1, partialRemaining: 200 })
    expect(l.balance).toBe(200)
    const e = buildPersonLedger({ name: 'Nobody', stubs: [], payments: [], deductions: [], additional: [], offsets: [] })
    expect(e.balance).toBe(0)
    expect(e.rows).toEqual([])
    expect(e.lastPostingDate).toBeNull()
  })
})

describe('buildAllPersonLedgers + roster', () => {
  it('one ledger per distinct trimmed name (stubs or offsets), ranked we-owe → owes-us → even', () => {
    const ledgers = buildAllPersonLedgers({
      stubs: [
        stub({ id: 'm1', person_name: 'Malachi', gross_pay: 2000 }),
        stub({ id: 'a1', person_name: 'Abraham ', gross_pay: 500 }),
        stub({ id: 't1', person_name: 'Tristen', gross_pay: 620.06 }),
      ],
      payments: [{ pay_stub_id: 'a1', amount: 500, paid_at: '2026-07-28T00:00:00Z', memo: null }],
      deductions: [],
      additional: [],
      offsets: [
        offset({ id: 'o1', type: 'damage', amount: 1800, occurred_date: '2025-10-20' }),
        offset({ id: 'o2', person_name: 'Mario', amount: 75.15, occurred_date: '2026-05-01' }), // offsets-only person still appears
      ],
    })
    expect(ledgers.map((l) => l.key).sort()).toEqual(['Abraham', 'Malachi', 'Mario', 'Tristen'])
    const r = buildPeopleLedgerRoster(ledgers, money)
    expect(r.rows.map((x) => [x.name, x.group, x.balance])).toEqual([
      ['Malachi', 'owe', 2000],
      ['Tristen', 'owed', -1179.94],
      ['Mario', 'owed', -75.15],
      ['Abraham', 'even', 0],
    ])
    expect(r.totals).toEqual({ oweAmount: 2000, oweCount: 1, owedAmount: 1255.09, owedCount: 2, evenCount: 1 })
    expect(r.rows[0]?.caption).toBe('1 unpaid · $2000.00')
    expect(r.rows[1]?.caption).toBe('1 unpaid · $620.06 · 1 charge')
    expect(r.rows[3]?.caption).toBe('1 stub · all paid')
  })

  it('rosterCaption / ledgerEquationTerms / offsetTypeLabel / personKey', () => {
    const l = buildPersonLedger({
      name: 'Darren',
      stubs: [stub({ id: 'd1', person_name: 'Darren', gross_pay: 300 })],
      payments: [{ pay_stub_id: 'd1', amount: 300, paid_at: '2026-07-28T00:00:00Z', memo: null }],
      deductions: [],
      additional: [],
      offsets: [offset({ id: 'c1', person_name: 'Darren', type: 'employee_credit', amount: 40, occurred_date: '2026-07-01' })],
    })
    expect(rosterCaption(l, money)).toBe('1 credit')
    expect(ledgerEquationTerms(l)).toEqual([
      { sign: '+', label: 'earned', amount: 300 },
      { sign: '−', label: 'paid out', amount: 300 },
      { sign: '+', label: 'credits', amount: 40 },
    ])
    expect(offsetTypeLabel('backcharge')).toBe('Back-charge')
    expect(offsetTypeLabel('employee_credit')).toBe('Credit')
    expect(offsetTypeLabel('utility_overage')).toBe('Utility')
    expect(offsetTypeLabel('some_new_kind')).toBe('Some new kind')
    expect(personKey('  Bryan ')).toBe('Bryan')
  })
})
