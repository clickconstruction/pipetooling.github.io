/**
 * Roadmap stage numbering (v2.1940): stage #N = position N in the roadmap's
 * `sort_index`-ordered stage list, so numbers are derived, never stored —
 * always dense 1..N per roadmap, and the top stage is always #1. One source
 * feeds the Map cluster badges, the Plan rows, and the Order-stages modal,
 * so the views can never disagree.
 */
export function stageNumbersByGroupId(orderedGroups: ReadonlyArray<{ id: string }>): Map<string, number> {
  const numbers = new Map<string, number>()
  orderedGroups.forEach((g, i) => numbers.set(g.id, i + 1))
  return numbers
}

/**
 * Task numbers inside stages (v2.1964): task #N.M = stage number N + the
 * task's 1-based position M in its stage's sort_index-ordered task list.
 * Derived like stage numbers — never stored, always dense per stage.
 */
export function taskNumbersByTaskId(
  stageNumbers: ReadonlyMap<string, number>,
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<{ id: string }>>,
): Map<string, string> {
  const numbers = new Map<string, string>()
  for (const [groupId, tasks] of tasksByGroup) {
    const n = stageNumbers.get(groupId)
    if (!n) continue
    tasks.forEach((t, i) => numbers.set(t.id, `${n}.${i + 1}`))
  }
  return numbers
}

/**
 * Update rows that persist per-stage task orders (v2.1964, Order-stages
 * modal's nested lists): within each group, sort_index = dense position
 * 1..N; only changed rows are returned, ids missing from `currentTasks`
 * (deleted mid-drag) are skipped, and a task whose group no longer matches
 * is skipped too (cross-stage moves live on the Map's Edit-Tasks drag).
 */
export function computeTaskOrderUpdates(
  taskOrdersByGroup: ReadonlyMap<string, ReadonlyArray<string>>,
  currentTasks: ReadonlyArray<{ id: string; group_id: string; sort_index: number }>,
): Array<{ id: string; sort_index: number }> {
  const byId = new Map(currentTasks.map((t) => [t.id, t]))
  const updates: Array<{ id: string; sort_index: number }> = []
  for (const [groupId, orderedIds] of taskOrdersByGroup) {
    orderedIds.forEach((id, i) => {
      const t = byId.get(id)
      if (!t || t.group_id !== groupId) return
      if (t.sort_index !== i + 1) updates.push({ id, sort_index: i + 1 })
    })
  }
  return updates
}

/**
 * Update rows that persist a new stage order (v2.1941, Order-stages modal):
 * sort_index = dense position 1..N, returning only the rows whose stored
 * value differs. Ids not present in `current` are skipped (stage deleted
 * mid-drag by another session — the reload after save reconciles).
 */
export function computeStageOrderUpdates(
  orderedIds: ReadonlyArray<string>,
  current: ReadonlyArray<{ id: string; sort_index: number }>,
): Array<{ id: string; sort_index: number }> {
  const byId = new Map(current.map((g) => [g.id, g.sort_index]))
  const updates: Array<{ id: string; sort_index: number }> = []
  orderedIds.forEach((id, i) => {
    const stored = byId.get(id)
    if (stored !== undefined && stored !== i + 1) updates.push({ id, sort_index: i + 1 })
  })
  return updates
}
