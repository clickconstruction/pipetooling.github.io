import { describe, expect, it } from 'vitest'
import { pinAfterDrop, pinnedIds, pinsByTrade, rankWrites, unpin } from './subsRanks'

const rows = [
  { prospect_id: 'a', trade: 'Fire sprinkler', rank_order: 2 },
  { prospect_id: 'b', trade: 'fire sprinkler', rank_order: 1 },
  { prospect_id: 'c', trade: 'Concrete', rank_order: 1 },
]

describe('subsRanks', () => {
  it('reads the pins by trade, case-blind, and lists a column’s pins top first', () => {
    const pins = pinsByTrade(rows)
    expect([...pins.keys()]).toEqual(['fire sprinkler', 'concrete'])
    expect(pinnedIds(pins.get('fire sprinkler'))).toEqual(['b', 'a'])
    expect(pinnedIds(undefined)).toEqual([])
  })

  it('pins a dropped card where it landed among the pins, or last among them below', () => {
    expect(pinAfterDrop(['b', 'a'], 'z', 0)).toEqual(['z', 'b', 'a'])
    expect(pinAfterDrop(['b', 'a'], 'z', 1)).toEqual(['b', 'z', 'a'])
    expect(pinAfterDrop(['b', 'a'], 'z', 7)).toEqual(['b', 'a', 'z'])
    expect(pinAfterDrop(['b', 'a'], 'a', 0)).toEqual(['a', 'b'])
    expect(pinAfterDrop([], 'z', 3)).toEqual(['z'])
    expect(unpin(['b', 'a'], 'b')).toEqual(['a'])
  })

  it('writes the pins dense from one and deletes the ones that left', () => {
    const was = new Map([
      ['b', 1],
      ['a', 2],
    ])
    expect(rankWrites('Fire sprinkler', ['a'], was)).toEqual({ upserts: [{ prospect_id: 'a', trade: 'Fire sprinkler', rank_order: 1 }], deletes: ['b'] })
    expect(rankWrites('Fire sprinkler', ['z', 'b', 'a'], was).upserts.map((r) => `${r.prospect_id}:${r.rank_order}`)).toEqual(['z:1', 'b:2', 'a:3'])
    expect(rankWrites('Concrete', [], undefined)).toEqual({ upserts: [], deletes: [] })
  })
})
