import { describe, expect, it } from 'vitest'
import { moneyBarDayWords, moneyBars, offerStands, type MoneyBarsInput } from './moneyBars'

// A subcontract job terminated for convenience: a pay application billed whole and paid 90% (the open remainder is the retainage), a trip charge, a materials bill; the GC's written counter at the bills, our offer past the claim.
const base: MoneyBarsInput = {
  bills: [
    { key: 'inv-mat', jobId: 'job-a', jobLabel: '742', ymd: '2026-10-27', text: 'Invoice · sent 2026-10-27 through Stripe', open: 1020.5 },
    { key: 'inv-pa1', jobId: 'job-a', jobLabel: '742', ymd: '2026-07-09', text: 'Invoice · sent 2026-08-06 through Stripe', open: 1750 },
    { key: 'inv-trip', jobId: 'job-a', jobLabel: '742', ymd: '2026-08-06', text: 'Invoice · sent through Stripe', open: 350 },
  ],
  retainageOnBillsByJob: new Map([['job-a', 1750]]),
  retainageAdded: 0,
  balance: 3120.5,
  claim: 3120.5,
  contingencyPct: 0.33,
  fee: 1029.77,
  filingCost: 350,
  net: 1740.73,
  offers: [
    { key: 'o-theirs', direction: 'received', amount: 3120.5, status: 'open', ymd: '2026-10-28', expiresOn: null },
    { key: 'o-ours', direction: 'made', amount: 7900, status: 'open', ymd: '2026-10-27', expiresOn: '2026-11-12' },
    { key: 'o-old', direction: 'made', amount: 9000, status: 'withdrawn', ymd: '2026-10-20', expiresOn: null },
  ],
}

