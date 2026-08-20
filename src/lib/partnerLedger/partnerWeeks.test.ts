import { describe, expect, it } from 'vitest'
import {
  buildWeekCards,
  parsePartnerLedgerStubs,
  parsePartnerSummary,
  type PartnerLedgerStub,
  type PartnerSummary,
} from './partnerWeeks'

const summary = (over?: Partial<PartnerSummary>): PartnerSummary => ({
  exists: true,
  partnership_id: 'pp1',
  display_name: 'Bryan Herber',
  balance: 3173.75,
  modules: { weekly_statement: true, costing: true, profit_shares: true },
  current_week: { week_start: '2026-08-16', field_hours: 9.5, office_hours: 4, farm_hours: 0, gross_so_far: 615, pending_sessions: 2 },
  latest_statement: { pay_stub_id: 's11', period_start: '2026-08-09', period_end: '2026-08-15', partner_ack_at: null, company_ack_at: '2026-08-16' },
  rates: { field: 50, estimating: 35, farm: 0 },
  pending_offsets: { count: 0, net: 0 },
  ...over,
})

const stub = (over?: Partial<PartnerLedgerStub>): PartnerLedgerStub => ({
  id: 's11',
  period_start: '2026-08-09',
  period_end: '2026-08-15',
  hours_total: 40.5,
  gross_pay: 1755,
  company_ack_at: '2026-08-16',
  partner_ack_at: null,
  day_rates: [
    { rate: 50, hours: 22.5, amount: 1125 },
    { rate: 35, hours: 18, amount: 630 },
  ],
  additional: [{ description: 'Profit share — Job 781', amount: 1051.05 }],
  deductions: [{ description: 'Back-charge — return trip', amount: 150 }],
  payments: [{ amount: 1625, paid_at: '2026-08-14', memo: null }],
  ...over,
})

describe('parsePartnerSummary', () => {
  it('parses a valid payload', () => {
    const s = parsePartnerSummary({
      exists: true,
      partnership_id: 'x',
      display_name: 'B',
      balance: '12.5',
      modules: { weekly_statement: true },
      current_week: { week_start: '2026-08-16', field_hours: 1, office_hours: 0, farm_hours: 0, gross_so_far: 50, pending_sessions: 0 },
      latest_statement: null,
      rates: { field: 50, estimating: 35, farm: 0 },
      pending_offsets: { count: 1, net: -30 },
    })
    expect(s?.balance).toBe(12.5)
    expect(s?.modules.costing).toBe(false)
    expect(s?.latest_statement).toBeNull()
  })
  it('returns null for non-partners and garbage', () => {
    expect(parsePartnerSummary({ exists: false })).toBeNull()
    expect(parsePartnerSummary(null)).toBeNull()
    expect(parsePartnerSummary('x')).toBeNull()
  })
})

describe('parsePartnerLedgerStubs', () => {
  it('parses stubs defensively', () => {
    const rows = parsePartnerLedgerStubs({ exists: true, stubs: [{ id: 'a', gross_pay: '10', day_rates: [{ rate: 50, hours: 2, amount: 100 }], additional: null }] })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.gross_pay).toBe(10)
    expect(rows[0]?.day_rates[0]?.amount).toBe(100)
    expect(rows[0]?.additional).toEqual([])
  })
  it('empty for exists:false', () => {
    expect(parsePartnerLedgerStubs({ exists: false })).toEqual([])
  })
})

describe('buildWeekCards', () => {
  it('puts the live week first with balance-so-far and pending line', () => {
    const cards = buildWeekCards(summary(), [stub()])
    expect(cards[0]?.open).toBe(true)
    expect(cards[0]?.closing).toBe(3173.75 + 615)
    expect(cards[0]?.lines.some((l) => l.label.includes('pending approval'))).toBe(true)
  })

  it('chains opening/closing backwards from the server balance', () => {
    const cards = buildWeekCards(summary(), [stub()])
    const wk = cards[1]
    expect(wk?.closing).toBe(3173.75)
    // net = 1755 + 1051.05 − 150 − 1625 = 1031.05 → opening = 2142.70
    expect(wk?.opening).toBe(2142.7)
  })

  it('renders labor per stamped rate plus additions/deductions/payouts', () => {
    const cards = buildWeekCards(summary(), [stub()])
    const labels = cards[1]?.lines.map((l) => l.label) ?? []
    expect(labels).toEqual([
      'Labor · 22.5 h × $50',
      'Labor · 18.0 h × $35',
      'Profit share — Job 781',
      'Back-charge — return trip',
      'Paid out',
    ])
  })

  it('orders multiple stub weeks newest-first after the open week', () => {
    const older = stub({ id: 's10', period_start: '2026-08-02', period_end: '2026-08-08', additional: [], deductions: [], payments: [], gross_pay: 500, day_rates: [{ rate: 50, hours: 10, amount: 500 }] })
    const cards = buildWeekCards(summary(), [older, stub()])
    expect(cards.map((c) => c.stubId)).toEqual([null, 's11', 's10'])
    expect(cards[2]?.closing).toBe(2142.7)
    expect(cards[2]?.opening).toBe(1642.7)
  })
})
