import { describe, expect, it } from 'vitest'
import {
  bidAssignedCostsByBidId,
  bidRealCostTotal,
  emptyBidAssignedCosts,
} from './bidAssignedCosts'

const A = 'bid-a'
const B = 'bid-b'

describe('bidAssignedCostsByBidId', () => {
  it('returns an empty map for no rows', () => {
    expect(bidAssignedCostsByBidId({}).size).toBe(0)
    expect(bidAssignedCostsByBidId({ parts: [], materials: [], supply: [], mercury: [] }).size).toBe(0)
  })

  it('multiplies tally parts by quantity', () => {
    const m = bidAssignedCostsByBidId({ parts: [{ bid_id: A, quantity: 4, fixture_cost: 22 }] })
    expect(m.get(A)?.partsStyle).toBe(88)
    expect(m.get(A)?.total).toBe(88)
  })

  it('coerces PostgREST numeric strings', () => {
    // numeric columns serialise as text — the whole reason num() exists
    const m = bidAssignedCostsByBidId({
      parts: [{ bid_id: A, quantity: '4', fixture_cost: '22.50' }],
      materials: [{ bid_id: A, amount: '890.00' }],
    })
    expect(m.get(A)?.partsStyle).toBe(90)
    expect(m.get(A)?.materials).toBe(890)
    expect(m.get(A)?.total).toBe(980)
  })

  it('treats null quantity or cost as zero rather than NaN', () => {
    const m = bidAssignedCostsByBidId({
      parts: [
        { bid_id: A, quantity: 4, fixture_cost: null },
        { bid_id: A, quantity: null, fixture_cost: 10 },
        { bid_id: A, quantity: 2, fixture_cost: 5 },
      ],
    })
    expect(m.get(A)?.partsStyle).toBe(10)
  })

  it('takes the pct share of a supply invoice, not its full amount', () => {
    const m = bidAssignedCostsByBidId({ supply: [{ bid_id: A, pct: 25, invoice_amount: 400 }] })
    expect(m.get(A)?.partsStyle).toBe(100)
  })

  it('groups parts, card charges and supply splits into one parts-style total', () => {
    const m = bidAssignedCostsByBidId({
      parts: [{ bid_id: A, quantity: 2, fixture_cost: 10 }],
      mercury: [{ bid_id: A, amount: 35 }],
      supply: [{ bid_id: A, pct: 50, invoice_amount: 100 }],
    })
    expect(m.get(A)?.partsStyle).toBe(105)
    expect(m.get(A)?.materials).toBe(0)
  })

  it('keeps bids separate', () => {
    const m = bidAssignedCostsByBidId({
      parts: [{ bid_id: A, quantity: 1, fixture_cost: 10 }],
      materials: [{ bid_id: B, amount: 50 }],
    })
    expect(m.get(A)?.total).toBe(10)
    expect(m.get(B)?.total).toBe(50)
    expect(m.size).toBe(2)
  })

  it('keeps total equal to partsStyle + materials as rows accumulate', () => {
    const m = bidAssignedCostsByBidId({
      parts: [
        { bid_id: A, quantity: 1, fixture_cost: 10 },
        { bid_id: A, quantity: 1, fixture_cost: 5 },
      ],
      materials: [
        { bid_id: A, amount: 20 },
        { bid_id: A, amount: 1 },
      ],
    })
    const c = m.get(A)!
    expect(c.partsStyle).toBe(15)
    expect(c.materials).toBe(21)
    expect(c.total).toBe(36)
  })

  it('ignores rows with no bid id', () => {
    const m = bidAssignedCostsByBidId({ materials: [{ bid_id: '', amount: 100 }] })
    expect(m.size).toBe(0)
  })

  it('handles negative amounts (a refunded card charge)', () => {
    const m = bidAssignedCostsByBidId({
      mercury: [
        { bid_id: A, amount: 100 },
        { bid_id: A, amount: -40 },
      ],
    })
    expect(m.get(A)?.partsStyle).toBe(60)
  })
})

describe('bidRealCostTotal', () => {
  it('adds clocked labor to assigned costs', () => {
    const assigned = { partsStyle: 100, materials: 50, total: 150 }
    expect(bidRealCostTotal(assigned, 3410)).toBe(3560)
  })

  it('works when a bid has labor but nothing assigned', () => {
    expect(bidRealCostTotal(undefined, 3410)).toBe(3410)
    expect(bidRealCostTotal(emptyBidAssignedCosts(), 3410)).toBe(3410)
  })

  it('works when a bid has assigned costs but no labor', () => {
    expect(bidRealCostTotal({ partsStyle: 10, materials: 5, total: 15 }, null)).toBe(15)
    expect(bidRealCostTotal({ partsStyle: 10, materials: 5, total: 15 }, undefined)).toBe(15)
  })

  it('is zero for a bid with neither', () => {
    expect(bidRealCostTotal(undefined, null)).toBe(0)
  })
})
