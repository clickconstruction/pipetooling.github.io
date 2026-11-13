import { describe, expect, it } from 'vitest'
import { compareInvoiceLedgerRows, invoiceLedgerRow, invoiceLedgerState, invoiceLedgerTotals, ledgerDollars } from './invoiceLedgerRow'
import type { ExpectedPayModel } from './billedExpectedPay'

const base = {
  amount: 9800,
  sentYmd: '2026-09-04',
  payments: [],
  billsTo: 'RLC-Dunmere Mallin',
  drawLabel: null,
  isAutoRemainder: false,
  expected: null,
}

function model(over: Partial<ExpectedPayModel>): ExpectedPayModel {
  return {
    expectedYmd: '2026-08-25',
    state: 'late',
    source: 'customer',
    medianDays: 21,
    samples: 5,
    payers: 0,
    daysLate: 21,
    paceWords: 'pays in ~21d',
    label: '',
    title: '',
    ...over,
  }
}

describe('ledgerDollars', () => {
  it('drops cents on whole dollars and keeps them otherwise', () => {
    expect(ledgerDollars(9800)).toBe('$9,800')
    expect(ledgerDollars(9800.5)).toBe('$9,800.50')
    expect(ledgerDollars(0)).toBe('$0')
  })
})

describe('invoiceLedgerState', () => {
  it('maps statuses; a billed row fully covered by payments reads paid', () => {
    expect(invoiceLedgerState('ready_to_bill', 100, 0)).toBe('draft')
    expect(invoiceLedgerState('billed', 100, 0)).toBe('open')
    expect(invoiceLedgerState('billed', 100, 100)).toBe('paid')
    expect(invoiceLedgerState('paid', 100, 0)).toBe('paid')
    expect(invoiceLedgerState('draft', 100, 0)).toBeNull()
    expect(invoiceLedgerState(null, 100, 0)).toBeNull()
  })
})

describe('invoiceLedgerRow — open bill', () => {
  it('reads sent · to · open, with the expected-pay detail red when late', () => {
    const r = invoiceLedgerRow({ ...base, status: 'billed', expected: model({}) })
    expect(r).toMatchObject({
      state: 'open',
      whoLine: 'sent Sep 4 to RLC-Dunmere Mallin',
      moneyLead: '$9,800 open',
      moneyDetail: '21 d past expected',
      moneyTone: 'late',
      promise: null,
    })
  })

  it('reads expect ~date, muted, while upcoming', () => {
    const r = invoiceLedgerRow({ ...base, status: 'billed', expected: model({ state: 'upcoming', daysLate: 0, expectedYmd: '2026-09-25' }) })
    expect(r?.moneyDetail).toBe('expect ~Sep 25')
    expect(r?.moneyTone).toBe('muted')
  })

  it("reads the due day for a payer on a Pay calendar, as the Pipeline row does (punch list #323)", () => {
    const terms = (over: { state?: 'upcoming' | 'late'; daysLate?: number; daysPastDue?: number; dueYmd?: string; expectedYmd?: string }) => ({
      ...model({ state: 'upcoming', daysLate: 0, expectedYmd: '2026-12-16', ...over }),
      source: 'terms' as const,
      dueYmd: over.dueYmd ?? '2026-12-10',
      daysPastDue: over.daysPastDue ?? 0,
      lateness: null,
      calendar: null,
      calendarOwn: false,
      clockYmd: '2026-11-03',
      clockFrom: 'billed' as const,
    })
    const ahead = invoiceLedgerRow({ ...base, status: 'billed', expected: terms({}) })
    expect([ahead?.moneyDetail, ahead?.moneyTone]).toEqual(['due Dec 10', 'muted'])
    // Past due under the contract, though their money is not expected yet.
    const pastDue = invoiceLedgerRow({ ...base, status: 'billed', expected: terms({ dueYmd: '2026-11-10', daysPastDue: 2, expectedYmd: '2026-11-16' }) })
    expect([pastDue?.moneyDetail, pastDue?.moneyTone]).toEqual(['due Nov 10 · 2 d past', 'late'])
    // Later than even this payer usually is: that leads, with the due day beside it.
    const late = invoiceLedgerRow({ ...base, status: 'billed', expected: terms({ state: 'late', daysLate: 27, dueYmd: '2026-10-10', daysPastDue: 33, expectedYmd: '2026-10-16' }) })
    expect([late?.moneyDetail, late?.moneyTone]).toEqual(['27 d past expected · due Oct 10', 'late'])
  })

  it('a promise replaces the estimate: They said {date}, and names the days past when broken', () => {
    const kept = invoiceLedgerRow({ ...base, status: 'billed', expected: model({ source: 'promised', state: 'upcoming', daysLate: 0, expectedYmd: '2026-09-19' }) })
    expect(kept?.promise).toBe('They said Sep 19')
    expect(kept?.moneyDetail).toBeNull()
    const broken = invoiceLedgerRow({ ...base, status: 'billed', expected: model({ source: 'promised', state: 'late', daysLate: 3, expectedYmd: '2026-09-12' }) })
    expect(broken?.promise).toBe('They said Sep 12 · 3 d past')
  })

  it('without a model or a sent date it still reads', () => {
    expect(invoiceLedgerRow({ ...base, status: 'billed', sentYmd: null })).toMatchObject({ whoLine: 'bills RLC-Dunmere Mallin', moneyDetail: null, promise: null })
    expect(invoiceLedgerRow({ ...base, status: 'billed', billsTo: null })).toMatchObject({ whoLine: 'sent Sep 4' })
    expect(invoiceLedgerRow({ ...base, status: 'billed', billsTo: null, sentYmd: null })?.whoLine).toBe('sent')
  })

  it('a payment short of the amount (never in practice) reads "$X short", not a fourth state', () => {
    const r = invoiceLedgerRow({ ...base, status: 'billed', payments: [{ amount: 9000, paidOnYmd: '2026-09-10' }], expected: model({}) })
    expect(r?.state).toBe('open')
    expect(r?.moneyLead).toBe('$800 open')
    expect(r?.moneyDetail).toBe('$800 short · 21 d past expected')
  })
})

