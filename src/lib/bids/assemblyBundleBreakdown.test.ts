import { describe, expect, it } from 'vitest'
import { makeFakeRowCapSupabase } from '../../test/fakeRowCapSupabase'
import {
  aggregatePartPricesBySupplyHouse,
  buildBundlePartLines,
  loadBundleBreakdown,
  loadBundlePartLines,
} from './assemblyBundleBreakdown'

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

/**
 * One assembly ("kit") of `parts` parts, one of each, priced at four supply
 * houses, house by house: part n costs n + 1 at sh0 and one more at each
 * house after it. 300 parts make 1,200 price rows.
 */
function bundleTables(parts: number) {
  const n = Array.from({ length: parts }, (_, i) => i)
  return {
    material_template_items: n.map((i) => ({
      id: `i${i}`,
      template_id: 'kit',
      item_type: 'part',
      part_id: `p${i}`,
      nested_template_id: null,
      quantity: 1,
    })),
    material_parts: n.map((i) => ({ id: `p${i}`, name: `Part ${String(i).padStart(4, '0')}` })),
    material_part_prices: [0, 1, 2, 3].flatMap((house) =>
      n.map((i) => ({
        id: `pr${String(house * parts + i).padStart(5, '0')}`,
        part_id: `p${i}`,
        supply_house_id: `sh${house}`,
        price: i + 1 + house,
        supply_houses: { name: `House ${house}` },
      })),
    ),
    material_template_prices: [],
    supply_houses: [0, 1, 2, 3].map((house) => ({ id: `sh${house}`, name: `House ${house}` })),
  }
}

/** 1 + 2 + … + parts: what the assembly costs at sh0. */
function sumTo(parts: number) {
  return (parts * (parts + 1)) / 2
}

describe('loadBundleBreakdown', () => {
  it('prices every part at every supply house when the price rows pass 1,000', async () => {
    const { client, calls } = makeFakeRowCapSupabase(bundleTables(300))
    const breakdown = await loadBundleBreakdown(client, 'kit')
    expect(breakdown.parts).toHaveLength(300)
    expect(breakdown.perSupplyHouse).toEqual(
      [0, 1, 2, 3].map((house) => ({
        supplyHouseId: `sh${house}`,
        supplyHouseName: `House ${house}`,
        total: sumTo(300) + 300 * house,
        missingCount: 0,
      })),
    )
    const priceCalls = calls.filter((c) => c.table === 'material_part_prices')
    expect(priceCalls.map((c) => [c.in?.[1].length, c.range, c.order])).toEqual([
      [150, [0, 999], ['id']],
      [150, [0, 999], ['id']],
    ])
  })

  it('pages inside an id chunk that holds more than 1,000 price rows', async () => {
    const tables = bundleTables(150)
    // Four more houses on the same 150 parts: 1,200 rows in the one chunk.
    tables.material_part_prices.push(
      ...tables.material_part_prices.map((r, i) => ({
        ...r,
        id: `px${String(i).padStart(5, '0')}`,
        supply_house_id: `${r.supply_house_id}b`,
      })),
    )
    const { client, calls } = makeFakeRowCapSupabase(tables)
    const breakdown = await loadBundleBreakdown(client, 'kit')
    expect(calls.filter((c) => c.table === 'material_part_prices').map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    expect(breakdown.perSupplyHouse).toHaveLength(8)
    expect(breakdown.perSupplyHouse.every((h) => h.missingCount === 0)).toBe(true)
  })

  it('lists the parts and prices nothing when the prices read fails', async () => {
    const dry = makeFakeRowCapSupabase(bundleTables(300))
    await loadBundleBreakdown(dry.client, 'kit')
    const lastPriceRead = dry.calls.map((c) => c.table).lastIndexOf('material_part_prices') + 1
    const { client } = makeFakeRowCapSupabase(bundleTables(300), { failOnCall: lastPriceRead })
    const breakdown = await loadBundleBreakdown(client, 'kit')
    expect(breakdown.parts).toHaveLength(300)
    expect(breakdown.perSupplyHouse).toEqual([])
  })
})

describe('loadBundlePartLines', () => {
  it('shows each part at its lowest price when the price rows pass 1,000', async () => {
    const tables = bundleTables(300)
    tables.material_part_prices.reverse()
    const { client, calls } = makeFakeRowCapSupabase(tables)
    const lines = await loadBundlePartLines(client, 'kit')
    expect(lines).toHaveLength(300)
    expect(lines[0]).toEqual({
      partId: 'p0',
      name: 'Part 0000',
      quantity: 1,
      unitPrice: 1,
      supplyHouseName: 'House 0',
      hasPrice: true,
    })
    expect(lines[299]?.unitPrice).toBe(300)
    expect(calls.filter((c) => c.table === 'material_part_prices').every((c) => c.range != null)).toBe(true)
  })
})
