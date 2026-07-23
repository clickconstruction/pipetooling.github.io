import { describe, expect, it } from 'vitest'
import { applyOtherMoveLocally, otherIdSet, partitionByOther } from './dispatchPoOther'
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

describe('applyOtherMoveLocally', () => {
  it('to-other adds a synthetic row without duplicating an existing flag', () => {
    const once = applyOtherMoveLocally(rows, 'for_person', 'p9', 'to-other')
    expect(otherIdSet(once, 'for_person').has('p9')).toBe(true)
    const twice = applyOtherMoveLocally(once, 'for_person', 'p9', 'to-other')
    expect(twice.filter((r) => r.item_id === 'p9')).toHaveLength(1)
  })

  it('to-main removes the pair and only that pair', () => {
    const result = applyOtherMoveLocally(rows, 'for_person', 'p1', 'to-main')
    expect(otherIdSet(result, 'for_person').has('p1')).toBe(false)
    expect(otherIdSet(result, 'for_person').has('p2')).toBe(true)
    expect(otherIdSet(result, 'supply_house').has('s1')).toBe(true)
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
