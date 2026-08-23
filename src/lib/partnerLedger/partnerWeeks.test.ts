import { describe, expect, it } from 'vitest'
import {
  buildJournalWeekCards,
  reconcileLines,
  tierHoursTotal,
  parsePartnerLedgerStubs,
  parsePartnerSummary,
  parsePartnerLedgerOffsets,
  partnerStubsToJournal,
  weekStartYmd,
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

describe('weekStartYmd', () => {
  it('returns the Sunday of the containing week', () => {
    expect(weekStartYmd('2026-08-22')).toBe('2026-08-16') // Saturday
    expect(weekStartYmd('2026-08-16')).toBe('2026-08-16') // Sunday stays
    expect(weekStartYmd('2026-06-26')).toBe('2026-06-21') // Friday
    expect(weekStartYmd('2026-01-01')).toBe('2025-12-28') // year boundary
  })
  it('passes garbage through unchanged', () => {
    expect(weekStartYmd('')).toBe('')
    expect(weekStartYmd('nope')).toBe('nope')
  })
})

describe('buildJournalWeekCards', () => {
  it('puts the live week first: opening = journal end, closing adds gross so far', () => {
    const cards = buildJournalWeekCards(summary(), [stub()])
    // journal end: 1755 + 1051.05 − 150 − 1625 = 1031.05
    expect(cards[0]?.open).toBe(true)
    expect(cards[0]?.opening).toBe(1031.05)
    expect(cards[0]?.closing).toBe(1031.05 + 615)
    expect(cards[0]?.lines.some((l) => l.label.includes('pending approval'))).toBe(true)
  })

  it('chains forward from $0 and each closing equals the journal balance at week end', () => {
    const cards = buildJournalWeekCards(summary(), [stub()])
    const wk = cards[1]
    expect(wk?.opening).toBe(0)
    expect(wk?.closing).toBe(1031.05)
  })

  it('renders journal rows in date order; labor expands into stamped rate tiers', () => {
    const cards = buildJournalWeekCards(summary(), [stub()])
    const labels = cards[1]?.lines.map((l) => l.label) ?? []
    // payout dated 08-14 books before the 08-15 stub lines — dates rule, not the statement layout
    expect(labels).toEqual([
      'Paid out',
      'Labor · 22.50 h × $50',
      'Labor · 18.00 h × $35',
      'Profit share — Job 781',
      'Back-charge — return trip',
    ])
  })

  it('skips rate tiers with no hours (no "Labor · 0.0 h × $0" noise)', () => {
    const s = stub({ day_rates: [{ rate: 50, hours: 22.5, amount: 1125 }, { rate: 0, hours: 0, amount: 0 }] })
    const cards = buildJournalWeekCards(summary(), [s])
    const laborLabels = cards[1]?.lines.filter((l) => l.label.startsWith('Labor')).map((l) => l.label) ?? []
    expect(laborLabels).toEqual(['Labor · 22.50 h × $50'])
  })

  it('labor tier lines reconcile to the stub gross — opening + lines = closing to the penny', () => {
    // Bryan 2026-05-31: the per-day tier rounding summed to 696.29 while gross_pay is 696.28
    const s = stub({
      id: 'sB',
      period_start: '2026-05-31',
      period_end: '2026-06-06',
      hours_total: 18.57,
      gross_pay: 696.28,
      day_rates: [{ rate: 37.5, hours: 18.57, amount: 696.29 }],
      additional: [{ description: 'Additional', amount: 232.22 }],
      deductions: [],
      payments: [],
    })
    const cards = buildJournalWeekCards(summary(), [s])
    const wk = cards.find((c) => c.weekStart === '2026-05-31')!
    const labor = wk.lines.find((l) => l.label.startsWith('Labor'))!
    expect(labor.label).toBe('Labor · 18.57 h × $37.50')
    expect(labor.amount).toBe(696.28)
    const sum = Math.round(wk.lines.reduce((a, l) => a + (l.amount ?? 0), 0) * 100) / 100
    expect(sum).toBe(Math.round((wk.closing - (wk.opening ?? 0)) * 100) / 100)
  })

  it('every closed card satisfies opening + lines = closing, even with multi-tier penny drift and charges', () => {
    const s1 = stub({ id: 'sA', period_start: '2026-07-05', period_end: '2026-07-11', gross_pay: 322.25, day_rates: [{ rate: 50, hours: 4.87, amount: 243.5 }, { rate: 35, hours: 2.25, amount: 78.76 }], additional: [], deductions: [], payments: [{ amount: 602.5, paid_at: '2026-07-07', memo: 'Cashapp' }] })
    const s2 = stub({ id: 'sB', period_start: '2026-07-12', period_end: '2026-07-18', gross_pay: 690, day_rates: [{ rate: 50, hours: 13.8, amount: 690 }], additional: [], deductions: [], payments: [] })
    const cards = buildJournalWeekCards(summary(), [s1, s2], [
      { id: 'o1', type: 'back_charge', amount: 405.64, occurred_date: '2026-07-08', description: 'AC unit' },
    ])
    const closed = cards.filter((c) => !c.open)
    expect(closed.length).toBeGreaterThan(0)
    for (const c of closed) {
      const sum = Math.round(c.lines.reduce((a, l) => a + (l.amount ?? 0), 0) * 100) / 100
      expect(sum).toBe(Math.round((c.closing - (c.opening ?? 0)) * 100) / 100)
    }
    // the 78.76 tier absorbed nothing — the residual (−0.01) went to the largest tier
    const wk = cards.find((c) => c.weekStart === '2026-07-05')!
    expect(wk.lines.filter((l) => l.label.startsWith('Labor')).map((l) => l.amount)).toEqual([243.49, 78.76])
  })

  it('live so-far lines reconcile to gross_so_far', () => {
    const cards = buildJournalWeekCards(summary({ current_week: { week_start: '2026-08-16', field_hours: 9.5, office_hours: 0, farm_hours: 0, gross_so_far: 475.01, pending_sessions: 0 } }), [stub()])
    const field = cards[0]!.lines.find((l) => l.label.startsWith('Field labor'))!
    expect(field.label).toBe('Field labor · 9.50 h × $50')
    expect(field.amount).toBe(475.01)
  })

  it('books charges in their own week (even with no statement) and payouts in the week they were paid', () => {
    // The Bryan shape: a stub whose payout landed the NEXT calendar week, and a
    // back-charge in a week with no statement at all.
    const s = stub({
      id: 'sA',
      period_start: '2026-06-07',
      period_end: '2026-06-13',
      gross_pay: 275,
      day_rates: [{ rate: 50, hours: 5.5, amount: 275 }],
      additional: [],
      deductions: [],
      payments: [{ amount: 275, paid_at: '2026-06-16', memo: null }],
    })
    const offsets = [{ id: 'o1', type: 'backcharge', amount: 405.64, occurred_date: '2026-06-26', description: 'AC unit for his RV' }]
    const cards = buildJournalWeekCards(summary({ current_week: { week_start: '2026-08-16', field_hours: 0, office_hours: 0, farm_hours: 0, gross_so_far: 0, pending_sessions: 0 } }), [s], offsets)
    expect(cards.map((c) => c.weekStart)).toEqual(['2026-08-16', '2026-06-21', '2026-06-14', '2026-06-07'])
    // labor week
    expect(cards[3]).toMatchObject({ opening: 0, closing: 275, stubId: 'sA' })
    // payout week — the payment books where it was PAID, not on the stub's week
    expect(cards[2]?.lines.map((l) => l.label)).toEqual(['Paid out'])
    expect(cards[2]).toMatchObject({ opening: 275, closing: 0, stubId: null })
    // back-charge week — visible with no statement, chain flows through it
    expect(cards[1]?.lines).toEqual([{ label: 'AC unit for his RV', sub: undefined, amount: -405.64, cls: 'neg' }])
    expect(cards[1]).toMatchObject({ opening: 0, closing: -405.64 })
    // live week opens where the chain left off
    expect(cards[0]).toMatchObject({ open: true, opening: -405.64, closing: -405.64 })
  })

  it('journal rows dated inside the live week join the live card', () => {
    const s = stub({
      id: 'sB',
      period_start: '2026-08-09',
      period_end: '2026-08-15',
      gross_pay: 450.1,
      day_rates: [{ rate: 35, hours: 12.9, amount: 450.1 }],
      additional: [],
      deductions: [],
      payments: [{ amount: 200, paid_at: '2026-08-18', memo: 'CashApp advance' }],
    })
    const cards = buildJournalWeekCards(summary(), [s])
    expect(cards[0]?.lines.map((l) => l.label)).toContain('Paid out')
    // opening = closing of the 08-09 week (450.10); posted live = 250.10; + 615 so far
    expect(cards[0]?.opening).toBe(450.1)
    expect(cards[0]?.closing).toBe(250.1 + 615)
    expect(cards[1]).toMatchObject({ opening: 0, closing: 450.1 })
  })
})

describe('partnerStubsToJournal', () => {
  it('builds the dated journal with a running balance from RPC stubs', () => {
    const { rows, balance } = partnerStubsToJournal([stub()])
    expect(rows.map((r) => r.kind)).toEqual(['payout', 'labor', 'addition', 'deduction'])
    // 1755 + 1051.05 − 150 − 1625
    expect(balance).toBe(1031.05)
    expect(rows[0]?.date).toBe('2026-08-14')
    expect(rows[1]?.label).toBe('Labor — 40.50 h (week of 2026-08-09)')
  })

  it('chains multiple weeks oldest-first; closing equals the summary balance convention', () => {
    const older = stub({ id: 's10', period_start: '2026-08-02', period_end: '2026-08-08', additional: [], deductions: [], payments: [], gross_pay: 500 })
    const { rows, balance } = partnerStubsToJournal([stub(), older])
    expect(rows[0]?.pay_stub_id).toBe('s10')
    expect(balance).toBe(1531.05)
  })

  it('handles the empty payload', () => {
    expect(partnerStubsToJournal([])).toEqual({ rows: [], balance: 0 })
  })

  it('books charge offsets at their date and skips the mirroring statement deduction', () => {
    const s = stub({
      deductions: [
        { description: 'Back-charge — return trip', amount: 150, person_offset_id: 'off1' },
        { description: 'Manual deduction', amount: 20, person_offset_id: null },
      ],
    })
    const offsets = [
      { id: 'off1', type: 'backcharge', amount: 150, occurred_date: '2026-08-01', description: 'Back-charge — return trip' },
      { id: 'off2', type: 'damage', amount: 60, occurred_date: '2026-08-20', description: 'Broken glass' },
    ]
    const { rows, balance } = partnerStubsToJournal([s], offsets)
    const labels = rows.map((r) => [r.date, r.label])
    expect(labels).toContainEqual(['2026-08-01', 'Back-charge — return trip'])
    expect(labels).toContainEqual(['2026-08-20', 'Broken glass'])
    // mirrored deduction excluded; manual one stays on the statement week
    expect(rows.filter((r) => r.label === 'Back-charge — return trip')).toHaveLength(1)
    expect(labels).toContainEqual(['2026-08-15', 'Manual deduction'])
    // 1755 + 1051.05 − 20 − 1625 − 150 − 60
    expect(balance).toBe(951.05)
  })

  it('positive-type offset deductions (reversals) keep booking on the statement week', () => {
    const s = stub({
      additional: [],
      payments: [],
      deductions: [{ description: 'Reversal — Job 781', amount: 100, person_offset_id: 'rev1' }],
    })
    const offsets = [{ id: 'rev1', type: 'profit_share', amount: -100, occurred_date: '2026-08-10', description: 'Reversal — Job 781' }]
    const { rows } = partnerStubsToJournal([s], offsets)
    expect(rows.map((r) => [r.date, r.kind])).toEqual([
      ['2026-08-15', 'labor'],
      ['2026-08-15', 'deduction'],
    ])
  })
})

describe('tierHoursTotal + Full-ledger hours', () => {
  it('the partner Full ledger says the same hours as the card (Σ tier hours, not hours_total)', () => {
    // Bryan 2026-08-09: hours_total 12.85 but the stamped tier says 12.86 — the card showed "12.9 h",
    // the Full ledger "12.8 h". Both now read 12.86.
    const s = stub({ id: 'sH', hours_total: 12.85, gross_pay: 450.1, day_rates: [{ rate: 35, hours: 12.86, amount: 450.1 }, { rate: 0, hours: 0, amount: 0 }], additional: [], deductions: [], payments: [] })
    expect(tierHoursTotal(s)).toBe(12.86)
    expect(tierHoursTotal(stub({ day_rates: [] }))).toBeNull()
    const { rows } = partnerStubsToJournal([s])
    expect(rows[0]?.label).toBe('Labor — 12.86 h (week of 2026-08-09)')
    expect(rows[0]?.hours).toBe(12.86)
    const cards = buildJournalWeekCards(summary(), [s])
    expect(cards[1]?.lines.find((l) => l.label.startsWith('Labor'))?.label).toBe('Labor · 12.86 h × $35')
  })
})

describe('parsePartnerLedgerOffsets', () => {
  it('parses defensively and returns [] for old payloads', () => {
    expect(parsePartnerLedgerOffsets({ exists: true, stubs: [] })).toEqual([])
    const out = parsePartnerLedgerOffsets({
      exists: true,
      offsets: [{ id: 'o1', type: 'backcharge', amount: '49.79', occurred_date: '2026-05-23', description: null }, { bad: true }],
    })
    expect(out).toHaveLength(1)
    expect(out[0]?.amount).toBe(49.79)
  })
})

describe('reconcileLines', () => {
  it('puts the residual on the largest money line and leaves no-amount lines alone', () => {
    const out = reconcileLines(
      [
        { label: 'a', amount: 100.0, cls: 'pos' },
        { label: 'b', amount: 20.0, cls: 'pos' },
        { label: 'pending', amount: null, cls: 'zero' },
      ],
      119.99,
    )
    expect(out.map((l) => l.amount)).toEqual([99.99, 20, null])
  })
  it('is a no-op when the lines already sum to the target or there is nothing to adjust', () => {
    const lines = [{ label: 'a', amount: 5, cls: 'pos' as const }]
    expect(reconcileLines(lines, 5)).toBe(lines)
    const none = [{ label: 'p', amount: null, cls: 'zero' as const }]
    expect(reconcileLines(none, 9)).toBe(none)
  })
})
