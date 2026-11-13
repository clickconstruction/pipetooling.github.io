import { describe, expect, it } from 'vitest'
import { rtbDayWords, rtbOpenBillWords, rtbOpenBills, rtbParts, type RtbPartsInput } from './rtbParts'

// The mock-up's job: an $86,400 bid, $21,600 paid in two payments, two open bills, $18,400 left.
const base: RtbPartsInput = {
  jobId: 'job-1321',
  revenue: 86400,
  paymentsMade: 21600,
  invoices: [
    { id: 'b1', status: 'billed', amount: 28000, is_primary_rtb_bundle: false, billed_at: '2026-09-12T15:00:00Z', sequence_order: 1 },
    { id: 'b2', status: 'billed', amount: 18400, is_primary_rtb_bundle: false, billed_at: '2026-10-09T15:00:00Z', sequence_order: 2 },
    { id: 'p', status: 'paid', amount: 21600, is_primary_rtb_bundle: false, billed_at: '2026-08-01T15:00:00Z', sequence_order: 0 },
    { id: 'rtb', status: 'ready_to_bill', amount: 18400, is_primary_rtb_bundle: true, billed_at: null, sequence_order: 3 },
  ],
  payments: [
    { invoice_id: 'p', amount: 10000 },
    { invoice_id: 'p', amount: 11600 },
  ],
  thisBill: { amount: 18400, invoiceId: 'rtb' },
  todayYmd: '2026-10-30',
}

describe('rtbOpenBills', () => {
  it('counts the billed and ready rows other than the primary and this bill, oldest first, with day and age', () => {
    const bills = rtbOpenBills(base)
    expect(bills.map((b) => [b.label, b.dayWords, b.days, b.open])).toEqual([
      ['Bill 1', 'Sep 12', 48, 28000],
      ['Bill 2', 'Oct 9', 21, 18400],
    ])
    expect(rtbOpenBillWords(bills[0]!)).toBe('Bill 1 · Sep 12 · 48 d')
  })

  it('a bill partly paid counts for its unpaid part; a draft never sent reads draft', () => {
    const bills = rtbOpenBills({
      ...base,
      invoices: [
        { id: 'b1', status: 'billed', amount: 1072.5, is_primary_rtb_bundle: false, billed_at: '2026-09-12T15:00:00Z', sequence_order: 1 },
        { id: 'd', status: 'ready_to_bill', amount: 500, is_primary_rtb_bundle: false, billed_at: null, sequence_order: 2 },
      ],
      payments: [{ invoice_id: 'b1', amount: 1018.87 }],
      thisBill: { amount: 100, invoiceId: null },
    })
    expect(bills.map((b) => [b.label, b.dayWords, b.days, b.open, b.applied])).toEqual([
      ['Bill 1', 'Sep 12', 48, 53.63, 1018.87],
      ['Bill 2', 'draft', null, 500, 0],
    ])
    expect(rtbOpenBillWords(bills[1]!)).toBe('Bill 2 · draft')
  })

  it('a bill sent from its own row is this bill, never an open one', () => {
    const bills = rtbOpenBills({ ...base, thisBill: { amount: 18400, invoiceId: 'b2' } })
    expect(bills.map((b) => b.id)).toEqual(['b1'])
  })
})

describe('rtbParts', () => {
  it('draws the mock-up: paid · open bills · this bill fill the bid, and the rows sum to it', () => {
    const parts = rtbParts(base)
    expect([parts.bid, parts.paid, parts.paidCount, parts.open, parts.thisBill, parts.rest, parts.scale]).toEqual([86400, 21600, 2, 46400, 18400, 0, 86400])
    expect(parts.segments.map((s) => [s.kind, s.amount, s.label])).toEqual([
      ['paid', 21600, '$21,600.00'],
      ['open', 46400, '$46,400.00'],
      ['this', 18400, '$18,400.00'],
    ])
    expect(parts.segments.reduce((s, x) => s + x.fraction, 0)).toBeCloseTo(1, 5)
    expect(parts.frameWords).toBe('this bill is the rest')
    expect(parts.note).toBeNull()
    expect(parts.rows.map((r) => [r.kind, r.words, r.sign, r.amount, r.door?.label ?? null])).toEqual([
      ['bid', 'Bid', '', 86400, 'Edit tab'],
      ['paid', 'Paid · 2 payments', '−', 21600, 'Payments'],
      ['open', 'Open bills · 2', '−', 46400, null],
      ['this', 'This bill', '=', 18400, null],
    ])
    expect(parts.rows[0]?.door?.href).toBe('/jobs?tab=stages&edit=job-1321')
    expect(parts.rows[1]?.door?.href).toBe('/jobs?tab=stages&edit=job-1321&editFocus=payments')
  })

  it('a partial bill leaves the rest of the bid as a grey segment', () => {
    const parts = rtbParts({ ...base, invoices: [], payments: [], paymentsMade: 0, thisBill: { amount: 20000, invoiceId: null } })
    expect(parts.segments.map((s) => [s.kind, s.amount])).toEqual([
      ['this', 20000],
      ['rest', 66400],
    ])
    expect(parts.frameWords).toBe('$66,400.00 left after this bill')
    expect(parts.rows[1]?.words).toBe('Paid · 0 payments')
  })

  it('parts past the bid widen the frame and say so', () => {
    const parts = rtbParts({ ...base, revenue: 60000 })
    expect(parts.scale).toBe(86400)
    expect(parts.rest).toBe(0)
    expect(parts.note).toBe('Paid and open bills come to $26,400.00 more than the bid, so the frame is drawn to them.')
  })

  it('a job with nothing to bill says so', () => {
    const parts = rtbParts({ ...base, invoices: [], payments: [], paymentsMade: 86400, thisBill: { amount: 0, invoiceId: null } })
    expect(parts.segments.map((s) => s.kind)).toEqual(['paid'])
    expect(parts.frameWords).toBe('nothing left to bill')
  })
})

describe('rtbDayWords', () => {
  it('names the day, never an instant', () => {
    expect(rtbDayWords('2026-09-12')).toBe('Sep 12')
    expect(rtbDayWords(null)).toBe('')
    expect(rtbDayWords('2026-13-01')).toBe('')
  })
})
