import { describe, expect, it } from 'vitest'
import { makeFakeRowCapSupabase } from '../../test/fakeRowCapSupabase'
import {
  loadAllAssemblyItemLinks,
  loadAssemblyItemLinksForTemplates,
  loadLowestPriceByPartId,
  partIdsOfAssemblyItems,
} from './assemblyItems'

/** 1,400 part rows: assemblies t0…t139 hold ten each. */
const items = Array.from({ length: 1400 }, (_, i) => ({
  id: `i${String(i).padStart(5, '0')}`,
  template_id: `t${Math.floor(i / 10)}`,
  item_type: 'part',
  part_id: `p${i}`,
  nested_template_id: null,
  quantity: 1,
}))

describe('loadAllAssemblyItemLinks', () => {
  it('pages past the 1,000-row cap', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: items })
    expect(await loadAllAssemblyItemLinks(client)).toHaveLength(1400)
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
  })

  it('throws on a page error', async () => {
    const { client } = makeFakeRowCapSupabase({ material_template_items: items }, { failOnCall: 2 })
    await expect(loadAllAssemblyItemLinks(client)).rejects.toThrow()
  })
})

describe('loadAssemblyItemLinksForTemplates', () => {
  it('returns [] without a read for no ids', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: items })
    expect(await loadAssemblyItemLinksForTemplates(client, [])).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('reads every row of the asked assemblies when they hold more than 1,000 between them', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: items })
    const ids = Array.from({ length: 120 }, (_, i) => `t${i}`)
    const rows = await loadAssemblyItemLinksForTemplates(client, ids)
    expect(rows).toHaveLength(1200)
    expect(new Set(rows.map((r) => r.template_id)).size).toBe(120)
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(calls.every((c) => c.order.join() === 'id')).toBe(true)
  })

  it('splits a long id list into chunks of 150 and asks for each id once', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: items })
    const ids = [...Array.from({ length: 140 }, (_, i) => `t${i}`), 't0', 't1', ...Array.from({ length: 60 }, (_, i) => `none${i}`)]
    const rows = await loadAssemblyItemLinksForTemplates(client, ids)
    expect(rows).toHaveLength(1400)
    expect(calls.map((c) => c.in?.[1].length)).toEqual([150, 150, 50])
  })

  it('throws on a page error', async () => {
    const { client } = makeFakeRowCapSupabase({ material_template_items: items }, { failOnCall: 1 })
    await expect(loadAssemblyItemLinksForTemplates(client, ['t0'])).rejects.toThrow()
  })
})

describe('partIdsOfAssemblyItems', () => {
  it('lists each directly held part once and skips nested assemblies and blank ids', () => {
    expect(
      partIdsOfAssemblyItems([
        { template_id: 'a', item_type: 'part', part_id: 'p1', nested_template_id: null, quantity: 1 },
        { template_id: 'b', item_type: 'part', part_id: 'p1', nested_template_id: null, quantity: 4 },
        { template_id: 'b', item_type: 'template', part_id: null, nested_template_id: 'a', quantity: 1 },
        { template_id: 'b', item_type: 'part', part_id: null, nested_template_id: null, quantity: 1 },
        { template_id: 'c', item_type: 'part', part_id: 'p2', nested_template_id: null, quantity: 1 },
      ]),
    ).toEqual(['p1', 'p2'])
  })
})

describe('loadLowestPriceByPartId', () => {
  /** Three supply houses per part; the lowest price of part n is n + 1. */
  const prices = Array.from({ length: 1500 }, (_, i) => ({
    id: `pr${String(i).padStart(5, '0')}`,
    part_id: `p${i % 500}`,
    price: (i % 500) + 1 + Math.floor(i / 500) * 10,
  }))

  it('returns {} without a read for no ids', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: prices })
    expect(await loadLowestPriceByPartId(client, [])).toEqual({})
    expect(calls).toHaveLength(0)
  })

  it('keeps the lowest price of every part when the price rows pass 1,000', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_part_prices: prices })
    const ids = Array.from({ length: 500 }, (_, i) => `p${i}`)
    const map = await loadLowestPriceByPartId(client, ids)
    expect(Object.keys(map)).toHaveLength(500)
    expect(map.p0).toBe(1)
    expect(map.p499).toBe(500)
    expect(calls.every((c) => c.range != null && c.table === 'material_part_prices')).toBe(true)
  })

  it('throws on a page error', async () => {
    const { client } = makeFakeRowCapSupabase({ material_part_prices: prices }, { failOnCall: 1 })
    await expect(loadLowestPriceByPartId(client, ['p0'])).rejects.toThrow()
  })
})
