import { describe, expect, it } from 'vitest'
import {
  completeGroupIdsFromTasks,
  computeUnlockedGroupIds,
  isGroupComplete,
  wouldAddEdgeCreateCycle,
} from './checklistTechTreeGraph'

describe('isGroupComplete', () => {
  it('is false for empty', () => {
    expect(isGroupComplete([])).toBe(false)
  })

  it('is true when all tasks completed', () => {
    expect(isGroupComplete([{ completedAt: '2020-01-01' }, { completedAt: '2020-01-02' }])).toBe(true)
  })

  it('is false if any task incomplete', () => {
    expect(isGroupComplete([{ completedAt: '2020-01-01' }, { completedAt: null }])).toBe(false)
  })
})

describe('wouldAddEdgeCreateCycle', () => {
  it('returns false for first edge', () => {
    expect(wouldAddEdgeCreateCycle([], 'a', 'b')).toBe(false)
  })

  it('detects cycle if path exists to -> from', () => {
    const edges = [
      { fromGroupId: 'a', toGroupId: 'b' },
      { fromGroupId: 'b', toGroupId: 'c' },
    ]
    expect(wouldAddEdgeCreateCycle(edges, 'c', 'a')).toBe(true)
  })

  it('returns false for parallel edge', () => {
    const edges = [{ fromGroupId: 'a', toGroupId: 'b' }]
    expect(wouldAddEdgeCreateCycle(edges, 'a', 'c')).toBe(false)
  })
})

describe('computeUnlockedGroupIds', () => {
  const ids = new Set(['a', 'b', 'c'])
  it('unlocks root groups (no incoming)', () => {
    const edges = [{ fromGroupId: 'a', toGroupId: 'c' }]
    const u = computeUnlockedGroupIds(ids, edges, new Set())
    expect(u.has('a')).toBe(true)
    expect(u.has('b')).toBe(true)
    expect(u.has('c')).toBe(false)
  })

  it('unlocks when predecessor complete', () => {
    const edges = [{ fromGroupId: 'a', toGroupId: 'c' }]
    const u = computeUnlockedGroupIds(ids, edges, new Set(['a', 'b']))
    expect(u.has('c')).toBe(true)
  })
})

describe('completeGroupIdsFromTasks', () => {
  it('adds only fully complete groups', () => {
    const m = new Map<string, { completed_at: string | null }[]>([
      ['a', [{ completed_at: 'x' }]],
      ['b', [{ completed_at: null }]],
    ])
    const s = completeGroupIdsFromTasks(m)
    expect(s.has('a')).toBe(true)
    expect(s.has('b')).toBe(false)
  })
})
