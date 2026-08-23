import { describe, expect, it } from 'vitest'
import { nextUpPicks, nextUpReasonLabel, type NextUpTask } from './roadmapNextUp'
import { computeCompleteGroupIdsWithMilestones, computeUnlockedGroupIds } from './checklistTechTreeGraph'

const NOW = new Date('2026-08-22T12:00:00Z')
const t = (id: string, group: string, done: boolean, assignees: string[] = [], doneAt = '2026-08-20T00:00:00Z'): NextUpTask => ({
  id,
  group_id: group,
  completed_at: done ? doneAt : null,
  assigneeIds: assignees,
})

// Stage order (numbers): 1 tools (10 tasks, 3 staffed), 2 trail (1/3 done),
// 3 well (6 tasks), 4 goal (milestone), 5 final (locked behind goal), 6 lonely (unplanned root)
const groups = [
  { id: 'tools', title: 'tools accessible' },
  { id: 'trail', title: 'Cut trail' },
  { id: 'well', title: 'Drill a well' },
  { id: 'goal', title: 'Full Use of Land' },
  { id: 'final', title: 'Build products' },
]
const edges = [
  { fromGroupId: 'tools', toGroupId: 'goal' },
  { fromGroupId: 'trail', toGroupId: 'goal' },
  { fromGroupId: 'goal', toGroupId: 'final' },
]
const tasksByGroup = new Map<string, NextUpTask[]>([
  ['tools', Array.from({ length: 10 }, (_, i) => t(`tools${i + 1}`, 'tools', false, i < 3 ? ['robert'] : []))],
  ['trail', [t('trail1', 'trail', true), t('trail2', 'trail', false), t('trail3', 'trail', false)]],
  ['well', Array.from({ length: 6 }, (_, i) => t(`well${i + 1}`, 'well', false))],
  ['final', [t('final1', 'final', false, ['sam'])]],
])
const completeIds = computeCompleteGroupIdsWithMilestones(groups.map((g) => g.id), edges, tasksByGroup)
const unlockedIds = computeUnlockedGroupIds(groups.map((g) => g.id), edges, completeIds)

describe('nextUpPicks', () => {
  const lanes = nextUpPicks({ groups, tasksByGroup, edges, unlockedIds, completeIds, now: NOW })

  it('splits staffed vs unstaffed lanes and counts the eligible open tasks behind each', () => {
    expect(lanes.ready.map((p) => p.taskId)).toEqual(['tools1', 'tools2'])
    expect(lanes.openReady).toBe(3)
    expect(lanes.openNeedsName).toBe(2 + 7 + 6)
  })

  it('ranks "closes a stage" first, then unlocks-the-most, then stage order; caps two picks per stage', () => {
    // trail has 2 left → first; tools (7 unstaffed, feeds goal → final) beats well (feeds nothing); cap 2 per stage
    expect(lanes.needsName.map((p) => p.taskId)).toEqual(['trail2', 'trail3', 'tools4', 'tools5', 'well1'])
  })

  it('never lists locked-stage tasks, done tasks, or milestones', () => {
    const all = [...lanes.ready, ...lanes.needsName].map((p) => p.taskId)
    expect(all).not.toContain('final1')
    expect(all).not.toContain('trail1')
    expect(all.some((id) => id.startsWith('goal'))).toBe(false)
  })

  it('attaches explainable reasons in display order', () => {
    const trail2 = lanes.needsName.find((p) => p.taskId === 'trail2')!
    expect(trail2.reasons.map((r) => r.kind)).toEqual(['closes_stage', 'unlocks', 'priority', 'in_motion'])
    expect(trail2.reasons[0]).toMatchObject({ kind: 'closes_stage', stageNumber: 2, left: 2 })
    // tools feeds the goal, and 1 open task waits behind it (final1) across 2 downstream stages
    const tools1 = lanes.ready.find((p) => p.taskId === 'tools1')!
    expect(tools1.reasons).toContainEqual({ kind: 'unlocks', feeds: 'Full Use of Land', stages: 2, tasks: 1 })
    expect(tools1.reasons).toContainEqual({ kind: 'first_step', stageTitle: 'tools accessible' })
    // well has no completions yet → first open task is its "first step"; nothing downstream
    const well1 = lanes.needsName.find((p) => p.taskId === 'well1')!
    expect(well1.reasons).toEqual([
      { kind: 'priority', stageNumber: 3 },
      { kind: 'first_step', stageTitle: 'Drill a well' },
    ])
  })

  it('respects limit and perStageCap', () => {
    const small = nextUpPicks({ groups, tasksByGroup, edges, unlockedIds, completeIds, now: NOW, limit: 2, perStageCap: 1 })
    expect(small.needsName.map((p) => p.taskId)).toEqual(['trail2', 'tools4'])
  })

  it('stage numbers are the roadmap order (position + 1), not dependency depth', () => {
    expect(lanes.needsName.find((p) => p.taskId === 'well1')!.stageNumber).toBe(3)
  })

  it('★ pinned tasks lead their lane (oldest pin first) and are exempt from the per-stage cap', () => {
    const pinned = new Map(tasksByGroup)
    pinned.set('well', [
      ...tasksByGroup.get('well')!.slice(0, 4),
      { ...tasksByGroup.get('well')![4]!, pinned_at: '2026-08-21T10:00:00Z' },
      { ...tasksByGroup.get('well')![5]!, pinned_at: '2026-08-20T10:00:00Z' },
    ])
    // a third well task pinned too would exceed the cap of 2 — pins never lose their slot
    pinned.set('well', [...pinned.get('well')!.slice(0, 3), { ...tasksByGroup.get('well')![3]!, pinned_at: '2026-08-22T10:00:00Z' }, ...pinned.get('well')!.slice(4)])
    const lanes = nextUpPicks({ groups, tasksByGroup: pinned, edges, unlockedIds, completeIds, now: NOW })
    expect(lanes.needsName.map((p) => p.taskId)).toEqual(['well6', 'well5', 'well4', 'trail2', 'trail3'])
    expect(lanes.needsName[0]!.reasons[0]).toEqual({ kind: 'pinned' })
    expect(nextUpReasonLabel({ kind: 'pinned' })).toBe('★ pinned')
  })

  it('returns empty lanes when nothing is open', () => {
    const empty = nextUpPicks({ groups: [], tasksByGroup: new Map(), edges: [], unlockedIds: new Set(), completeIds: new Set(), now: NOW })
    expect(empty).toEqual({ ready: [], needsName: [], openReady: 0, openNeedsName: 0 })
  })
})

describe('nextUpReasonLabel', () => {
  it('reads as a chip', () => {
    expect(nextUpReasonLabel({ kind: 'closes_stage', stageNumber: 6, left: 2 })).toBe('closes stage 6 · 2 left')
    expect(nextUpReasonLabel({ kind: 'closes_stage', stageNumber: 6, left: 1 })).toBe('last task in stage 6')
    expect(nextUpReasonLabel({ kind: 'unlocks', feeds: 'Foundry', stages: 4, tasks: 32 })).toBe('feeds Foundry · 4 stages wait')
    expect(nextUpReasonLabel({ kind: 'unlocks', feeds: 'Foundry', stages: 1, tasks: 3 })).toBe('feeds Foundry · 1 stage wait')
    expect(nextUpReasonLabel({ kind: 'priority', stageNumber: 2 })).toBe('your #2')
    expect(nextUpReasonLabel({ kind: 'first_step', stageTitle: 'Drill a well' })).toBe('first step of “Drill a well”')
    expect(nextUpReasonLabel({ kind: 'in_motion' })).toBe('in motion')
  })
})
