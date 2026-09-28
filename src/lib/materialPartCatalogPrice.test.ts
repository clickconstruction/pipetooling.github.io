import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeFakeRowCapSupabase } from '../test/fakeRowCapSupabase'
import {
  catalogUnitPricesEffectivelyEqual,
  fetchLowestPartPrice,
  fetchLowestPartPricesBatch,
} from './materialPartCatalogPrice'

const HOUSES = ['Ferguson', 'Winsupply', 'Moore', 'Hajoca', 'Morrison', 'Reece', 'Coburn', 'Apex']

/**
 * `parts` parts priced at `houses` supply houses, house by house, so the table
 * holds every part's dearest price first and its lowest last: part n costs
 * n + 1 at the last house and ten more at each house before it.
 */
function priceRows(parts: number, houses: number) {
  return Array.from({ length: parts * houses }, (_, i) => {
    const house = Math.floor(i / parts)
    const part = i % parts
    return {
      id: `pr${String(i).padStart(5, '0')}`,
      part_id: `p${part}`,
      price: part + 1 + (houses - 1 - house) * 10,
      supply_house_id: `sh${house}`,
      supply_houses: { name: HOUSES[house] },
    }
  })
}

function partIds(count: number) {
  return Array.from({ length: count }, (_, i) => `p${i}`)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchLowestPartPricesBatch', () => {
  it('returns an empty map without a read for no ids', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: priceRows(10, 2) })
    expect((await fetchLowestPartPricesBatch(client, [])).size).toBe(0)
    expect((await fetchLowestPartPricesBatch(client, ['', ''])).size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('reads a second page, so a lowest price past row 1,000 is the one picked', async () => {
    // 150 parts × 8 houses = 1,200 rows in one id chunk; the lowest prices are rows 1,050–1,199.
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: priceRows(150, 8) })
    const map = await fetchLowestPartPricesBatch(client, partIds(150))
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(map.size).toBe(150)
    for (let n = 0; n < 150; n++) {
      expect(map.get(`p${n}`)).toEqual({
        priceId: `pr${String(1050 + n).padStart(5, '0')}`,
        price: n + 1,
        supply_house_id: 'sh7',
        supplyHouseName: 'Apex',
      })
    }
  })

  it('reads the id list in chunks, each one paged, and keeps every part', async () => {
    // 400 parts × 8 houses = 3,200 rows: chunks of 150, 150 and 100 ids hold 1,200, 1,200 and 800.
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: priceRows(400, 8) })
    const map = await fetchLowestPartPricesBatch(client, partIds(400))
    expect(calls.map((c) => [c.in?.[1].length, c.range])).toEqual([
      [150, [0, 999]],
      [150, [1000, 1999]],
      [150, [0, 999]],
      [150, [1000, 1999]],
      [100, [0, 999]],
    ])
    expect(map.size).toBe(400)
    expect(map.get('p0')?.price).toBe(1)
    expect(map.get('p399')?.price).toBe(400)
  })

  it('asks for the same columns in id order on a fresh, ranged query per page', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: priceRows(150, 8) })
    await fetchLowestPartPricesBatch(client, partIds(150))
    expect(calls).toHaveLength(2)
    expect(calls[0]).not.toBe(calls[1])
    for (const call of calls) {
      expect(call.table).toBe('material_part_prices')
      expect(call.select).toBe('id, part_id, price, supply_house_id, supply_houses(name)')
      expect(call.in?.[0]).toBe('part_id')
      expect(call.order).toEqual(['id'])
      expect(call.range).not.toBeNull()
    }
  })

  it('reads each part once when the id list repeats it', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: priceRows(3, 2) })
    const map = await fetchLowestPartPricesBatch(client, ['p1', 'p0', 'p1', '', 'p0'])
    expect(calls).toHaveLength(1)
    expect(calls[0]?.in).toEqual(['part_id', ['p1', 'p0']])
    expect([...map.keys()].sort()).toEqual(['p0', 'p1'])
  })

  it('breaks a tie on price with the lowest price id, whichever row arrives first', async () => {
    const tied = [
      { id: 'b', part_id: 'p0', price: 4, supply_house_id: 'sh1', supply_houses: { name: 'Winsupply' } },
      { id: 'a', part_id: 'p0', price: 4, supply_house_id: 'sh0', supply_houses: { name: 'Ferguson' } },
      { id: 'c', part_id: 'p0', price: 4, supply_house_id: 'sh2', supply_houses: { name: 'Moore' } },
    ]
    for (const rows of [tied, [...tied].reverse()]) {
      const { client } = makeFakeRowCapSupabase({ material_part_prices: rows })
      const map = await fetchLowestPartPricesBatch(client, ['p0'])
      expect(map.get('p0')).toEqual({ priceId: 'a', price: 4, supply_house_id: 'sh0', supplyHouseName: 'Ferguson' })
    }
  })

  it('reads a price sent as text as a number and names a missing supply house with a dash', async () => {
    const { client } = makeFakeRowCapSupabase({
      material_part_prices: [
        { id: 'a', part_id: 'p0', price: '12.50', supply_house_id: 'sh0', supply_houses: null },
        { id: 'b', part_id: 'p0', price: '9.25', supply_house_id: 'sh1', supply_houses: { name: '  ' } },
        { id: 'c', part_id: 'p1', price: 3, supply_house_id: 'sh1', supply_houses: { name: ' Winsupply ' } },
      ],
    })
    const map = await fetchLowestPartPricesBatch(client, ['p0', 'p1', 'p2'])
    expect(map.get('p0')).toEqual({ priceId: 'b', price: 9.25, supply_house_id: 'sh1', supplyHouseName: '—' })
    expect(map.get('p1')?.supplyHouseName).toBe('Winsupply')
    expect(map.has('p2')).toBe(false)
  })

  it('throws under its operation name when the first page fails', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: priceRows(150, 8) }, { failOnCall: 1 })
    await expect(fetchLowestPartPricesBatch(client, partIds(150))).rejects.toThrow(
      'Failed to fetch material part prices batch: boom',
    )
    expect(calls).toHaveLength(1)
  })

  it('throws, and returns no map of the first page, when a later page fails', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: priceRows(150, 8) }, { failOnCall: 2 })
    await expect(fetchLowestPartPricesBatch(client, partIds(150))).rejects.toThrow(
      'Failed to fetch material part prices batch: boom',
    )
    expect(calls).toHaveLength(2)
  })

  it('reads a page again after a dropped connection, and only that page', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, calls } = makeFakeRowCapSupabase(
      { material_part_prices: priceRows(150, 8) },
      { failOnCall: 2, failWith: { message: 'TypeError: Failed to fetch', code: '' }, failStatus: 0 },
    )
    const pending = fetchLowestPartPricesBatch(client, partIds(150))
    await vi.runAllTimersAsync()
    const map = await pending
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [1000, 1999]])
    expect(map.size).toBe(150)
    expect(map.get('p149')?.price).toBe(150)
    vi.restoreAllMocks()
  })
})

