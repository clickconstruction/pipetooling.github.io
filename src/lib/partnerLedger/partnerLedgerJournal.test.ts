import { describe, expect, it } from 'vitest'
import { buildPartnerJournal, mergeNotesIntoDisplay, mergePendingIntoJournal, netPosition, pendingOffsetSignedAmount, summarizePendingOffsets } from './partnerLedgerJournal'

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

  it('books charges at their own date and moves the balance (charges-at-date)', () => {
    const { rows, balance } = buildPartnerJournal({
      stubs: [{ id: 's1', period_start: '2026-08-09', period_end: '2026-08-15', hours_total: 10, gross_pay: 500 }],
      additional: [],
      deductions: [],
      payments: [],
      charges: [
        { date: '2026-04-13', label: 'Car repairs', amount: -1238.65 },
        { date: '2026-08-20', label: 'Correction credit', amount: 25 },
      ],
    })
    expect(rows.map((r) => [r.date, r.kind])).toEqual([
      ['2026-04-13', 'deduction'],
      ['2026-08-15', 'labor'],
      ['2026-08-20', 'addition'],
    ])
    expect(rows[0]?.balance).toBe(-1238.65)
    expect(balance).toBe(-713.65)
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

describe('mergeNotesIntoDisplay', () => {
  const rows = buildPartnerJournal({
    stubs: [{ id: 's1', period_start: '2026-08-09', period_end: '2026-08-15', hours_total: 12.8, gross_pay: 450.1 }],
    additional: [],
    deductions: [],
    payments: [{ pay_stub_id: 's1', amount: 200, paid_at: '2026-08-13T18:00:00Z', memo: null }],
  }).rows

  it('interleaves notes by date with null amount/balance; same-date note renders above once reversed', () => {
    const merged = mergeNotesIntoDisplay(rows, [
      { id: 'n1', note_date: '2026-08-14', memo: 'Talked about the truck', partner_visible: true },
      { id: 'n2', note_date: '2026-08-13', memo: 'Same-day note', partner_visible: false },
    ])
    expect(merged.map((r) => [r.date, r.kind])).toEqual([
      ['2026-08-13', 'payout'],
      ['2026-08-13', 'note'],
      ['2026-08-14', 'note'],
      ['2026-08-15', 'labor'],
    ])
    const note = merged[2]
    expect(note?.kind === 'note' && note.amount).toBeNull()
    expect(note?.kind === 'note' && note.balance).toBeNull()
  })

  it('empty notes list is a no-op', () => {
    expect(mergeNotesIntoDisplay(rows, [])).toHaveLength(rows.length)
  })
})

describe('mergePendingIntoJournal', () => {
  const posted = buildPartnerJournal({
    stubs: [{ id: 's1', period_start: '2026-08-09', period_end: '2026-08-15', hours_total: 12.8, gross_pay: 450.1 }],
    additional: [],
    deductions: [],
    payments: [{ pay_stub_id: 's1', amount: 200, paid_at: '2026-08-13T18:00:00Z', memo: 'CashApp advance' }],
  }).rows

  it('interleaves pending charges by occurred_date with null balance', () => {
    const merged = mergePendingIntoJournal(posted, [
      { type: 'backcharge', amount: 1238.65, occurred_date: '2026-08-14', description: 'Car repairs' },
    ])
    expect(merged.map((r) => [r.date, r.kind])).toEqual([
      ['2026-08-13', 'payout'],
      ['2026-08-14', 'pending'],
      ['2026-08-15', 'labor'],
    ])
    const pendingRow = merged[1]
    expect(pendingRow?.amount).toBe(-1238.65)
    expect(pendingRow?.balance).toBeNull()
  })

  it('same-date pending rows land after posted rows; posted balances untouched', () => {
    const merged = mergePendingIntoJournal(posted, [
      { type: 'profit_share', amount: 100, occurred_date: '2026-08-13', description: null },
    ])
    expect(merged.map((r) => r.kind)).toEqual(['payout', 'pending', 'labor'])
    expect(merged[1]?.label).toBe('profit_share')
    expect(merged[1]?.amount).toBe(100)
    expect(merged[2]?.balance).toBe(250.1)
  })

  it('empty journal still lists pending rows; non-finite amounts dropped', () => {
    const merged = mergePendingIntoJournal([], [
      { type: 'backcharge', amount: 10, occurred_date: '2026-08-01', description: 'a' },
      { type: 'damage', amount: Number.NaN, occurred_date: '2026-08-02', description: 'b' },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.kind).toBe('pending')
  })
})
