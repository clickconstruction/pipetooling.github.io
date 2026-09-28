import { describe, expect, it } from 'vitest'
import { makeFakeRowCapSupabase } from '../../test/fakeRowCapSupabase'
import { fetchPricesForPart, fetchPricesForParts, loadPartPriceRows } from './partPrices'

type Result = { data: unknown; error: unknown }

/** Chainable stub: every from() call pops the next queued result on await. */
function makeClient(results: Result[]) {
  let fromCalls = 0
  const client = {
    from: () => {
      fromCalls++
      const result = results.shift() ?? { data: [], error: null }
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit', 'range']) b[m] = () => b
      b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(f, r)
      return b
    },
  }
  return {
    client: client as unknown as Parameters<typeof fetchPricesForParts>[0],
    fromCallCount: () => fromCalls,
  }
}

function priceRow(part_id: string, price: number, shName: string) {
  return { id: `${part_id}-${price}`, part_id, price, supply_houses: { id: `sh-${shName}`, name: shName } }
}

describe('fetchPricesForParts', () => {
  it('groups rows by part_id and hydrates supply_house', async () => {
    const { client } = makeClient([
      { data: [priceRow('p-1', 5, 'Ferguson'), priceRow('p-2', 3, 'Winsupply'), priceRow('p-1', 9, 'Winsupply')], error: null },
    ])
    const map = await fetchPricesForParts(client, ['p-1', 'p-2'])
    expect(map.get('p-1')?.map(p => p.price)).toEqual([5, 9])
    expect(map.get('p-1')?.[0]?.supply_house.name).toBe('Ferguson')
    expect(map.get('p-2')).toHaveLength(1)
  })

  it('re-sorts each part ascending across chunk boundaries', async () => {
    // 501 IDs -> two chunks; the same part appears in both with out-of-order prices
    const ids = Array.from({ length: 501 }, (_, i) => `p-${i}`)
    const { client, fromCallCount } = makeClient([
      { data: [priceRow('p-0', 9, 'Ferguson')], error: null },
      { data: [priceRow('p-0', 2, 'Winsupply')], error: null },
    ])
    const map = await fetchPricesForParts(client, ids)
    expect(fromCallCount()).toBe(2)
    expect(map.get('p-0')?.map(p => p.price)).toEqual([2, 9])
  })

  it('returns an empty map without querying for no IDs', async () => {
    const { client, fromCallCount } = makeClient([])
    expect((await fetchPricesForParts(client, [])).size).toBe(0)
    expect(fromCallCount()).toBe(0)
  })
})

/**
 * `parts` parts priced at three supply houses, house by house, dearest house
 * first: part n costs n + 21, then n + 11, then n + 1.
 */
function cappedPriceRows(parts: number) {
  return Array.from({ length: parts * 3 }, (_, i) => {
    const house = Math.floor(i / parts)
    const part = i % parts
    return {
      id: `pr${String(i).padStart(5, '0')}`,
      part_id: `p${part}`,
      price: part + 1 + (2 - house) * 10,
      supply_house_id: `sh${house}`,
      supply_houses: { id: `sh${house}`, name: ['Ferguson', 'Winsupply', 'Moore'][house] },
    }
  })
}

function cappedPartIds(count: number) {
  return Array.from({ length: count }, (_, i) => `p${i}`)
}

describe('fetchPricesForParts past the 1,000-row cap', () => {
  it('pages a 500-part chunk, so every part keeps all its prices, lowest first', async () => {
    // 500 parts × 3 houses = 1,500 rows in ONE chunk; each part's lowest price is rows 1,000–1,499.
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: cappedPriceRows(500) })
    const map = await fetchPricesForParts(client, cappedPartIds(500))
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(map.size).toBe(500)
    for (let n = 0; n < 500; n++) {
      expect(map.get(`p${n}`)?.map((p) => p.price)).toEqual([n + 1, n + 11, n + 21])
    }
    expect(map.get('p499')?.[0]?.supply_house.name).toBe('Moore')
  })

  it('keeps the 500-id chunks and orders every page by price, then id', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: cappedPriceRows(700) })
    const map = await fetchPricesForParts(client, cappedPartIds(700))
    expect(calls.map((c) => [c.in?.[1].length, c.range])).toEqual([
      [500, [0, 999]],
      [500, [1000, 1999]],
      [200, [0, 999]],
    ])
    for (const call of calls) {
      expect(call.table).toBe('material_part_prices')
      expect(call.select).toBe('*, supply_houses(*)')
      expect(call.in?.[0]).toBe('part_id')
      expect(call.order).toEqual(['price', 'id'])
    }
    expect(map.size).toBe(700)
  })

  it('does not throw when a chunk fails: that chunk adds no prices, the next one loads', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: cappedPriceRows(700) }, { failOnCall: 1 })
    const map = await fetchPricesForParts(client, cappedPartIds(700))
    expect(calls).toHaveLength(2)
    expect(map.size).toBe(200)
    expect(map.has('p0')).toBe(false)
    expect(map.get('p500')?.map((p) => p.price)).toEqual([501, 511, 521])
  })

  it('drops the whole chunk, not just the page, when its second page fails', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: cappedPriceRows(700) }, { failOnCall: 2 })
    const map = await fetchPricesForParts(client, cappedPartIds(700))
    expect(calls).toHaveLength(3)
    expect(map.size).toBe(200)
    expect(map.has('p0')).toBe(false)
    expect(map.has('p699')).toBe(true)
  })
})

describe('loadPartPriceRows', () => {
  it('returns [] without a read for no ids', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: cappedPriceRows(10) })
    expect(await loadPartPriceRows(client, [], 'part_id, price')).toEqual([])
    expect(await loadPartPriceRows(client, [''], 'part_id, price')).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('reads ids once each in chunks of 150, in id order unless asked for price order', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: cappedPriceRows(200) })
    const rows = await loadPartPriceRows(client, [...cappedPartIds(200), 'p0', 'p1'], 'part_id, price')
    expect(rows).toHaveLength(600)
    expect(calls.map((c) => [c.in?.[1].length, c.range, c.order])).toEqual([
      [150, [0, 999], ['id']],
      [50, [0, 999], ['id']],
    ])
    await loadPartPriceRows(client, ['p0'], 'part_id, price', { orderByPrice: true, chunkSize: 500 })
    expect(calls[2]?.order).toEqual(['price', 'id'])
  })

  it('throws under the given operation name on a page error', async () => {
    const { client } = makeFakeRowCapSupabase({ material_part_prices: cappedPriceRows(10) }, { failOnCall: 1 })
    await expect(loadPartPriceRows(client, ['p0'], 'part_id, price', { label: 'load test prices' })).rejects.toThrow(
      'Failed to load test prices: boom',
    )
  })
})

describe('fetchPricesForPart', () => {
  it('maps to supply_house_name/price options', async () => {
    const { client } = makeClient([
      { data: [priceRow('p-1', 5, 'Ferguson'), priceRow('p-1', 8, 'Winsupply')], error: null },
    ])
    expect(await fetchPricesForPart(client, 'p-1')).toEqual([
      { supply_house_name: 'Ferguson', price: 5 },
      { supply_house_name: 'Winsupply', price: 8 },
    ])
  })

  it('returns [] on error', async () => {
    const { client } = makeClient([{ data: null, error: { message: 'boom' } }])
    expect(await fetchPricesForPart(client, 'p-1')).toEqual([])
  })
})
