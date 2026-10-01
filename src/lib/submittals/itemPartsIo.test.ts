import { describe, expect, it } from 'vitest'
import { partInsertBatches } from './itemPartsIo'
import type { SubmittalPartInsert } from './itemParts'

const base = (n: number): SubmittalPartInsert => ({ item_id: `i${n}`, bid_id: 'b', sequence_order: n, label: `P${n}` })

describe('partInsertBatches', () => {
  it('a split: the carried part (its key) and the copies (no key) go in separate batches', () => {
    const carried = { ...base(1), procure_key: 'k1', carried_from_part_id: 'p1' }
    const copy = { ...base(2), carried_from_part_id: null }
    const batches = partInsertBatches([carried, copy, { ...copy, item_id: 'i3' }])
    expect(batches).toHaveLength(2)
    expect(batches[0]).toEqual([carried])
    expect(batches[1]?.map((r) => r.item_id)).toEqual(['i2', 'i3'])
  })

  it('a field left undefined counts as left out', () => {
    const batches = partInsertBatches([{ ...base(1), procure_key: undefined }, base(2)])
    expect(batches).toHaveLength(1)
  })

  it('one shape still goes 200 at a time', () => {
    const rows = Array.from({ length: 450 }, (_, i) => base(i))
    expect(partInsertBatches(rows).map((b) => b.length)).toEqual([200, 200, 50])
  })
})
