/**
 * Roadmap ⇄ checklist bridge helpers (Phase R2/R3, v2.1876): per-task live
 * status chips on the tech-tree canvas and the Review tab's Goals strip.
 * Bridge rows come from checklist_items.roadmap_group_task_id (v2.1875).
 */

import {
  computeCompleteGroupIdsWithMilestones,
  computeUnlockedGroupIds,
  type TechTreeEdge,
} from './checklistTechTreeGraph'

export type BridgeState = {
  instanceCompletedAt: string | null
  reviewedAt: string | null
  /** The materialized checklist instance (v2.1901) — feeds the task card modal's activity thread. */
  instanceId?: string
}

export type BridgeChip = 'in_review' | 'signed_off' | 'on_list' | null

/**
 * Canvas chip for one roadmap task. 'on_list' = materialized and waiting on
 * the assignee; 'in_review' = they completed it, sign-off pending;
 * 'signed_off' = reviewed. Unbridged tasks get no chip (locked stage or no
 * assignee — the sync RPC only materializes unlocked, assigned tasks).
 */
export function bridgeChipFor(
  taskCompletedAt: string | null,
  bridge: BridgeState | undefined,
): BridgeChip {
  if (!bridge) return null
  if (bridge.instanceCompletedAt) {
    return bridge.reviewedAt ? 'signed_off' : 'in_review'
  }
  return taskCompletedAt ? null : 'on_list'
}

export type GoalsStripRow = {
  roadmapId: string
  title: string
  stagesTotal: number
  stagesComplete: number
  /** 0-100, task-weighted so a half-done stage moves the bar. */
  pct: number
  /** Unlocked-but-incomplete stage titles (the "current" work front). */
  currentStages: string[]
  /** Open (incomplete) assigned tasks across current stages. */
  openAssigned: number
}

export function goalsStripRows(args: {
  roadmaps: Array<{ id: string; title: string }>
  groups: Array<{ id: string; roadmap_id: string; title: string }>
  tasks: Array<{ id: string; group_id: string; completed_at: string | null; assigneeCount: number }>
  edges: TechTreeEdge[]
}): GoalsStripRow[] {
  const { roadmaps, groups, tasks, edges } = args
  const rows: GoalsStripRow[] = []
  for (const rm of roadmaps) {
    const rmGroups = groups.filter((g) => g.roadmap_id === rm.id)
    if (rmGroups.length === 0) continue
    const groupIds = new Set(rmGroups.map((g) => g.id))
    const rmEdges = edges.filter((e) => groupIds.has(e.fromGroupId) && groupIds.has(e.toGroupId))
    const rmTasks = tasks.filter((t) => groupIds.has(t.group_id))
    const tasksByGroup = new Map<string, Array<{ completed_at: string | null }>>()
    for (const t of rmTasks) {
      tasksByGroup.set(t.group_id, [...(tasksByGroup.get(t.group_id) ?? []), { completed_at: t.completed_at }])
    }
    // Milestone-aware (v2.1913): task-less goal stages count complete once
    // their predecessors are — matches the canvas and the sync RPC.
    const completeIds = computeCompleteGroupIdsWithMilestones(groupIds, rmEdges, tasksByGroup)
    const unlocked = computeUnlockedGroupIds(groupIds, rmEdges, completeIds)
    const current = rmGroups.filter((g) => unlocked.has(g.id) && !completeIds.has(g.id))
    const doneTasks = rmTasks.filter((t) => t.completed_at != null).length
    rows.push({
      roadmapId: rm.id,
      title: rm.title,
      stagesTotal: rmGroups.length,
      stagesComplete: completeIds.size,
      pct: rmTasks.length === 0 ? 0 : Math.round((doneTasks / rmTasks.length) * 100),
      currentStages: current.map((g) => g.title),
      openAssigned: rmTasks.filter((t) => t.completed_at == null && t.assigneeCount > 0 && current.some((c) => c.id === t.group_id)).length,
    })
  }
  return rows
}

export type StageBadge = { kind: 'done' } | { kind: 'progress'; done: number; total: number } | null

/**
 * Header badge for a stage node (v2.1894 polish): green "✓ done" when every
 * task is complete, "N of M" while in progress, nothing for empty stages.
 */
export function stageBadgeFor(tasks: Array<{ completedAt: string | null }>): StageBadge {
  if (tasks.length === 0) return null
  const done = tasks.filter((t) => t.completedAt != null).length
  if (done === tasks.length) return { kind: 'done' }
  return { kind: 'progress', done, total: tasks.length }
}

/**
 * Incomplete predecessor stage titles for a locked stage — the stages that
 * actually gate it right now (complete predecessors are no longer blockers).
 */
export function blockingStageTitles(args: {
  groupId: string
  edges: ReadonlyArray<TechTreeEdge>
  completeGroupIds: ReadonlySet<string>
  titleByGroupId: ReadonlyMap<string, string>
}): string[] {
  const { groupId, edges, completeGroupIds, titleByGroupId } = args
  const titles: string[] = []
  for (const e of edges) {
    if (e.toGroupId !== groupId) continue
    if (completeGroupIds.has(e.fromGroupId)) continue
    titles.push(titleByGroupId.get(e.fromGroupId) ?? 'a previous stage')
  }
  return titles
}

/**
 * The one-line hint under a locked stage header. Stages with assigned tasks
 * get the auto-assign wording — completing the blocker is what pushes those
 * tasks onto people's Today lists via the bridge sync.
 */
export function lockedStageHint(blockingTitles: string[], hasAssignedTasks: boolean): string | null {
  if (blockingTitles.length === 0) return null
  const first = blockingTitles[0]!
  const label =
    blockingTitles.length === 1
      ? `“${first}”`
      : blockingTitles.length === 2
        ? `“${first}” and “${blockingTitles[1]}”`
        : `“${first}” + ${blockingTitles.length - 1} more`
  const verb = blockingTitles.length > 1 ? 'are' : 'is'
  return hasAssignedTasks
    ? `Tasks auto-assign to lists when ${label} ${verb} done`
    : `Unlocks when ${label} ${verb} done`
}
