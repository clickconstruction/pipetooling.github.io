/**
 * Roadmap Plan view kernels (v2.1913): the flat "work front" lens over the
 * tech tree — header stats, the Now list, Up next (locked stages with their
 * blockers), and Goals (task-less milestone stages measured by their
 * transitive feeder tasks). Since v2.1946 every list keeps the caller's
 * `groups` order — the roadmap's stage order (sort_index, user-draggable via
 * Order stages) — so rows read #1, #2, #3… matching the stage-number badges.
 */

import { blockingStageTitles } from './roadmapBridge'
import type { TechTreeEdge } from './checklistTechTreeGraph'

export type PlanTask = {
  id: string
  group_id: string
  title: string
  completed_at: string | null
  assigneeIds: string[]
  /** ★ pin (v2.2140) — leads the Next up shortlist; shown as ★ on Plan rows. */
  pinned_at?: string | null
  /** Effort estimate in days (v2.2358) — the Timeline's slot weight; null = roadmap average. */
  estimated_days?: number | null
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
 * Unlocked, incomplete stages that have tasks — the work front, in the
 * roadmap's stage order (so rows read #1, #2, #3… like their badges).
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
  return rows
}

export type PlanFocus = 'assigned' | 'unstaffed'

export type PlanFocusRow = { groupId: string; tasks: PlanTask[] }

/**
 * The temporary focus lens (v2.1999): tapping "N assigned" / "N unstaffed"
 * in the header narrows the Now list to open tasks matching the lens.
 * Stages with no surviving tasks are dropped (their count feeds the
 * "hidden" note); done tasks and task-less milestone stages never survive.
 */
export function planFocusRows(args: {
  nowStages: ReadonlyArray<PlanNowStage>
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<PlanTask>>
  focus: PlanFocus
}): { rows: PlanFocusRow[]; hiddenStages: number; taskCount: number } {
  const { nowStages, tasksByGroup, focus } = args
  const rows: PlanFocusRow[] = []
  let hiddenStages = 0
  let taskCount = 0
  for (const s of nowStages) {
    const tasks = (tasksByGroup.get(s.groupId) ?? []).filter(
      (t) => t.completed_at == null && (focus === 'assigned' ? t.assigneeIds.length > 0 : t.assigneeIds.length === 0),
    )
    if (tasks.length === 0) {
      hiddenStages += 1
      continue
    }
    taskCount += tasks.length
    rows.push({ groupId: s.groupId, tasks: [...tasks] })
  }
  return { rows, hiddenStages, taskCount }
}

export type GoalMilestone = {
  groupId: string
  title: string
  feederDone: number
  feederTotal: number
  feederStages: number
  complete: boolean
  /** No prerequisites at all — "not planned yet" (v2.2127): nothing feeds it, so there is nothing to measure. */
  unplanned: boolean
}

/**
 * Task-less stages rendered as milestones, measured by every task in their
 * transitive predecessor subtree. Empty stages inside the subtree contribute
 * stages but no tasks. A task-less stage with no predecessors is `unplanned`.
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
      unplanned: (incoming.get(g.id) ?? []).length === 0,
    })
  }
  return rows
}
