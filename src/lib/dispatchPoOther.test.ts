import { describe, expect, it } from 'vitest'
import { otherIdSet, partitionByOther } from './dispatchPoOther'
import type { DispatchPoOtherRow } from './dispatchPoOther'

const rows: DispatchPoOtherRow[] = [
  { id: '1', kind: 'for_person', item_id: 'p1' },
  { id: '2', kind: 'for_person', item_id: 'p2' },
  { id: '3', kind: 'supply_house', item_id: 's1' },
  { id: '4', kind: 'unknown_kind', item_id: 'x1' },
]

describe('otherIdSet', () => {
  it('filters by kind and ignores unknown kinds', () => {
    expect([...otherIdSet(rows, 'for_person')].sort()).toEqual(['p1', 'p2'])
    expect([...otherIdSet(rows, 'supply_house')]).toEqual(['s1'])
  })
})

describe('partitionByOther', () => {
  const items = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]

  it('splits flagged items into other, preserving order', () => {
    const { main, other } = partitionByOther(items, new Set(['p2']))
    expect(main.map((i) => i.id)).toEqual(['p1', 'p3'])
    expect(other.map((i) => i.id)).toEqual(['p2'])
  })

  it('keeps alwaysMain items (today\'s crew) in the main list even when flagged', () => {
    const { main, other } = partitionByOther(items, new Set(['p1', 'p2']), new Set(['p1']))
    expect(main.map((i) => i.id)).toEqual(['p1', 'p3'])
    expect(other.map((i) => i.id)).toEqual(['p2'])
  })

  it('handles empty flags', () => {
    const { main, other } = partitionByOther(items, new Set())
    expect(main).toHaveLength(3)
    expect(other).toHaveLength(0)
  })
})
