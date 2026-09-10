import { describe, expect, it } from 'vitest'
import { diffDiscountSnapshots, discountSnapshot } from './discountActivity'
import type { DiscountLineRow } from './discountLine'

const work = (id: string, name: string, price: number): DiscountLineRow => ({ id, name, count: 1, line_unit_price: price, invoice_id: null })
const job892 = () => [work('a', 'Rough In', 15098), work('b', 'Top Out', 15098), work('c', 'Trim Set', 7549)]
const pct = (id: string, p: number, o: Partial<DiscountLineRow> = {}): DiscountLineRow => ({
  id,
  name: 'Negotiated discount',
  count: 1,
  line_unit_price: null,
  line_kind: 'discount',
  discount_pct: p,
  discount_basis_ids: null,
  invoice_id: null,
  ...o,
})

describe('discountSnapshot', () => {
  it('describes each money-bearing discount; an empty new row is not yet a discount', () => {
    const snap = discountSnapshot([...job892(), pct('d', 10), pct('e', 5, { name: '', discount_pct: null })])
    expect(snap).toEqual([{ id: 'd', name: 'Negotiated discount', pct: 10, dollars: 3774.5, basis: 'all 3 work lines' }])
  })
})

describe('diffDiscountSnapshots', () => {
  const rows = [...job892(), pct('d', 10)]
  const before = discountSnapshot(job892())
  const after = discountSnapshot(rows)

  it('added', () => {
    expect(diffDiscountSnapshots(before, after)).toEqual([
      {
        event_type: 'discount_added',
        summary: 'Discount added: Negotiated discount (10%) −$3,774.50 · all 3 work lines',
        detail: { name: 'Negotiated discount', pct: 10, dollars: 3774.5, basis: 'all 3 work lines' },
      },
    ])
  })
  it('changed — amount, then basis, then name; nothing when nothing moved', () => {
    expect(diffDiscountSnapshots(after, after)).toEqual([])
    const bumped = discountSnapshot([...job892(), pct('d', 12)])
    expect(diffDiscountSnapshots(after, bumped)[0]!.summary).toBe('Discount changed: Negotiated discount 10% (−$3,774.50) → 12% (−$4,529.40)')
    const narrowed = discountSnapshot([...job892(), pct('d', 10, { discount_basis_ids: ['a', 'b'] })])
    expect(diffDiscountSnapshots(after, narrowed)[0]!.summary).toBe('Discount changed: Negotiated discount 10% (−$3,774.50) → 10% (−$3,019.60) · all 3 work lines → Rough In, Top Out')
    const usd = discountSnapshot([...job892(), pct('d', 10, { name: 'Referral thank-you', discount_pct: null, line_unit_price: -500 })])
    expect(diffDiscountSnapshots(after, usd)[0]!.summary).toBe('Discount changed: Negotiated discount → Referral thank-you · 10% (−$3,774.50) → −$500.00')
  })
  it('removed — including a row whose amount dropped to nothing', () => {
    expect(diffDiscountSnapshots(after, before)).toEqual([
      {
        event_type: 'discount_removed',
        summary: 'Discount removed: Negotiated discount (10%) −$3,774.50',
        detail: { name: 'Negotiated discount', pct: 10, dollars: 3774.5, basis: 'all 3 work lines' },
      },
    ])
    const zeroed = discountSnapshot([...job892(), pct('d', 10, { discount_pct: null, line_unit_price: null })])
    expect(diffDiscountSnapshots(after, zeroed).map((e) => e.event_type)).toEqual(['discount_removed'])
  })
})
