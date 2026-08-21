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
