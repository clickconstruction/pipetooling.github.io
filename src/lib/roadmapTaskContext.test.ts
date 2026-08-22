import { describe, expect, it } from 'vitest'
import { buildRoadmapTaskContext, type RoadmapContextTask } from './roadmapTaskContext'

// Three stages in a chain: 1 (done) → 2 (current, has the focus task) → 3 (locked).
const groups = [
  { id: 'g1', title: 'Fence line', sort_index: 1 },
  { id: 'g2', title: 'Pig paddock ready', sort_index: 2 },
  { id: 'g3', title: 'Rotate pigs', sort_index: 3 },
]
const edges = [
  { fromGroupId: 'g1', toGroupId: 'g2' },
  { fromGroupId: 'g2', toGroupId: 'g3' },
]
const task = (id: string, group_id: string, sort_index: number, done: boolean): RoadmapContextTask => ({
  id,
  group_id,
  title: `task ${id}`,
  sort_index,
  completed_at: done ? '2026-08-01T00:00:00Z' : null,
  assigneeCount: 1,
})
const tasks = [
  task('a', 'g1', 1, true),
  task('b', 'g2', 1, true),
  task('c', 'g2', 2, false),
  task('d', 'g2', 3, false),
  task('e', 'g3', 1, false),
]

describe('buildRoadmapTaskContext', () => {
  it('numbers the focus task by stage position and marks it in the stage list', () => {
    const v = buildRoadmapTaskContext({ groups, edges, tasks, focusTaskId: 'c' })!
    expect(v.focusStageNumber).toBe(2)
    expect(v.focusTaskNumber).toBe('2.2')
    expect(v.focusStage.title).toBe('Pig paddock ready')
    expect(v.focusStage.state).toBe('current')
    expect(v.stageTasks.map((t) => [t.id, t.done, t.isFocus])).toEqual([
      ['b', true, false],
      ['c', false, true],
      ['d', false, false],
    ])
  })

  it('reports whole-road progress and downstream unlocks', () => {
    const v = buildRoadmapTaskContext({ groups, edges, tasks, focusTaskId: 'c' })!
    expect(v.stages.map((s) => s.state)).toEqual(['complete', 'current', 'locked'])
    expect(v.stagesDone).toBe(1)
    expect(v.unlocksNext).toEqual(['3 · Rotate pigs'])
  })

  it('locked focus stage carries its blockers', () => {
    const v = buildRoadmapTaskContext({ groups, edges, tasks, focusTaskId: 'e' })!
    expect(v.focusStage.state).toBe('locked')
    expect(v.focusStage.blockedBy).toContain('Pig paddock ready')
    expect(v.unlocksNext).toEqual([])
  })

  it('returns null for an unknown focus task', () => {
    expect(buildRoadmapTaskContext({ groups, edges, tasks, focusTaskId: 'nope' })).toBeNull()
  })
})
