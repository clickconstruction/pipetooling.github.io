/**
 * Checklist Roadmap (tech tree) graph helpers: prerequisites between groups, unlock state, cycle detection.
 * Edge from_group -> to_group: to_group is locked until from_group is complete.
 */

export type TechTreeEdge = { fromGroupId: string; toGroupId: string }

/** True if every task has completedAt set; empty task list is not complete. */
export function isGroupComplete(
  tasks: ReadonlyArray<{ completedAt: string | null }>,
): boolean {
  if (tasks.length === 0) return false
  return tasks.every((t) => t.completedAt != null)
}

/**
 * If there is a directed path (following edges from->to) from `fromId` to `toId`, returns true.
 * Used to test whether adding (from, to) would create a cycle (path to -> ... -> from).
 */
function hasPath(adj: Map<string, string[]>, fromId: string, toId: string): boolean {
  const seen = new Set<string>()
  const stack = [fromId]
  while (stack.length) {
    const n = stack.pop()!
    if (n === toId) return true
    if (seen.has(n)) continue
    seen.add(n)
    for (const w of adj.get(n) ?? []) stack.push(w)
  }
  return false
}

/** Adjacency: fromId -> [toId, ...] (edge direction: prerequisite first, dependent second). */
export function buildOutgoingAdj(edges: ReadonlyArray<TechTreeEdge>): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const e of edges) {
    const list = m.get(e.fromGroupId) ?? []
    list.push(e.toGroupId)
    m.set(e.fromGroupId, list)
  }
  return m
}

/** True if adding `from` -> `to` would create a cycle. */
export function wouldAddEdgeCreateCycle(
  existingEdges: ReadonlyArray<TechTreeEdge>,
  fromGroupId: string,
  toGroupId: string,
): boolean {
  if (fromGroupId === toGroupId) return true
  const adj = buildOutgoingAdj(existingEdges)
  return hasPath(adj, toGroupId, fromGroupId)
}

export type GroupTaskState = { groupId: string; completedAt: string | null }

/**
 * A group is unlocked when it has no incoming edges, or every predecessor group is in `completeGroupIds`.
 */
export function computeUnlockedGroupIds(
  allGroupIds: ReadonlySet<string> | ReadonlyArray<string>,
  edges: ReadonlyArray<TechTreeEdge>,
  completeGroupIds: ReadonlySet<string>,
): Set<string> {
  const idList = Array.isArray(allGroupIds) ? allGroupIds : [...allGroupIds]
  const incoming = new Map<string, string[]>()
  for (const g of idList) incoming.set(g, [])
  for (const e of edges) {
    if (!incoming.has(e.toGroupId)) continue
    const list = incoming.get(e.toGroupId) ?? []
    list.push(e.fromGroupId)
    incoming.set(e.toGroupId, list)
  }
  const unlocked = new Set<string>()
  for (const gid of idList) {
    const preds = incoming.get(gid) ?? []
    if (preds.length === 0) {
      unlocked.add(gid)
      continue
    }
    const allComplete = preds.every((p) => completeGroupIds.has(p))
    if (allComplete) unlocked.add(gid)
  }
  return unlocked
}

/**
 * For each group id, derive completion from per-task state.
 */
export function completeGroupIdsFromTasks(
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<{ completed_at: string | null }>>,
): Set<string> {
  const s = new Set<string>()
  for (const [gid, taskList] of tasksByGroup) {
    if (isGroupComplete(taskList.map((t) => ({ completedAt: t.completed_at })))) s.add(gid)
  }
  return s
}

/**
 * Milestone-aware completion (v2.1913): stages WITH tasks complete when every
 * task is done (unchanged); stages with NO tasks but at least one predecessor
 * are milestones — they count complete once every predecessor is complete.
 * Fixpoint iteration lets chains of empty stages cascade. This is what keeps
 * task-less goal stages from permanently locking everything behind them.
 *
 * A task-less stage with NO predecessors is "not planned yet" (owner decision
 * 2026-08-22): neither complete nor a milestone — it used to be vacuously
 * complete and read "✓ reached" for a stage nobody had touched. Mirrored in
 * the `sync_roadmap_to_checklist` RPC — keep the two in sync.
 */
