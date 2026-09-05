import { describe, it, expect } from 'vitest'
import {
  paidFlipDetected,
  parsePortalBillsSnapshot,
  portalBillKey,
  snapshotPortalBills,
  type PortalBillsSnapshot,
} from './portalPaidFlip'

const before: PortalBillsSnapshot = {
  bills: [
    { key: 'pay:https://invoice.stripe.com/a', amount: 1450 },
    { key: 'job:Service call · Job 655|2026-08-18', amount: 250 },
  ],
  totalDue: 1700,
}

describe('paidFlipDetected', () => {
  it('a bill gone and the balance down → payment received', () => {
    expect(paidFlipDetected(before, { bills: [before.bills[1]!], totalDue: 250 })).toBe(true)
  })

  it('a partial payment (same bill, smaller amount, balance down) counts too', () => {
    expect(
      paidFlipDetected(before, { bills: [{ key: before.bills[0]!.key, amount: 950 }, before.bills[1]!], totalDue: 1200 }),
    ).toBe(true)
  })

  it('first look (no before) or nothing owed before → never', () => {
    expect(paidFlipDetected(null, { bills: [], totalDue: 0 })).toBe(false)
    expect(paidFlipDetected(undefined, { bills: [], totalDue: 0 })).toBe(false)
    expect(paidFlipDetected({ bills: [], totalDue: 0 }, { bills: [], totalDue: 0 })).toBe(false)
  })

  it('identical loads, a new bill appearing, or a balance that did not drop → false', () => {
    expect(paidFlipDetected(before, before)).toBe(false)
    expect(paidFlipDetected(before, { bills: [...before.bills, { key: 'pay:https://invoice.stripe.com/n', amount: 100 }], totalDue: 1800 })).toBe(false)
    // A bill swapped for a same-priced one (re-bill) with the balance unchanged is not a payment.
    expect(paidFlipDetected(before, { bills: [{ key: 'pay:https://invoice.stripe.com/z', amount: 1450 }, before.bills[1]!], totalDue: 1700 })).toBe(false)
  })

  it('a balance that drops without any bill shrinking or vanishing is not claimed as a payment', () => {
    expect(paidFlipDetected(before, { bills: before.bills, totalDue: 1600 })).toBe(false)
  })
})

describe('snapshot helpers', () => {
  it('keys a bill by its pay URL when it has one, else job label + billed date', () => {
    expect(portalBillKey({ payUrl: ' https://invoice.stripe.com/a ', jobLabel: 'X', billedOn: '2026-01-01', amount: 1 })).toBe('pay:https://invoice.stripe.com/a')
    expect(portalBillKey({ payUrl: null, jobLabel: 'Service call · Job 655', billedOn: '2026-08-18', amount: 1 })).toBe('job:Service call · Job 655|2026-08-18')
    expect(portalBillKey({ payUrl: '', jobLabel: 'J', billedOn: null, amount: 1 })).toBe('job:J|')
  })

  it('snapshot → JSON → parse round-trips; malformed input parses to null', () => {
    const snap = snapshotPortalBills({
      bills: [
        { payUrl: 'https://invoice.stripe.com/a', jobLabel: 'A', billedOn: '2026-08-04', amount: 1450 },
        { payUrl: null, jobLabel: 'Service call · Job 655', billedOn: '2026-08-18', amount: 250 },
      ],
      totalDue: 1700,
    })
    expect(snap).toEqual(before)
    expect(parsePortalBillsSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(before)
    expect(parsePortalBillsSnapshot(null)).toBeNull()
    expect(parsePortalBillsSnapshot({ bills: 'nope', totalDue: 1 })).toBeNull()
    expect(parsePortalBillsSnapshot({ bills: [{ key: 1, amount: 2 }], totalDue: 1 })).toBeNull()
    expect(parsePortalBillsSnapshot({ bills: [], totalDue: Number.NaN })).toBeNull()
  })
})
