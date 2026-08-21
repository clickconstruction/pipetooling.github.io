import { describe, expect, it } from 'vitest'
import { goalMilestones, planHeaderStats, planNowStages, planUpNextStages, type PlanTask } from './roadmapPlanView'
import { computeCompleteGroupIdsWithMilestones, computeUnlockedGroupIds } from './checklistTechTreeGraph'

const t = (id: string, group: string, done: boolean, assignees: string[] = []): PlanTask => ({
  id,
  group_id: group,
  title: id,
  completed_at: done ? '2026-08-20T00:00:00Z' : null,
  assigneeIds: assignees,
})

// doing1(1/2 done) -> goal(empty) ; doing2(0/1) -> goal ; goal -> final(2 tasks)
const groups = [
  { id: 'doing1', title: 'Cut trail' },
  { id: 'doing2', title: 'Pull trees' },
  { id: 'goal', title: 'Full Use of Land' },
  { id: 'final', title: 'Build products' },
]
const edges = [
  { fromGroupId: 'doing1', toGroupId: 'goal' },
  { fromGroupId: 'doing2', toGroupId: 'goal' },
  { fromGroupId: 'goal', toGroupId: 'final' },
]
const tasks = [
  t('a', 'doing1', true, ['u1']),
  t('b', 'doing1', false),
  t('c', 'doing2', false, ['u2']),
  t('d', 'final', false),
  t('e', 'final', false),
]
const tasksByGroup = new Map<string, PlanTask[]>()
for (const task of tasks) {
  tasksByGroup.set(task.group_id, [...(tasksByGroup.get(task.group_id) ?? []), task])
}
const completeIds = computeCompleteGroupIdsWithMilestones(groups.map((g) => g.id), edges, tasksByGroup)
const unlockedIds = computeUnlockedGroupIds(groups.map((g) => g.id), edges, completeIds)

describe('planHeaderStats', () => {
  it('counts done, assigned-open, and unstaffed-open', () => {
    expect(planHeaderStats(tasks)).toEqual({ total: 5, done: 1, assigned: 1, unstaffed: 3 })
  })
})

describe('planNowStages', () => {
  it('lists unlocked task-bearing stages in stage order, with feeds', () => {
    const rows = planNowStages({ groups, tasksByGroup, unlockedIds, completeIds, edges })
    expect(rows.map((r) => r.title)).toEqual(['Cut trail', 'Pull trees'])
    expect(rows[0]).toMatchObject({ done: 1, total: 2, feeds: ['Full Use of Land'] })
  })
  it('keeps stage order even when a later stage has more momentum (v2.1946)', () => {
    // Pull trees (0/1 done) ordered above Cut trail (1/2 done): stage order
    // wins — the old momentum sort would have flipped them.
    const reordered = [groups[1]!, groups[0]!, groups[2]!, groups[3]!]
    const rows = planNowStages({ groups: reordered, tasksByGroup, unlockedIds, completeIds, edges })
    expect(rows.map((r) => r.title)).toEqual(['Pull trees', 'Cut trail'])
  })
  it('excludes locked and empty stages', () => {
    const rows = planNowStages({ groups, tasksByGroup, unlockedIds, completeIds, edges })
    expect(rows.some((r) => r.groupId === 'final')).toBe(false)
    expect(rows.some((r) => r.groupId === 'goal')).toBe(false)
  })
})

describe('planUpNextStages', () => {
  it('locked task-bearing stages name their incomplete blockers', () => {
    const rows = planUpNextStages({ groups, tasksByGroup, unlockedIds, completeIds, edges })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ groupId: 'final', total: 2 })
    expect(rows[0]!.blockingTitles).toEqual(['Full Use of Land'])
  })
})

describe('goalMilestones', () => {
  it('empty stages measured by transitive feeder tasks and stages', () => {
    const rows = goalMilestones({ groups, tasksByGroup, completeIds, edges })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      groupId: 'goal',
      feederDone: 1,
      feederTotal: 3,
      feederStages: 2,
      complete: false,
    })
  })
  it('milestone flips complete when its feeders finish (via milestone completion)', () => {
    const doneTasks = new Map<string, PlanTask[]>([
      ['doing1', [t('a', 'doing1', true)]],
      ['doing2', [t('c', 'doing2', true)]],
      ['final', [t('d', 'final', false)]],
    ])
    const c = computeCompleteGroupIdsWithMilestones(groups.map((g) => g.id), edges, doneTasks)
    const rows = goalMilestones({ groups, tasksByGroup: doneTasks, completeIds: c, edges })
    expect(rows[0]!.complete).toBe(true)
  })
})
