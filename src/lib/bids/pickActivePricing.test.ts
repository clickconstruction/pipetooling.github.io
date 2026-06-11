import { describe, expect, it } from 'vitest'
import { nextSortOrder, pickActivePricing } from './pickActivePricing'

describe('pickActivePricing', () => {
  const pricings = [
    { id: 'p2', sort_order: 1 },
    { id: 'p0', sort_order: 0 },
    { id: 'p1', sort_order: 2 },
  ]

  it('keeps the saved Pricing when it is still among the bid Pricings', () => {
    expect(pickActivePricing({ savedVersionId: 'p1', bidPricings: pricings })).toBe('p1')
  })

  it('falls back to the lowest sort_order when the saved id is not a current Pricing', () => {
    // e.g. saved id points at a legacy global version but Pricings now exist
    expect(pickActivePricing({ savedVersionId: 'global-x', bidPricings: pricings })).toBe('p0')
  })

  it('selects the lowest sort_order when there is no saved id', () => {
    expect(pickActivePricing({ savedVersionId: null, bidPricings: pricings })).toBe('p0')
  })

  it('passes a legacy global selection through when the bid has no Pricings yet', () => {
    expect(pickActivePricing({ savedVersionId: 'global-x', bidPricings: [] })).toBe('global-x')
  })

  it('returns null when there are no Pricings and no saved selection', () => {
    expect(pickActivePricing({ savedVersionId: null, bidPricings: [] })).toBeNull()
  })

  it('selects a freshly cloned Pricing once it is in the set (post-clone)', () => {
    const after = [...pricings, { id: 'pNew', sort_order: 3 }]
    expect(pickActivePricing({ savedVersionId: 'pNew', bidPricings: after })).toBe('pNew')
  })
})

describe('nextSortOrder', () => {
  it('starts at 0 for an empty bid', () => {
    expect(nextSortOrder([])).toBe(0)
  })

  it('appends after the current max', () => {
    expect(nextSortOrder([{ sort_order: 0 }, { sort_order: 2 }, { sort_order: 1 }])).toBe(3)
  })
})
