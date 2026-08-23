import { describe, expect, it } from 'vitest'
import { buildRoadmapNudges, ROADMAP_NUDGE_MIN_COUNT } from './dashboardRoadmapNudge'

const task = (id: string, group_id: string, sort_index: number, done: boolean, assigneeIds: string[] = []) => ({
  id,
  group_id,
  title: `task ${id}`,
  sort_index,
  completed_at: done ? '2026-08-20T00:00:00Z' : null,
  assigneeIds,
})

describe('buildRoadmapNudges', () => {
  const roadmaps = [
    { id: 'farm', title: 'Farm 1' },
    { id: 'shop', title: 'Shop' },
    { id: 'empty', title: 'Nothing yet' },
  ]
  const groups = [
    { id: 'g1', roadmap_id: 'farm', title: 'Tools', sort_index: 1 },
    { id: 'g2', roadmap_id: 'farm', title: 'Goal', sort_index: 2 },
    { id: 'g3', roadmap_id: 'farm', title: 'Locked', sort_index: 3 },
    { id: 's1', roadmap_id: 'shop', title: 'Slab', sort_index: 1 },
  ]
  const edges = [
    { fromGroupId: 'g1', toGroupId: 'g2' },
    { fromGroupId: 'g2', toGroupId: 'g3' },
  ]
  const tasks = [
    task('a', 'g1', 1, false),
    task('b', 'g1', 2, false),
    task('c', 'g1', 3, false, ['robert']),
    task('d', 'g1', 4, true),
    task('z', 'g3', 1, false), // locked stage — never counted
    task('s', 's1', 1, false), // shop: only 1 unstaffed → below threshold
  ]

  it('counts open unstaffed tasks in unlocked stages per roadmap, names the top pick, and drops roadmaps below the threshold', () => {
    const nudges = buildRoadmapNudges({ roadmaps, groups, tasks, edges, minCount: 2 })
    expect(nudges).toHaveLength(1)
    expect(nudges[0]).toMatchObject({ roadmapId: 'farm', title: 'Farm 1', needsName: 2, ready: 1 })
    expect(nudges[0]!.next).toEqual({ taskId: 'a', label: '1.1 task a' })
  })

  it('uses the default threshold and sorts by need', () => {
    expect(ROADMAP_NUDGE_MIN_COUNT).toBe(3)
    const more = [...tasks, task('e', 'g1', 5, false), task('t', 's1', 2, false), task('u', 's1', 3, false), task('v', 's1', 4, false)]
    const nudges = buildRoadmapNudges({ roadmaps, groups, tasks: more, edges })
    expect(nudges.map((n) => `${n.title}:${n.needsName}`)).toEqual(['Shop:4', 'Farm 1:3'])
  })

  it('returns nothing when no roadmap clears the bar', () => {
    expect(buildRoadmapNudges({ roadmaps, groups, tasks: [task('a', 'g1', 1, false)], edges })).toEqual([])
  })
})
