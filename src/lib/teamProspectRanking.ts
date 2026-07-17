/**
 * Pure kernel for the Prospects → Team tab (prospective hires).
 *
 * Candidates carry an explicit rank_order (1 = top candidate). Grouping and
 * reorder math live here so the drag-and-drop component stays thin and the
 * invariants (dense 1..n ranks, minimal update sets) are unit-tested.
 */

export type TeamProspectStatus = 'active' | 'hired' | 'passed'

export type RankableTeamProspect = {
  id: string
  status: string
  rank_order: number
  created_at: string | null
}

export type TeamProspectRankUpdate = { id: string; rank_order: number }

export type GroupedTeamProspects<T> = {
  active: T[]
  hired: T[]
  passed: T[]
}

function compareByRank(a: RankableTeamProspect, b: RankableTeamProspect): number {
  if (a.rank_order !== b.rank_order) return a.rank_order - b.rank_order
  // Stable tie-break so equal ranks (e.g. legacy 0s) don't jitter between loads
  const aCreated = a.created_at ?? ''
  const bCreated = b.created_at ?? ''
  if (aCreated !== bCreated) return aCreated < bCreated ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function compareByNewestFirst(a: RankableTeamProspect, b: RankableTeamProspect): number {
  const aCreated = a.created_at ?? ''
  const bCreated = b.created_at ?? ''
  if (aCreated !== bCreated) return aCreated > bCreated ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Split rows into active (rank order) and hired/passed buckets (newest decision first). */
export function groupTeamProspects<T extends RankableTeamProspect>(rows: T[]): GroupedTeamProspects<T> {
  const active = rows.filter((r) => r.status !== 'hired' && r.status !== 'passed').sort(compareByRank)
  const hired = rows.filter((r) => r.status === 'hired').sort(compareByNewestFirst)
  const passed = rows.filter((r) => r.status === 'passed').sort(compareByNewestFirst)
  return { active, hired, passed }
}

/** Rank for a candidate appended at the bottom of the active list. */
export function nextTeamProspectRank(rows: RankableTeamProspect[]): number {
  const { active } = groupTeamProspects(rows)
  let max = 0
  for (const r of active) {
    if (r.rank_order > max) max = r.rank_order
  }
  return max + 1
}

/**
 * Move active[fromIndex] to toIndex and re-number ranks densely (1..n).
 * Returns the reordered list plus ONLY the rows whose rank_order actually
 * changed, so the caller writes the minimal set of updates.
 */
export function reorderActiveTeamProspects<T extends RankableTeamProspect>(
  active: T[],
  fromIndex: number,
  toIndex: number,
): { next: T[]; updates: TeamProspectRankUpdate[] } {
  if (
    fromIndex < 0 || fromIndex >= active.length ||
    toIndex < 0 || toIndex >= active.length
  ) {
    return { next: active, updates: [] }
  }
  const next = [...active]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved as T)
  const updates: TeamProspectRankUpdate[] = []
  const renumbered = next.map((row, i) => {
    const rank = i + 1
    if (row.rank_order !== rank) updates.push({ id: row.id, rank_order: rank })
    return row.rank_order === rank ? row : { ...row, rank_order: rank }
  })
  return { next: renumbered, updates }
}
