/**
 * Roadmap ⇄ checklist bridge helpers (Phase R2/R3, v2.1876): per-task live
 * status chips on the tech-tree canvas and the Review tab's Goals strip.
 * Bridge rows come from checklist_items.roadmap_group_task_id (v2.1875).
 */

import {
  computeUnlockedGroupIds,
  isGroupComplete,
  type TechTreeEdge,
} from './checklistTechTreeGraph'

export type BridgeState = { instanceCompletedAt: string | null; reviewedAt: string | null }

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
    const completeIds = new Set(
      rmGroups
        .filter((g) => isGroupComplete(rmTasks.filter((t) => t.group_id === g.id).map((t) => ({ completedAt: t.completed_at }))))
        .map((g) => g.id),
    )
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
