import { describe, expect, it } from 'vitest'
import { aggregatePartPricesBySupplyHouse, buildBundlePartLines } from './assemblyBundleBreakdown'

describe('aggregatePartPricesBySupplyHouse', () => {
  it('sums unit_price × quantity per supply house', () => {
    const parts = [
      { partId: 'a', quantity: 2 },
      { partId: 'b', quantity: 3 },
    ]
    const prices = [
      { partId: 'a', supplyHouseId: 'h1', price: 10 },
      { partId: 'b', supplyHouseId: 'h1', price: 5 },
    ]
    const result = aggregatePartPricesBySupplyHouse(parts, prices)
    expect(result).toEqual([{ supplyHouseId: 'h1', total: 2 * 10 + 3 * 5, missingCount: 0 }])
  })

  it('counts parts a house does not price and excludes them from the total', () => {
    const parts = [
      { partId: 'a', quantity: 1 },
      { partId: 'b', quantity: 1 },
    ]
    const prices = [
      // h1 prices both; h2 prices only a.
      { partId: 'a', supplyHouseId: 'h1', price: 10 },
      { partId: 'b', supplyHouseId: 'h1', price: 20 },
      { partId: 'a', supplyHouseId: 'h2', price: 8 },
    ]
    const result = aggregatePartPricesBySupplyHouse(parts, prices)
    const byHouse = Object.fromEntries(result.map((r) => [r.supplyHouseId, r]))
    expect(byHouse.h1).toEqual({ supplyHouseId: 'h1', total: 30, missingCount: 0 })
    expect(byHouse.h2).toEqual({ supplyHouseId: 'h2', total: 8, missingCount: 1 })
  })

  it('omits supply houses that price none of the assembly parts', () => {
    const parts = [{ partId: 'a', quantity: 1 }]
    const prices = [
      { partId: 'a', supplyHouseId: 'h1', price: 10 },
      // h2 only prices an unrelated part, so it should not appear.
      { partId: 'z', supplyHouseId: 'h2', price: 99 },
    ]
    const result = aggregatePartPricesBySupplyHouse(parts, prices)
    expect(result).toEqual([{ supplyHouseId: 'h1', total: 10, missingCount: 0 }])
  })

  it('merges duplicate part rows in the expansion before pricing', () => {
    const parts = [
      { partId: 'a', quantity: 2 },
      { partId: 'a', quantity: 3 },
    ]
    const prices = [{ partId: 'a', supplyHouseId: 'h1', price: 4 }]
    const result = aggregatePartPricesBySupplyHouse(parts, prices)
    // 5 total qty × 4, counted once.
    expect(result).toEqual([{ supplyHouseId: 'h1', total: 20, missingCount: 0 }])
  })

  it('returns an empty array for empty parts or empty prices', () => {
    expect(aggregatePartPricesBySupplyHouse([], [])).toEqual([])
    expect(aggregatePartPricesBySupplyHouse([], [{ partId: 'a', supplyHouseId: 'h1', price: 1 }])).toEqual([])
    expect(aggregatePartPricesBySupplyHouse([{ partId: 'a', quantity: 1 }], [])).toEqual([])
  })

  it('handles a house missing every part (missingCount = total parts) by omitting it', () => {
    const parts = [
      { partId: 'a', quantity: 1 },
      { partId: 'b', quantity: 1 },
    ]
    const prices = [{ partId: 'a', supplyHouseId: 'h1', price: 5 }]
    const result = aggregatePartPricesBySupplyHouse(parts, prices)
    // h1 prices 1 of 2 parts.
    expect(result).toEqual([{ supplyHouseId: 'h1', total: 5, missingCount: 1 }])
  })

  it('coerces non-numeric quantities and prices to 0', () => {
    const parts = [{ partId: 'a', quantity: Number.NaN }]
    const prices = [{ partId: 'a', supplyHouseId: 'h1', price: 10 }]
    const result = aggregatePartPricesBySupplyHouse(parts, prices)
    expect(result).toEqual([{ supplyHouseId: 'h1', total: 0, missingCount: 0 }])
  })
})

describe('buildBundlePartLines', () => {
  it('attaches name and lowest catalog price, sorted by name', () => {
    const expanded = [
      { partId: 'b', quantity: 2 },
      { partId: 'a', quantity: 1 },
    ]
    const names = new Map([
      ['a', 'Apple'],
      ['b', 'Banana'],
    ])
    const lowest = new Map([
      ['a', { price: 10, supplyHouseName: 'H1' }],
      ['b', { price: 5, supplyHouseName: 'H2' }],
    ])
    const result = buildBundlePartLines(expanded, names, lowest)
    expect(result).toEqual([
      { partId: 'a', name: 'Apple', quantity: 1, unitPrice: 10, supplyHouseName: 'H1', hasPrice: true },
      { partId: 'b', name: 'Banana', quantity: 2, unitPrice: 5, supplyHouseName: 'H2', hasPrice: true },
    ])
  })

  it('merges duplicate parts before shaping', () => {
    const expanded = [
      { partId: 'a', quantity: 2 },
      { partId: 'a', quantity: 3 },
    ]
    const result = buildBundlePartLines(expanded, new Map([['a', 'Apple']]), new Map())
    expect(result).toEqual([
      { partId: 'a', name: 'Apple', quantity: 5, unitPrice: 0, supplyHouseName: null, hasPrice: false },
    ])
  })

  it('marks parts with no catalog price as hasPrice:false at unitPrice 0', () => {
    const result = buildBundlePartLines(
      [{ partId: 'x', quantity: 1 }],
      new Map([['x', 'Widget']]),
      new Map(),
    )
    expect(result[0]).toMatchObject({ unitPrice: 0, hasPrice: false, supplyHouseName: null })
  })

  it('falls back to a short id when the name is missing', () => {
    const result = buildBundlePartLines(
      [{ partId: 'abcdef123456', quantity: 1 }],
      new Map(),
      new Map(),
    )
    expect(result[0]!.name).toBe('abcdef12')
  })

  it('returns an empty array for no parts', () => {
    expect(buildBundlePartLines([], new Map(), new Map())).toEqual([])
  })
})