export function computeCompleteGroupIdsWithMilestones(
  allGroupIds: ReadonlySet<string> | ReadonlyArray<string>,
  edges: ReadonlyArray<TechTreeEdge>,
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<{ completed_at: string | null }>>,
): Set<string> {
  const idList = Array.isArray(allGroupIds) ? allGroupIds : [...allGroupIds]
  const complete = new Set<string>()
  const empty: string[] = []
  for (const gid of idList) {
    const tasks = tasksByGroup.get(gid) ?? []
    if (tasks.length === 0) empty.push(gid)
    else if (tasks.every((t) => t.completed_at != null)) complete.add(gid)
  }
  const incoming = new Map<string, string[]>()
  for (const e of edges) {
    const list = incoming.get(e.toGroupId) ?? []
    list.push(e.fromGroupId)
    incoming.set(e.toGroupId, list)
  }
  let grew = true
  while (grew) {
    grew = false
    for (const gid of empty) {
      if (complete.has(gid)) continue
      const preds = incoming.get(gid) ?? []
      if (preds.length === 0) continue // not planned yet — never a reached milestone
      if (preds.every((p) => complete.has(p))) {
        complete.add(gid)
        grew = true
      }
    }
  }
  return complete
}

/**
 * Task-less stages with no prerequisites — "not planned yet". They are
 * unlocked (nothing gates them) but never complete, so their dependents stay
 * locked until the stage gets tasks or a predecessor.
 */
export function unplannedGroupIds(
  allGroupIds: ReadonlySet<string> | ReadonlyArray<string>,
  edges: ReadonlyArray<TechTreeEdge>,
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<unknown>>,
): Set<string> {
  const idList = Array.isArray(allGroupIds) ? allGroupIds : [...allGroupIds]
  const idSet = new Set(idList)
  const hasIncoming = new Set<string>()
  for (const e of edges) {
    if (idSet.has(e.fromGroupId) && idSet.has(e.toGroupId)) hasIncoming.add(e.toGroupId)
  }
  const out = new Set<string>()
  for (const gid of idList) {
    if ((tasksByGroup.get(gid) ?? []).length === 0 && !hasIncoming.has(gid)) out.add(gid)
  }
  return out
}

/**
 * Why a prerequisite link can't be added right now — read-only viewer, self-link,
 * duplicate, or a cycle — as the toast/inline message the Map shows; null when
 * the link is fine. (Moved from ChecklistTechTreeTab in v2.2156.)
 */
export function getAddPrereqLinkBlockReason(
  canEdit: boolean,
  fromGroupId: string,
  toGroupId: string,
  treeEdges: ReadonlyArray<{ from_group_id: string; to_group_id: string }>,
): string | null {
  if (!canEdit) return "You can't edit roadmap links (read-only)."
  if (!fromGroupId || !toGroupId) return null
  if (fromGroupId === toGroupId) return "A group can't be a prerequisite of itself."
  if (treeEdges.some((e) => e.from_group_id === fromGroupId && e.to_group_id === toGroupId)) {
    return 'This link already exists.'
  }
  const existing: TechTreeEdge[] = treeEdges.map((e) => ({
    fromGroupId: e.from_group_id,
    toGroupId: e.to_group_id,
  }))
  if (wouldAddEdgeCreateCycle(existing, fromGroupId, toGroupId)) {
    return 'That link would create a cycle.'
  }
  return null
}


export type SequentialTaskLite = {
  id: string
  title: string
  completed_at: string | null
}

/**
 * Sequential stages (v2.2264): tasks run in the array's order (sort_index,
 * as loaded). A task is WAITING when the stage is sequential and any earlier
 * sibling is incomplete — waiting tasks stay off lists and can't be completed
 * by non-staff. Returns the waiting ids plus, per waiting task, the first
 * open sibling it waits behind (the "after X" name).
 */
export function sequentialWaiting(args: {
  tasksByGroup: ReadonlyMap<string, readonly SequentialTaskLite[]>
  sequentialByGroupId: ReadonlyMap<string, boolean>
}): {
  waitingIds: Set<string>
  /** waiting task id → the open task it waits behind. */
  blockerByTaskId: Map<string, SequentialTaskLite>
} {
  const waitingIds = new Set<string>()
  const blockerByTaskId = new Map<string, SequentialTaskLite>()
  for (const [groupId, tasks] of args.tasksByGroup) {
    if (args.sequentialByGroupId.get(groupId) === false) continue
    let firstOpen: SequentialTaskLite | null = null
    for (const t of tasks) {
      if (t.completed_at != null) continue
      if (firstOpen == null) {
        firstOpen = t
      } else {
        waitingIds.add(t.id)
        blockerByTaskId.set(t.id, firstOpen)
      }
    }
  }
  return { waitingIds, blockerByTaskId }
}
