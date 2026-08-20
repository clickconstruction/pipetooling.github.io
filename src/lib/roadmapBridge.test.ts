import { describe, expect, it } from 'vitest'
import { bridgeChipFor, goalsStripRows } from './roadmapBridge'

describe('bridgeChipFor', () => {
  it('no bridge -> no chip', () => {
    expect(bridgeChipFor(null, undefined)).toBeNull()
  })
  it('bridged open -> on_list', () => {
    expect(bridgeChipFor(null, { instanceCompletedAt: null, reviewedAt: null })).toBe('on_list')
  })
  it('instance done, unreviewed -> in_review; reviewed -> signed_off', () => {
    expect(bridgeChipFor('x', { instanceCompletedAt: 'y', reviewedAt: null })).toBe('in_review')
    expect(bridgeChipFor('x', { instanceCompletedAt: 'y', reviewedAt: 'z' })).toBe('signed_off')
  })
})

describe('goalsStripRows', () => {
  const roadmaps = [{ id: 'r1', title: 'Shop rebuild' }]
  const groups = [
    { id: 'g1', roadmap_id: 'r1', title: 'Clear & grade' },
    { id: 'g2', roadmap_id: 'r1', title: 'Pour slab' },
    { id: 'g3', roadmap_id: 'r1', title: 'Frame walls' },
  ]
  const edges = [
    { fromGroupId: 'g1', toGroupId: 'g2' },
    { fromGroupId: 'g2', toGroupId: 'g3' },
  ]
  const tasks = [
    { id: 't1', group_id: 'g1', completed_at: 'x', assigneeCount: 1 },
    { id: 't2', group_id: 'g2', completed_at: 'x', assigneeCount: 1 },
    { id: 't3', group_id: 'g2', completed_at: null, assigneeCount: 1 },
    { id: 't4', group_id: 'g3', completed_at: null, assigneeCount: 2 },
  ]

  it('computes stages, task-weighted pct, current front, open assigned', () => {
    const row = goalsStripRows({ roadmaps, groups, tasks, edges })[0]!
    expect(row).toMatchObject({
      stagesTotal: 3,
      stagesComplete: 1,
      pct: 50,
      currentStages: ['Pour slab'],
      openAssigned: 1,
    })
  })

  it('skips empty roadmaps; locked stages never count as current', () => {
    expect(goalsStripRows({ roadmaps: [{ id: 'rX', title: 'Empty' }], groups: [], tasks: [], edges: [] })).toEqual([])
    const row = goalsStripRows({ roadmaps, groups, tasks, edges })[0]!
    expect(row.currentStages).not.toContain('Frame walls')
  })
})
