import { describe, expect, it } from 'vitest'
import { fetchPricesForPart, fetchPricesForParts } from './partPrices'

type Result = { data: unknown; error: unknown }

/** Chainable stub: every from() call pops the next queued result on await. */
function makeClient(results: Result[]) {
  let fromCalls = 0
  const client = {
    from: () => {
      fromCalls++
      const result = results.shift() ?? { data: [], error: null }
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) b[m] = () => b
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
