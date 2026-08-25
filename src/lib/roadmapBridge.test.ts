import { describe, expect, it } from 'vitest'
import { blockingStageTitles, bridgeChipFor, goalsStageRows, goalsStripNowSummary, goalsStripRows, lockedStageHint, lockedStagePrerequisiteChain, stageBadgeFor } from './roadmapBridge'

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

describe('goalsStageRows', () => {
  // A (done) → B (partial, current) → C (locked); D is a task-less milestone
  // after A, so it auto-completes; sort_index deliberately disagrees with the
  // dependency order to prove rows come back in curated order.
  const groups = [
    { id: 'gB', title: 'Pour slab', sort_index: 2 },
    { id: 'gA', title: 'Clear & grade', sort_index: 1 },
    { id: 'gC', title: 'Frame walls', sort_index: 4 },
    { id: 'gD', title: 'Site ready', sort_index: 3 },
  ]
  const edges = [
    { fromGroupId: 'gA', toGroupId: 'gB' },
    { fromGroupId: 'gB', toGroupId: 'gC' },
    { fromGroupId: 'gA', toGroupId: 'gD' },
  ]
  const tasks = [
    { group_id: 'gA', completed_at: 'x', assigneeCount: 1 },
    { group_id: 'gB', completed_at: 'x', assigneeCount: 1 },
    { group_id: 'gB', completed_at: null, assigneeCount: 1 },
    { group_id: 'gB', completed_at: null, assigneeCount: 0 },
    { group_id: 'gC', completed_at: null, assigneeCount: 1 },
  ]

  it('orders by sort_index and derives complete/current/locked states', () => {
    const rows = goalsStageRows({ groups, tasks, edges })
    expect(rows.map((r) => r.groupId)).toEqual(['gA', 'gB', 'gD', 'gC'])
    expect(rows.map((r) => r.state)).toEqual(['complete', 'current', 'complete', 'locked'])
  })

  it('a task-less stage with no prerequisites is "unplanned" — never complete, never current', () => {
    const rows = goalsStageRows({
      groups: [...groups, { id: 'gE', title: 'Solar on every roof', sort_index: 5 }],
      tasks,
      edges,
    })
    const e = rows.find((r) => r.groupId === 'gE')!
    expect(e.state).toBe('unplanned')
    expect(e.blockedBy).toEqual([])
    // the strip's "current" list leaves it out too
    const strip = goalsStripRows({
      roadmaps: [{ id: 'r', title: 'Farm' }],
      groups: [...groups, { id: 'gE', title: 'Solar on every roof', sort_index: 5 }].map((g) => ({ ...g, roadmap_id: 'r' })),
      tasks: tasks.map((t, i) => ({ ...t, id: `t${i}` })),
      edges,
    })
    expect(strip[0]!.currentStages).not.toContain('Solar on every roof')
    expect(strip[0]!.stagesComplete).toBe(2)
  })

  it('counts done/total and open assigned tasks per stage', () => {
    const rows = goalsStageRows({ groups, tasks, edges })
    const b = rows.find((r) => r.groupId === 'gB')!
    expect(b.done).toBe(1)
    expect(b.total).toBe(3)
    expect(b.openAssigned).toBe(1)
  })

  it('locked stages carry their incomplete blockers; others carry none', () => {
    const rows = goalsStageRows({ groups, tasks, edges })
    expect(rows.find((r) => r.groupId === 'gC')!.blockedBy).toEqual(['Pour slab'])
    expect(rows.find((r) => r.groupId === 'gB')!.blockedBy).toEqual([])
  })

  it('task-less milestone completes once its predecessor is done', () => {
    const rows = goalsStageRows({ groups, tasks, edges })
    const d = rows.find((r) => r.groupId === 'gD')!
    expect(d.state).toBe('complete')
    expect(d.total).toBe(0)
  })

  it('ignores tasks and edges outside the given groups', () => {
    const rows = goalsStageRows({
      groups,
      tasks: [...tasks, { group_id: 'other', completed_at: null, assigneeCount: 5 }],
      edges: [...edges, { fromGroupId: 'other', toGroupId: 'gA' }],
    })
    expect(rows.find((r) => r.groupId === 'gA')!.state).toBe('complete')
  })
})

describe('lockedStagePrerequisiteChain', () => {
  const row = (groupId: string, state: 'complete' | 'current' | 'locked' | 'unplanned', done = 0, total = 0) => ({
    groupId,
    title: groupId.toUpperCase(),
    done,
    total,
    state,
    openAssigned: 0,
    blockedBy: [],
  })
  // Curated order g1..g5; chain into g4: g1(done) → g2(current) → g3(locked) → g4; g5(done) → g4
  const stageRows = [row('g1', 'complete', 3, 3), row('g2', 'current', 1, 4), row('g3', 'locked'), row('g4', 'locked'), row('g5', 'complete', 2, 2)]
  const edges = [
    { fromGroupId: 'g1', toGroupId: 'g2' },
    { fromGroupId: 'g2', toGroupId: 'g3' },
    { fromGroupId: 'g3', toGroupId: 'g4' },
    { fromGroupId: 'g5', toGroupId: 'g4' },
  ]

  it('walks the incomplete ancestor chain, skipping complete stages, in curated order', () => {
    const chain = lockedStagePrerequisiteChain({ groupId: 'g4', stageRows, edges })
    expect(chain.map((e) => e.row.groupId)).toEqual(['g2', 'g3'])
    expect(chain.map((e) => e.number)).toEqual([2, 3])
    expect(chain.map((e) => e.direct)).toEqual([false, true])
  })

  it('dedupes shared ancestors and survives cycles', () => {
    const withExtra = [...edges, { fromGroupId: 'g2', toGroupId: 'g4' }, { fromGroupId: 'g4', toGroupId: 'g2' }]
    const chain = lockedStagePrerequisiteChain({ groupId: 'g4', stageRows, edges: withExtra })
    expect(chain.map((e) => e.row.groupId)).toEqual(['g2', 'g3'])
    // g2 now feeds g4 directly too
    expect(chain.find((e) => e.row.groupId === 'g2')!.direct).toBe(true)
  })

  it('empty when every predecessor is complete', () => {
    expect(lockedStagePrerequisiteChain({ groupId: 'g2', stageRows, edges })).toEqual([
      expect.objectContaining({ direct: false }),
    ].slice(0, 0))
  })
})
