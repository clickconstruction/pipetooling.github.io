/**
 * Roadmap Plan view kernels (v2.1913): the flat "work front" lens over the
 * tech tree — header stats, the Now list (unlocked stages sorted by momentum),
 * Up next (locked stages with their blockers), and Goals (task-less milestone
 * stages measured by their transitive feeder tasks).
 */

import { blockingStageTitles } from './roadmapBridge'
import type { TechTreeEdge } from './checklistTechTreeGraph'

export type PlanTask = {
  id: string
  group_id: string
  title: string
  completed_at: string | null
  assigneeIds: string[]
}

export type PlanGroup = { id: string; title: string }

export type PlanHeaderStats = {
  total: number
  done: number
  /** Open tasks with at least one assignee. */
  assigned: number
  /** Open tasks with no assignee. */
  unstaffed: number
}

export function planHeaderStats(tasks: ReadonlyArray<PlanTask>): PlanHeaderStats {
  const done = tasks.filter((t) => t.completed_at != null).length
  const open = tasks.filter((t) => t.completed_at == null)
  const assigned = open.filter((t) => t.assigneeIds.length > 0).length
  return { total: tasks.length, done, assigned, unstaffed: open.length - assigned }
}

export type PlanNowStage = {
  groupId: string
  title: string
  done: number
  total: number
  /** Successor stage titles ("feeds …"). */
  feeds: string[]
}

/**
 * Unlocked, incomplete stages that have tasks — the work front. Sorted by
 * momentum: stages with progress first (higher done-fraction wins), then by
 * title for stability.
 */
export function planNowStages(args: {
  groups: ReadonlyArray<PlanGroup>
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<PlanTask>>
  unlockedIds: ReadonlySet<string>
  completeIds: ReadonlySet<string>
  edges: ReadonlyArray<TechTreeEdge>
}): PlanNowStage[] {
  const { groups, tasksByGroup, unlockedIds, completeIds, edges } = args
  const titleById = new Map(groups.map((g) => [g.id, g.title]))
  const rows: PlanNowStage[] = []
  for (const g of groups) {
    if (!unlockedIds.has(g.id) || completeIds.has(g.id)) continue
    const tasks = tasksByGroup.get(g.id) ?? []
    if (tasks.length === 0) continue
    const done = tasks.filter((t) => t.completed_at != null).length
    const feeds = edges
      .filter((e) => e.fromGroupId === g.id)
      .map((e) => titleById.get(e.toGroupId))
      .filter((t): t is string => !!t)
    rows.push({ groupId: g.id, title: g.title, done, total: tasks.length, feeds })
  }
  rows.sort((a, b) => {
    const fa = a.done / a.total
    const fb = b.done / b.total
    if (fb !== fa) return fb - fa
    return a.title.localeCompare(b.title)
  })
  return rows
}

export type PlanUpNextStage = {
  groupId: string
  title: string
  total: number
  blockingTitles: string[]
}

/** Locked stages that have tasks, with the incomplete predecessors gating them. */
export function planUpNextStages(args: {
  groups: ReadonlyArray<PlanGroup>
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<PlanTask>>
  unlockedIds: ReadonlySet<string>
  completeIds: ReadonlySet<string>
  edges: ReadonlyArray<TechTreeEdge>
}): PlanUpNextStage[] {
  const { groups, tasksByGroup, unlockedIds, completeIds, edges } = args
  const titleByGroupId = new Map(groups.map((g) => [g.id, g.title]))
  const rows: PlanUpNextStage[] = []
  for (const g of groups) {
    if (unlockedIds.has(g.id)) continue
    const tasks = tasksByGroup.get(g.id) ?? []
    if (tasks.length === 0) continue
    rows.push({
      groupId: g.id,
      title: g.title,
      total: tasks.length,
      blockingTitles: blockingStageTitles({ groupId: g.id, edges, completeGroupIds: completeIds, titleByGroupId }),
    })
  }
  rows.sort((a, b) => a.title.localeCompare(b.title))
  return rows
}

export type GoalMilestone = {
  groupId: string
  title: string
  feederDone: number
  feederTotal: number
  feederStages: number
  complete: boolean
}

/**
 * Task-less stages rendered as milestones, measured by every task in their
 * transitive predecessor subtree. Empty stages inside the subtree contribute
 * stages but no tasks.
 */
export function goalMilestones(args: {
  groups: ReadonlyArray<PlanGroup>
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<PlanTask>>
  completeIds: ReadonlySet<string>
  edges: ReadonlyArray<TechTreeEdge>
}): GoalMilestone[] {
  const { groups, tasksByGroup, completeIds, edges } = args
  const incoming = new Map<string, string[]>()
  for (const e of edges) {
    const list = incoming.get(e.toGroupId) ?? []
    list.push(e.fromGroupId)
    incoming.set(e.toGroupId, list)
  }
  const rows: GoalMilestone[] = []
  for (const g of groups) {
    if ((tasksByGroup.get(g.id) ?? []).length > 0) continue
    const seen = new Set<string>()
    const stack = [...(incoming.get(g.id) ?? [])]
    while (stack.length) {
      const n = stack.pop()!
      if (seen.has(n)) continue
      seen.add(n)
      for (const p of incoming.get(n) ?? []) stack.push(p)
    }
    let feederDone = 0
    let feederTotal = 0
    for (const gid of seen) {
      const tasks = tasksByGroup.get(gid) ?? []
      feederTotal += tasks.length
      feederDone += tasks.filter((t) => t.completed_at != null).length
    }
    rows.push({
      groupId: g.id,
      title: g.title,
      feederDone,
      feederTotal,
      feederStages: seen.size,
      complete: completeIds.has(g.id),
    })
  }
  rows.sort((a, b) => {
    const fa = a.feederTotal === 0 ? 0 : a.feederDone / a.feederTotal
    const fb = b.feederTotal === 0 ? 0 : b.feederDone / b.feederTotal
    if (fb !== fa) return fb - fa
    return a.title.localeCompare(b.title)
  })
  return rows
}
