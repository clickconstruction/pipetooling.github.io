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
 * task is done (unchanged); stages with NO tasks are milestones — they count
 * complete once every predecessor is complete (vacuously true for empty roots).
 * Fixpoint iteration lets chains of empty stages cascade. This is what keeps
 * task-less goal stages from permanently locking everything behind them.
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
      if (preds.every((p) => complete.has(p))) {
        complete.add(gid)
        grew = true
      }
    }
  }
  return complete
}
