/**
 * Pure kernel for the Prospects → Team tab (prospective hires).
 *
 * The Team tab is a board: one column per role being hired for
 * (team_prospect_roles), plus a virtual "Unsorted" column for rows with
 * role_id NULL. Candidates carry an explicit rank_order scoped to their
 * column (1 = top candidate). Grouping, reorder, and cross-column move math
 * live here so the drag-and-drop component stays thin and the invariants
 * (dense 1..n ranks per column, minimal update sets) are unit-tested.
 */

export type TeamProspectStatus = 'active' | 'hired' | 'passed'

export type RankableTeamProspect = {
  id: string
  status: string
  rank_order: number
  role_id: string | null
  created_at: string | null
}

export type TeamProspectRankUpdate = {
  id: string
  rank_order: number
  /** Present only when the row changed columns. */
  role_id?: string | null
}

export type GroupedTeamProspects<T> = {
  /** Active candidates per column, rank order. Key = role id, or UNSORTED_ROLE_KEY for role_id NULL. */
  activeByRole: Record<string, T[]>
  hired: T[]
  passed: T[]
}

/** Virtual column key for active candidates with no role assigned. */
export const UNSORTED_ROLE_KEY = 'unsorted'

export function roleKeyOf(row: Pick<RankableTeamProspect, 'role_id'>): string {
  return row.role_id ?? UNSORTED_ROLE_KEY
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

/** Split rows into per-column active lists (rank order) and hired/passed buckets (newest first). */
export function groupTeamProspects<T extends RankableTeamProspect>(rows: T[]): GroupedTeamProspects<T> {
  const active = rows.filter((r) => r.status !== 'hired' && r.status !== 'passed').sort(compareByRank)
  const activeByRole: Record<string, T[]> = {}
  for (const row of active) {
    const key = roleKeyOf(row)
    ;(activeByRole[key] ??= []).push(row)
  }
  const hired = rows.filter((r) => r.status === 'hired').sort(compareByNewestFirst)
  const passed = rows.filter((r) => r.status === 'passed').sort(compareByNewestFirst)
  return { activeByRole, hired, passed }
}

/** Rank for a candidate appended at the bottom of one column's active list. */
export function nextTeamProspectRank(rows: RankableTeamProspect[], roleId: string | null): number {
  const key = roleId ?? UNSORTED_ROLE_KEY
  let max = 0
  for (const r of rows) {
    if (r.status === 'hired' || r.status === 'passed') continue
    if (roleKeyOf(r) !== key) continue
    if (r.rank_order > max) max = r.rank_order
  }
  return max + 1
}

/**
 * Move active[fromIndex] to toIndex within ONE column and re-number ranks
 * densely (1..n). Returns the reordered list plus ONLY the rows whose
 * rank_order actually changed, so the caller writes the minimal set of updates.
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

/**
 * Move one candidate from a source column into a destination column at
 * destIndex (dest.length appends), re-assigning role_id and re-numbering both
 * columns densely. The moved row's update always carries the new role_id;
 * other rows appear in `updates` only when their rank actually changed.
 */
export function moveTeamProspectAcrossRoles<T extends RankableTeamProspect>(
  source: T[],
  dest: T[],
  movedId: string,
  destIndex: number,
  destRoleId: string | null,
): { source: T[]; dest: T[]; updates: TeamProspectRankUpdate[] } {
  const fromIndex = source.findIndex((r) => r.id === movedId)
  if (fromIndex < 0) return { source, dest, updates: [] }
  const insertAt = Math.max(0, Math.min(destIndex, dest.length))

  const nextSource = [...source]
  const [moved] = nextSource.splice(fromIndex, 1)
  const movedRow = { ...(moved as T), role_id: destRoleId }
  const nextDest = [...dest]
  nextDest.splice(insertAt, 0, movedRow)

  const updates: TeamProspectRankUpdate[] = []
  const renumberedSource = nextSource.map((row, i) => {
    const rank = i + 1
    if (row.rank_order !== rank) updates.push({ id: row.id, rank_order: rank })
    return row.rank_order === rank ? row : { ...row, rank_order: rank }
  })
  const renumberedDest = nextDest.map((row, i) => {
    const rank = i + 1
    if (row.id === movedId) {
      // Always persist the moved row: its role changed even if its rank didn't
      updates.push({ id: row.id, rank_order: rank, role_id: destRoleId })
      return { ...row, rank_order: rank }
    }
    if (row.rank_order !== rank) updates.push({ id: row.id, rank_order: rank })
    return row.rank_order === rank ? row : { ...row, rank_order: rank }
  })
  return { source: renumberedSource, dest: renumberedDest, updates }
}
