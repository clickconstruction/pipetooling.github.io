/**
 * Dashboard "roadmap tasks need a person" nudge (v2.2138, Next-up phase 2): per
 * roadmap, how many open tasks in unlocked stages have nobody on them — the
 * same count as the Plan view's "Needs a person" lane — plus the top pick so the
 * card can say what to do first. Threshold-gated like the lost-bids nudge so
 * a two-task roadmap doesn't nag forever.
 */

import { computeCompleteGroupIdsWithMilestones, computeUnlockedGroupIds, type TechTreeEdge } from './checklistTechTreeGraph'
import { nextUpPicks } from './roadmapNextUp'
import { stageNumbersByGroupId, taskNumbersByTaskId } from './roadmapStageNumbers'

export const ROADMAP_NUDGE_MIN_COUNT = 3

export type RoadmapNudge = {
  roadmapId: string
  title: string
  /** Open, unstaffed tasks in unlocked stages. */
  needsName: number
  /** Open, staffed tasks in unlocked stages. */
  ready: number
  /** First "needs a person" pick — "13.1 buy multiple stainless steel prep tables". */
  next: { taskId: string; label: string } | null
}

export function buildRoadmapNudges(args: {
  roadmaps: Array<{ id: string; title: string }>
  groups: Array<{ id: string; roadmap_id: string; title: string; sort_index: number }>
  tasks: Array<{ id: string; group_id: string; title: string; sort_index: number; completed_at: string | null; assigneeIds: string[] }>
  edges: TechTreeEdge[]
  minCount?: number
}): RoadmapNudge[] {
  const { roadmaps, groups, tasks, edges, minCount = ROADMAP_NUDGE_MIN_COUNT } = args
  const out: RoadmapNudge[] = []
  for (const rm of roadmaps) {
    const rmGroups = groups
      .filter((g) => g.roadmap_id === rm.id)
      .sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id))
    if (rmGroups.length === 0) continue
    const groupIds = new Set(rmGroups.map((g) => g.id))
    const rmEdges = edges.filter((e) => groupIds.has(e.fromGroupId) && groupIds.has(e.toGroupId))
    const tasksByGroup = new Map<string, typeof tasks>()
    for (const t of tasks) {
      if (!groupIds.has(t.group_id)) continue
      tasksByGroup.set(t.group_id, [...(tasksByGroup.get(t.group_id) ?? []), t])
    }
    for (const [gid, list] of tasksByGroup) {
      tasksByGroup.set(gid, [...list].sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id)))
    }
    const completeIds = computeCompleteGroupIdsWithMilestones(groupIds, rmEdges, tasksByGroup)
    const unlockedIds = computeUnlockedGroupIds(groupIds, rmEdges, completeIds)
    const lanes = nextUpPicks({ groups: rmGroups, tasksByGroup, edges: rmEdges, unlockedIds, completeIds })
    if (lanes.openNeedsName < minCount) continue
    const stageNumbers = stageNumbersByGroupId(rmGroups)
    const taskNumbers = taskNumbersByTaskId(stageNumbers, tasksByGroup)
    const top = lanes.needsName[0]
    const topTask = top ? tasks.find((t) => t.id === top.taskId) : null
    out.push({
      roadmapId: rm.id,
      title: rm.title,
      needsName: lanes.openNeedsName,
      ready: lanes.openReady,
      next: top && topTask ? { taskId: top.taskId, label: `${taskNumbers.get(top.taskId) ?? ''} ${topTask.title}`.trim() } : null,
    })
  }
  out.sort((a, b) => b.needsName - a.needsName || a.title.localeCompare(b.title))
  return out
}