describe('fetchLowestPartPrice', () => {
  it('asks for the one part in price order, first row only', async () => {
    const { client, calls } = makeFakeRowCapSupabase({
      material_part_prices: [
        { id: 'a', part_id: 'p0', price: '4.10', supply_house_id: 'sh0', supply_houses: { name: 'Ferguson' } },
        { id: 'b', part_id: 'p0', price: 6, supply_house_id: 'sh1', supply_houses: { name: 'Winsupply' } },
        { id: 'c', part_id: 'p1', price: 1, supply_house_id: 'sh1', supply_houses: { name: 'Winsupply' } },
      ],
    })
    expect(await fetchLowestPartPrice(client, 'p0')).toEqual({
      priceId: 'a',
      price: 4.1,
      supply_house_id: 'sh0',
      supplyHouseName: 'Ferguson',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ eq: [['part_id', 'p0']], order: ['price'], limit: 1 })
  })

  it('resolves null for a part with no price', async () => {
    const { client } = makeFakeRowCapSupabase({ material_part_prices: [] })
    expect(await fetchLowestPartPrice(client, 'p0')).toBeNull()
  })

  it('throws under its operation name when the read fails', async () => {
    const { client } = makeFakeRowCapSupabase({ material_part_prices: [] }, { failOnCall: 1 })
    await expect(fetchLowestPartPrice(client, 'p0')).rejects.toThrow('Failed to fetch lowest material part price: boom')
  })
})

describe('catalogUnitPricesEffectivelyEqual', () => {
  it('calls two prices equal inside half a cent, and not past it', () => {
    expect(catalogUnitPricesEffectivelyEqual(12.5, 12.504)).toBe(true)
    expect(catalogUnitPricesEffectivelyEqual(12.5, 12.496)).toBe(true)
    expect(catalogUnitPricesEffectivelyEqual(12.5, 12.51)).toBe(false)
    expect(catalogUnitPricesEffectivelyEqual(0, 0)).toBe(true)
  })

  it('takes a wider tolerance when given one', () => {
    expect(catalogUnitPricesEffectivelyEqual(10, 10.04, 0.05)).toBe(true)
    expect(catalogUnitPricesEffectivelyEqual(10, 10.06, 0.05)).toBe(false)
  })
})
