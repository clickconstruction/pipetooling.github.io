import { describe, expect, it } from 'vitest'
import {
  completeGroupIdsFromTasks,
  computeCompleteGroupIdsWithMilestones,
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

describe('computeCompleteGroupIdsWithMilestones', () => {
  const edges = [
    { fromGroupId: 'doing1', toGroupId: 'goal' },
    { fromGroupId: 'doing2', toGroupId: 'goal' },
    { fromGroupId: 'goal', toGroupId: 'final' },
  ]
  const ids = ['doing1', 'doing2', 'goal', 'final']
  it('empty stage completes when all predecessors complete (the lock-trap fix)', () => {
    const tasks = new Map([
      ['doing1', [{ completed_at: 'x' }]],
      ['doing2', [{ completed_at: 'x' }]],
      ['final', [{ completed_at: null }]],
    ])
    const s = computeCompleteGroupIdsWithMilestones(ids, edges, tasks)
    expect(s.has('goal')).toBe(true)
    expect(s.has('final')).toBe(false)
    expect(computeUnlockedGroupIds(ids, edges, s).has('final')).toBe(true)
  })
  it('empty stage stays incomplete while a predecessor is open', () => {
    const tasks = new Map([
      ['doing1', [{ completed_at: 'x' }]],
      ['doing2', [{ completed_at: null }]],
    ])
    const s = computeCompleteGroupIdsWithMilestones(ids, edges, tasks)
    expect(s.has('goal')).toBe(false)
  })
  it('chains of empty stages cascade in one pass', () => {
    const chainEdges = [
      { fromGroupId: 'a', toGroupId: 'm1' },
      { fromGroupId: 'm1', toGroupId: 'm2' },
    ]
    const tasks = new Map([['a', [{ completed_at: 'x' }]]])
    const s = computeCompleteGroupIdsWithMilestones(['a', 'm1', 'm2'], chainEdges, tasks)
    expect(s.has('m1')).toBe(true)
    expect(s.has('m2')).toBe(true)
  })
  it('empty root is vacuously complete; stages with tasks still need every task done', () => {
    const s = computeCompleteGroupIdsWithMilestones(
      ['lonely', 'working'],
      [],
      new Map([['working', [{ completed_at: 'x' }, { completed_at: null }]]]),
    )
    expect(s.has('lonely')).toBe(true)
    expect(s.has('working')).toBe(false)
  })
})
