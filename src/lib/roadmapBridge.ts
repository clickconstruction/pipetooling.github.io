/**
 * Roadmap ⇄ checklist bridge helpers (Phase R2/R3, v2.1876): per-task live
 * status chips on the tech-tree canvas and the Review tab's Goals strip.
 * Bridge rows come from checklist_items.roadmap_group_task_id (v2.1875).
 */

import {
  computeCompleteGroupIdsWithMilestones,
  computeUnlockedGroupIds,
  unplannedGroupIds,
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
    const unplanned = unplannedGroupIds(groupIds, rmEdges, tasksByGroup)
    // "not planned yet" stages are unlocked but not work — they're not the front
    const current = rmGroups.filter((g) => unlocked.has(g.id) && !completeIds.has(g.id) && !unplanned.has(g.id))
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

export type GoalsStageRow = {
  groupId: string
  title: string
  done: number
  total: number
  /** 'unplanned' = task-less stage with no prerequisites — "not planned yet" (v2.2127). */
  state: 'complete' | 'current' | 'locked' | 'unplanned'
  /** Open (incomplete) assigned tasks in this stage. */
  openAssigned: number
  /** Incomplete predecessor titles — why a locked stage is locked. */
  blockedBy: string[]
}

/**
 * Per-stage rows for one roadmap's Goals-strip card (v2.2021: segmented bar
 * + tap-to-expand stage ledger). Rows come back in `sort_index` order — the
 * owner's "Order stages" arrangement, not dependency depth — so the bar reads
 * in curated order and an early-finished stage can be green out of sequence,
 * matching how the canvas thinks. Completion/unlock reuse the same
 * milestone-aware graph helpers as the canvas and the sync RPC.
 */
export function goalsStageRows(args: {
  groups: Array<{ id: string; title: string; sort_index: number }>
  tasks: Array<{ group_id: string; completed_at: string | null; assigneeCount: number }>
  edges: TechTreeEdge[]
}): GoalsStageRow[] {
  const { groups, tasks, edges } = args
  const groupIds = new Set(groups.map((g) => g.id))
  const rmEdges = edges.filter((e) => groupIds.has(e.fromGroupId) && groupIds.has(e.toGroupId))
  const tasksByGroup = new Map<string, Array<{ completed_at: string | null; assigneeCount: number }>>()
  for (const t of tasks) {
    if (!groupIds.has(t.group_id)) continue
    tasksByGroup.set(t.group_id, [...(tasksByGroup.get(t.group_id) ?? []), t])
  }
  const completeIds = computeCompleteGroupIdsWithMilestones(groupIds, rmEdges, tasksByGroup)
  const unlocked = computeUnlockedGroupIds(groupIds, rmEdges, completeIds)
  const unplanned = unplannedGroupIds(groupIds, rmEdges, tasksByGroup)
  const titleByGroupId = new Map(groups.map((g) => [g.id, g.title]))
  return [...groups]
    .sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id))
    .map((g) => {
      const gTasks = tasksByGroup.get(g.id) ?? []
      const state: GoalsStageRow['state'] = completeIds.has(g.id)
        ? 'complete'
        : unplanned.has(g.id)
          ? 'unplanned'
          : unlocked.has(g.id)
            ? 'current'
            : 'locked'
      return {
        groupId: g.id,
        title: g.title,
        done: gTasks.filter((t) => t.completed_at != null).length,
        total: gTasks.length,
        state,
        openAssigned: gTasks.filter((t) => t.completed_at == null && t.assigneeCount > 0).length,
        blockedBy:
          state === 'locked'
            ? blockingStageTitles({ groupId: g.id, edges: rmEdges, completeGroupIds: completeIds, titleByGroupId })
            : [],
      }
    })
}

/**
 * The Goals strip's "now:" list truncated to its first `limit` stage titles,
 * folding the rest into "… +N more" — a goal with a wide work front stays a
 * one-line card instead of wrapping to four.
 */
export function goalsStripNowSummary(currentStages: string[], limit = 3): string {
  const more = currentStages.length - limit
  const shown = currentStages.slice(0, limit).join(', ')
  return more > 0 ? `${shown} … +${more} more` : shown
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
export type LockedChainEntry = {
  /** The prerequisite stage's Goals row. */
  row: GoalsStageRow
  /** 1-based position in the curated stage order (the list's numbering). */
  number: number
  /** True: a direct edge into the locked stage — finishing it is what unlocks. */
  direct: boolean
}

/**
 * Every unfinished stage standing between a locked stage and unlocking
 * (v2.NNNN, the 🔒-chip modal): walk incoming edges upward, skipping complete
 * ancestors (their own chains no longer matter). Returned in curated stage
 * order — the numbering the Goals list shows — with direct blockers flagged.
 */
export function lockedStagePrerequisiteChain(args: {
  groupId: string
  stageRows: ReadonlyArray<GoalsStageRow>
  edges: ReadonlyArray<TechTreeEdge>
}): LockedChainEntry[] {
  const { groupId, stageRows, edges } = args
  const rowById = new Map(stageRows.map((r, i) => [r.groupId, { row: r, number: i + 1 }]))
  const incomplete = (id: string) => {
    const entry = rowById.get(id)
    return entry != null && entry.row.state !== 'complete'
  }
  const directIds = new Set(
    edges.filter((e) => e.toGroupId === groupId && e.fromGroupId !== groupId && incomplete(e.fromGroupId)).map((e) => e.fromGroupId),
  )
  const seen = new Set<string>(directIds)
  const queue = [...directIds]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const e of edges) {
      if (e.toGroupId !== id) continue
      // Never list the locked stage as its own prerequisite (cycle back to self).
      if (e.fromGroupId === groupId) continue
      if (!incomplete(e.fromGroupId) || seen.has(e.fromGroupId)) continue
      seen.add(e.fromGroupId)
      queue.push(e.fromGroupId)
    }
  }
  return [...seen]
    .map((id) => rowById.get(id)!)
    .sort((a, b) => a.number - b.number)
    .map(({ row, number }) => ({ row, number, direct: directIds.has(row.groupId) }))
}

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