describe('moneyBars — the Legal desk’s money as bars (v2.6105)', () => {
  it('On the bills: one segment per open bill, oldest first, and the retainage bracket under the job’s bills', () => {
    const { bars } = moneyBars(base)
    const bills = bars.find((b) => b.key === 'bills')!
    expect(bills.total).toBe(3120.5)
    expect(bills.segments.map((s) => s.key)).toEqual(['inv-pa1', 'inv-trip', 'inv-mat'])
    expect(bills.segments.map((s) => s.label)).toEqual(['742 · Jul 9', '742 · Aug 6', '742 · Oct 27'])
    expect(bills.segments.reduce((s, x) => s + x.fraction, 0)).toBeCloseTo(1, 6)
    expect(bills.brackets).toEqual([{ key: 'ret:job-a', label: "retainage $1,750.00 inside 742's bills", amount: 1750, fromFraction: 0, toFraction: expect.closeTo(1750 / 3120.5, 6) }])
    expect(bills.caption).toBe('On the bills · 3 open bills')
  })

  it('The claim: the bills as one block, the hatched stretch to the largest standing offer, and every standing offer as a mark', () => {
    const { bars } = moneyBars(base)
    const claim = bars.find((b) => b.key === 'claim')!
    // The scale reaches our $7,900 offer; the withdrawn $9,000 is history and does not stretch it.
    expect(claim.total).toBe(7900)
    expect(claim.segments.map((s) => [s.kind, s.amount])).toEqual([['bills', 3120.5], ['beyond', 4779.5]])
    expect(claim.segments[1]!.label).toBe('asked beyond the claim on record · $4,779.50')
    expect(claim.marks.map((m) => [m.kind, m.amount, m.label])).toEqual([
      ['theirs', 3120.5, 'their offer · Oct 28'],
      ['ours', 7900, 'our offer · to Nov 12'],
    ])
    // Two marks within 18% of the width alternate rows; their offer and ours sit 60% apart, so both read on row 0.
    expect(claim.marks.map((m) => m.row)).toEqual([0, 0])
    expect(claim.caption).toBe('The claim · $3,120.50 · asked $7,900.00')
  })

  it('the walk-away line (v2.6176) is a green mark on the claim bar at its amount, and only when the bar is drawn', () => {
    const { bars } = moneyBars({ ...base, line: 2500 })
    const claim = bars.find((b) => b.key === 'claim')!
    // Marks sit in amount order: the line under their offer, then their offer, then ours.
    expect(claim.marks.map((m) => [m.kind, m.amount, m.label])).toEqual([
      ['line', 2500, 'above this, settling beats a full win'],
      ['theirs', 3120.5, 'their offer · Oct 28'],
      ['ours', 7900, 'our offer · to Nov 12'],
    ])
    // The line and their offer sit 8% apart, so their offer takes the second row.
    expect(claim.marks.map((m) => m.row)).toEqual([0, 1, 0])
    expect(moneyBars({ ...base, offers: [], line: 2500 }).bars.find((b) => b.key === 'claim')).toBeUndefined()
  })

  it('retainage no bill asks for is drawn once, after the bills, and the claim bar appears for it alone', () => {
    const { bars, words } = moneyBars({ ...base, bills: [base.bills[1]!], retainageOnBillsByJob: new Map(), retainageAdded: 1750, balance: 1750, claim: 3500, offers: [], fee: 1155, net: 1995 })
    const claim = bars.find((b) => b.key === 'claim')!
    expect(claim.total).toBe(3500)
    expect(claim.segments.map((s) => [s.kind, s.amount, s.fraction])).toEqual([['bills', 1750, 0.5], ['retainage', 1750, 0.5]])
    expect(claim.marks).toEqual([])
    expect(words).toBe('One open bill, $1,750.00. The claim adds $1,750.00 of retainage no bill asks for yet.')
  })

  it('no claim bar when the claim is the bills and nothing is offered: the bills bar says it all', () => {
    const { bars } = moneyBars({ ...base, offers: [] })
    expect(bars.map((b) => b.key)).toEqual(['bills', 'left_claim'])
  })

  it('What’s left: keep · firm · filing on the claim, and on the bills alone when the claim is larger', () => {
    const { bars } = moneyBars({ ...base, retainageAdded: 1000, claim: 4120.5, fee: 1359.77, net: 2410.73 })
    const onClaim = bars.find((b) => b.key === 'left_claim')!
    expect(onClaim.caption).toBe('What’s left, on the claim · $2,410.73 left')
    expect(onClaim.segments.map((s) => [s.kind, s.amount])).toEqual([['keep', 2410.73], ['fee', 1359.77], ['filing', 350]])
    const onBills = bars.find((b) => b.key === 'left_bills')!
    expect(onBills.total).toBe(3120.5)
    expect(onBills.segments.map((s) => [s.kind, s.amount])).toEqual([['keep', 1740.73], ['fee', 1029.77], ['filing', 350]])
    expect(onBills.segments[1]!.label).toBe('firm 33% · $1,029.77')
  })

  it('a figure the firm’s cut and the filing cost exceed reads short, never a negative keep', () => {
    const { bars } = moneyBars({ ...base, bills: [{ ...base.bills[2]!, open: 300 }], retainageOnBillsByJob: new Map(), balance: 300, claim: 300, fee: 99, net: -149, offers: [] })
    const left = bars.find((b) => b.key === 'left_claim')!
    expect(left.caption).toBe('What’s left for us · $149.00 short')
    expect(left.segments.map((s) => s.kind)).toEqual(['fee', 'filing', 'short'])
  })

  it('a job with no sent bill draws its remainder as one quiet block, and their offer is read against the claim', () => {
    const { bars, words } = moneyBars({ ...base, bills: [], retainageOnBillsByJob: new Map(), balance: 2500, claim: 2500, fee: 825, net: 1325, offers: [{ key: 'o', direction: 'received', amount: 2000, status: 'countered', ymd: '2026-10-28', expiresOn: null }] })
    const bills = bars.find((b) => b.key === 'bills')!
    expect(bills.segments).toEqual([{ key: 'no-bill', kind: 'bills', label: 'on no bill yet', title: '$2,500.00 owed on no sent bill', amount: 2500, fraction: 1 }])
    expect(words).toBe('$2,500.00 owed on no sent bill. Their offer of $2,000.00 leaves $500.00 of the claim.')
  })

  it('the day words read a date as a date, never through a zone; offers stand while open, countered or accepted', () => {
    expect(moneyBarDayWords('2026-07-09')).toBe('Jul 9')
    expect(moneyBarDayWords('2026-12-31')).toBe('Dec 31')
    expect(moneyBarDayWords('')).toBe('')
    expect(moneyBarDayWords('2026-07-09T23:30:00Z')).toBe('')
    expect(['open', 'countered', 'accepted'].map((s) => offerStands(s as never))).toEqual([true, true, true])
    expect(['withdrawn', 'expired'].map((s) => offerStands(s as never))).toEqual([false, false])
  })
})
