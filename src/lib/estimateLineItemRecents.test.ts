import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  estimateLineItemRecentsStorageKey,
  loadRecentCatalogIds,
  persistRecentCatalogIds,
  recordRecentCatalogPick,
  resolveRecentChips,
} from './estimateLineItemRecents'

const g = globalThis as unknown as { localStorage?: unknown }
let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  }
})
afterEach(() => {
  delete g.localStorage
})

describe('recordRecentCatalogPick', () => {
  it('moves the pick to the front, dedupes, caps at 20, ignores blanks', () => {
    expect(recordRecentCatalogPick(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
    expect(recordRecentCatalogPick(['a'], ' ')).toEqual(['a'])
    const many = Array.from({ length: 25 }, (_, i) => `id${i}`)
    expect(recordRecentCatalogPick(many, 'new')).toHaveLength(20)
    expect(recordRecentCatalogPick(many, 'new')[0]).toBe('new')
  })
})

describe('load / persist', () => {
  it('round-trips, dedupes and caps on read, and tolerates junk', () => {
    const key = estimateLineItemRecentsStorageKey('u1')
    expect(key).toBe('estimate_line_item_recents_v1:u1')
    persistRecentCatalogIds(key, ['a', 'b'])
    expect(loadRecentCatalogIds(key)).toEqual(['a', 'b'])
    store.set(key, JSON.stringify(['a', ' a ', 3, '', 'b']))
    expect(loadRecentCatalogIds(key)).toEqual(['a', 'b'])
    store.set(key, '{not json')
    expect(loadRecentCatalogIds(key)).toEqual([])
    store.set(key, JSON.stringify({ a: 1 }))
    expect(loadRecentCatalogIds(key)).toEqual([])
    expect(loadRecentCatalogIds('missing')).toEqual([])
  })
})

describe('resolveRecentChips', () => {
  it('returns at most three chips, only for ids still in the catalog, in recency order', () => {
    const cat = ['a', 'b', 'c', 'd'].map((id) => ({ id, line_item: id.toUpperCase(), description: `d${id}`, quantity: 1, unit_price_cents: 100, amount_cents: 100 }))
    const chips = resolveRecentChips(['zzz', 'c', 'a', 'd', 'b'], cat)
    expect(chips.map((c) => c.id)).toEqual(['c', 'a', 'd'])
    expect(chips[0]).toEqual({ id: 'c', line_item: 'C', description: 'dc', quantity: 1, unit_price_cents: 100, amount_cents: 100 })
    expect(resolveRecentChips([], cat)).toEqual([])
  })
})