describe('invoiceLedgerRow — paid bill', () => {
  it('reads paid · date · days to pay, and never carries a chase detail', () => {
    const r = invoiceLedgerRow({
      ...base,
      status: 'billed',
      amount: 8000,
      sentYmd: '2026-08-12',
      payments: [{ amount: 8000, paidOnYmd: '2026-08-26' }],
      drawLabel: 'Draw 1 · Rough-in',
      expected: model({}),
    })
    expect(r).toMatchObject({
      state: 'paid',
      whoLine: 'sent Aug 12 to RLC-Dunmere Mallin',
      whoNote: 'Draw 1 · Rough-in',
      moneyLead: '$8,000 paid',
      moneyDetail: 'Aug 26 · 14 days',
      moneyTone: 'muted',
      promise: null,
    })
  })

  it('a paid status with no payment behind it reads "marked paid · no payment on record"', () => {
    const r = invoiceLedgerRow({ ...base, status: 'paid', payments: [] })
    expect(r).toMatchObject({ state: 'paid', paid: 0, moneyLead: '$9,800 marked paid', moneyDetail: 'no payment on record', moneyTone: 'muted' })
  })

  it('one day is singular; the latest payment date wins', () => {
    const r = invoiceLedgerRow({
      ...base,
      status: 'paid',
      sentYmd: '2026-09-01',
      payments: [
        { amount: 4000, paidOnYmd: '2026-09-02' },
        { amount: 5800, paidOnYmd: '2026-09-01' },
      ],
    })
    expect(r?.moneyDetail).toBe('Sep 2 · 1 day')
  })
})

describe('invoiceLedgerRow — draft', () => {
  it('reads not sent · bills, to bill, and names the auto remainder', () => {
    const r = invoiceLedgerRow({ ...base, status: 'ready_to_bill', amount: 17800, sentYmd: null, billsTo: 'Dunmere Mallin', isAutoRemainder: true })
    expect(r).toMatchObject({ state: 'draft', whoLine: 'not sent · bills Dunmere Mallin', whoNote: 'auto remainder', moneyLead: '$17,800 to bill' })
    expect(invoiceLedgerRow({ ...base, status: 'ready_to_bill', billsTo: null, drawLabel: 'Draw 2 · Top-out' })).toMatchObject({ whoLine: 'not sent', whoNote: 'Draw 2 · Top-out' })
  })
})

describe('ordering and totals', () => {
  it('drafts, then open, then paid; oldest first within a state', () => {
    const rows = [
      { state: 'paid' as const, sentYmd: '2026-08-12' },
      { state: 'open' as const, sentYmd: '2026-09-04' },
      { state: 'open' as const, sentYmd: '2026-08-20' },
      { state: 'draft' as const, sentYmd: null },
    ]
    expect([...rows].sort(compareInvoiceLedgerRows).map((r) => `${r.state}:${r.sentYmd ?? '-'}`)).toEqual(['draft:-', 'open:2026-08-20', 'open:2026-09-04', 'paid:2026-08-12'])
  })

  it('paid + open = billed, by payments (the tiles\' math); drafts count as to bill', () => {
    expect(
      invoiceLedgerTotals([
        { state: 'paid', amount: 8000, paid: 8000 },
        { state: 'open', amount: 9800, paid: 0 },
        { state: 'draft', amount: 1200, paid: 0 },
      ]),
    ).toEqual({ paid: 8000, open: 9800, billed: 17800, toBill: 1200, unapplied: 0 })
    // a short payment splits its bill between paid and open
    expect(invoiceLedgerTotals([{ state: 'open', amount: 100, paid: 40 }])).toEqual({ paid: 40, open: 60, billed: 100, toBill: 0, unapplied: 0 })
    // a row marked paid with nothing behind it adds nothing (J258's $8,900 March stub)
    expect(invoiceLedgerTotals([{ state: 'paid', amount: 8900, paid: 0 }, { state: 'paid', amount: 8000, paid: 8000 }]).paid).toBe(8000)
    // money received on no bill is carried so the line still reaches the tiles
    expect(invoiceLedgerTotals([{ state: 'open', amount: 500, paid: 0 }], 250).unapplied).toBe(250)
  })
})
