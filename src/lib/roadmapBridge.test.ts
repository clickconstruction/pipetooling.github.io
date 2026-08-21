import { describe, expect, it } from 'vitest'
import { blockingStageTitles, bridgeChipFor, goalsStripNowSummary, goalsStripRows, lockedStageHint, stageBadgeFor } from './roadmapBridge'

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

describe('goalsStripNowSummary', () => {
  it('short lists pass through untruncated', () => {
    expect(goalsStripNowSummary([])).toBe('')
    expect(goalsStripNowSummary(['Pour slab'])).toBe('Pour slab')
    expect(goalsStripNowSummary(['A', 'B', 'C'])).toBe('A, B, C')
  })
  it('folds the tail into +N more past the limit', () => {
    expect(goalsStripNowSummary(['A', 'B', 'C', 'D'])).toBe('A, B, C … +1 more')
    expect(goalsStripNowSummary(['A', 'B', 'C', 'D', 'E', 'F'], 2)).toBe('A, B … +4 more')
  })
})

describe('stageBadgeFor', () => {
  it('empty stage -> no badge', () => {
    expect(stageBadgeFor([])).toBeNull()
  })
  it('partial -> progress with counts', () => {
    expect(stageBadgeFor([{ completedAt: 'x' }, { completedAt: null }, { completedAt: null }])).toEqual({
      kind: 'progress',
      done: 1,
      total: 3,
    })
  })
  it('all complete -> done', () => {
    expect(stageBadgeFor([{ completedAt: 'x' }, { completedAt: 'y' }])).toEqual({ kind: 'done' })
  })
})

describe('blockingStageTitles / lockedStageHint', () => {
  const edges = [
    { fromGroupId: 'g1', toGroupId: 'g3' },
    { fromGroupId: 'g2', toGroupId: 'g3' },
  ]
  const titleByGroupId = new Map([
    ['g1', 'Pour slab'],
    ['g2', 'Order trusses'],
  ])
  it('only incomplete predecessors block', () => {
    expect(
      blockingStageTitles({ groupId: 'g3', edges, completeGroupIds: new Set(['g1']), titleByGroupId }),
    ).toEqual(['Order trusses'])
  })
  it('unknown predecessor falls back to a generic label', () => {
    expect(
      blockingStageTitles({
        groupId: 'g3',
        edges: [{ fromGroupId: 'gX', toGroupId: 'g3' }],
        completeGroupIds: new Set(),
        titleByGroupId,
      }),
    ).toEqual(['a previous stage'])
  })
  it('hint wording: assigned tasks get the auto-assign phrasing', () => {
    expect(lockedStageHint(['Pour slab'], true)).toBe('Tasks auto-assign to lists when “Pour slab” is done')
    expect(lockedStageHint(['Pour slab'], false)).toBe('Unlocks when “Pour slab” is done')
  })
  it('hint joins two blockers and truncates three or more', () => {
    expect(lockedStageHint(['A', 'B'], false)).toBe('Unlocks when “A” and “B” are done')
    expect(lockedStageHint(['A', 'B', 'C'], false)).toBe('Unlocks when “A” + 2 more are done')
    expect(lockedStageHint([], false)).toBeNull()
  })
})
