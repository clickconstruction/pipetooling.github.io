import { describe, expect, it } from 'vitest'
import {
  completeGroupIdsFromTasks,
  getAddPrereqLinkBlockReason,
  computeCompleteGroupIdsWithMilestones,
  computeUnlockedGroupIds,
  isGroupComplete,
  unplannedGroupIds,
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
  it('empty root is NOT complete (not planned yet); stages with tasks still need every task done', () => {
    const s = computeCompleteGroupIdsWithMilestones(
      ['lonely', 'working'],
      [],
      new Map([['working', [{ completed_at: 'x' }, { completed_at: null }]]]),
    )
    expect(s.has('lonely')).toBe(false)
    expect(s.has('working')).toBe(false)
  })
  it('an unplanned root keeps its dependents locked until it is planned', () => {
    const e = [{ fromGroupId: 'lonely', toGroupId: 'after' }]
    const tasks = new Map<string, { completed_at: string | null }[]>([['after', [{ completed_at: null }]]])
    const s = computeCompleteGroupIdsWithMilestones(['lonely', 'after'], e, tasks)
    expect(s.has('lonely')).toBe(false)
    expect(computeUnlockedGroupIds(['lonely', 'after'], e, s).has('after')).toBe(false)
    // once the root gets a predecessor that is complete, it becomes a reached milestone again
    const e2 = [...e, { fromGroupId: 'done', toGroupId: 'lonely' }]
    const tasks2 = new Map<string, { completed_at: string | null }[]>([...tasks, ['done', [{ completed_at: 'x' }]]])
    const s2 = computeCompleteGroupIdsWithMilestones(['done', 'lonely', 'after'], e2, tasks2)
    expect(s2.has('lonely')).toBe(true)
  })
})

describe('unplannedGroupIds', () => {
  it('is the task-less stages with no prerequisites — not milestones, not task stages', () => {
    const edges = [{ fromGroupId: 'a', toGroupId: 'm' }]
    const tasks = new Map([['a', [{ completed_at: null }]]])
    const u = unplannedGroupIds(['a', 'm', 'lonely'], edges, tasks)
    expect([...u]).toEqual(['lonely'])
  })
  it('ignores edges from groups outside the set', () => {
    const u = unplannedGroupIds(['x'], [{ fromGroupId: 'other', toGroupId: 'x' }], new Map())
    expect(u.has('x')).toBe(true)
  })
})

describe('getAddPrereqLinkBlockReason', () => {
  const edges = [{ from_group_id: 'a', to_group_id: 'b' }]
  it('read-only viewers are blocked first', () => {
    expect(getAddPrereqLinkBlockReason(false, 'a', 'c', edges)).toBe("You can't edit roadmap links (read-only).")
  })
  it('an unfinished pick is not an error yet', () => {
    expect(getAddPrereqLinkBlockReason(true, '', 'c', edges)).toBeNull()
  })
  it('self-links, duplicates, and cycles each get their own message', () => {
    expect(getAddPrereqLinkBlockReason(true, 'a', 'a', edges)).toBe("A group can't be a prerequisite of itself.")
    expect(getAddPrereqLinkBlockReason(true, 'a', 'b', edges)).toBe('This link already exists.')
    expect(getAddPrereqLinkBlockReason(true, 'b', 'a', edges)).toBe('That link would create a cycle.')
  })
  it('a fresh, acyclic link is allowed', () => {
    expect(getAddPrereqLinkBlockReason(true, 'b', 'c', edges)).toBeNull()
  })
})

describe('sequentialWaiting', () => {
  const t = (id: string, done = false) => ({ id, title: id, completed_at: done ? '2026-08-25T00:00:00Z' : null })

  it('everything after the first open task waits behind it', async () => {
    const { sequentialWaiting } = await import('./checklistTechTreeGraph')
    const out = sequentialWaiting({
      tasksByGroup: new Map([['g1', [t('a', true), t('b'), t('c'), t('d')]]]),
      sequentialByGroupId: new Map([['g1', true]]),
    })
    expect([...out.waitingIds].sort()).toEqual(['c', 'd'])
    expect(out.blockerByTaskId.get('c')?.id).toBe('b')
    expect(out.blockerByTaskId.get('d')?.id).toBe('b')
  })

  it('completed tasks never wait and a fully open group waits behind its first task', async () => {
    const { sequentialWaiting } = await import('./checklistTechTreeGraph')
    const out = sequentialWaiting({
      tasksByGroup: new Map([['g1', [t('a'), t('b')]]]),
      sequentialByGroupId: new Map([['g1', true]]),
    })
    expect([...out.waitingIds]).toEqual(['b'])
  })

  it('any-order groups (sequential=false) never wait; missing entries default sequential', async () => {
    const { sequentialWaiting } = await import('./checklistTechTreeGraph')
    const out = sequentialWaiting({
      tasksByGroup: new Map([
        ['par', [t('a'), t('b')]],
        ['seq', [t('x'), t('y')]],
      ]),
      sequentialByGroupId: new Map([['par', false]]),
    })
    expect(out.waitingIds.has('a')).toBe(false)
    expect(out.waitingIds.has('b')).toBe(false)
    expect(out.waitingIds.has('y')).toBe(true)
  })
})
