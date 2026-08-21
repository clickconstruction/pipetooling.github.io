import { describe, expect, it } from 'vitest'
import { computeStageOrderUpdates, stageNumbersByGroupId } from './roadmapStageNumbers'

describe('stageNumbersByGroupId', () => {
  it('numbers stages 1..N in list order', () => {
    const m = stageNumbersByGroupId([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect(m.get('a')).toBe(1)
    expect(m.get('b')).toBe(2)
    expect(m.get('c')).toBe(3)
    expect(m.size).toBe(3)
  })
  it('empty list -> empty map', () => {
    expect(stageNumbersByGroupId([]).size).toBe(0)
  })
})

describe('computeStageOrderUpdates', () => {
  const current = [
    { id: 'a', sort_index: 1 },
    { id: 'b', sort_index: 2 },
    { id: 'c', sort_index: 3 },
  ]
  it('unchanged order -> no updates', () => {
    expect(computeStageOrderUpdates(['a', 'b', 'c'], current)).toEqual([])
  })
  it('moving a stage updates only the rows whose position changed', () => {
    expect(computeStageOrderUpdates(['b', 'a', 'c'], current)).toEqual([
      { id: 'b', sort_index: 1 },
      { id: 'a', sort_index: 2 },
    ])
  })
  it('normalizes sparse stored indexes to dense 1..N', () => {
    const sparse = [
      { id: 'a', sort_index: 3 },
      { id: 'b', sort_index: 7 },
    ]
    expect(computeStageOrderUpdates(['a', 'b'], sparse)).toEqual([
      { id: 'a', sort_index: 1 },
      { id: 'b', sort_index: 2 },
    ])
  })
  it('skips ids missing from current (deleted mid-drag)', () => {
    expect(computeStageOrderUpdates(['ghost', 'a'], current)).toEqual([{ id: 'a', sort_index: 2 }])
  })
})
