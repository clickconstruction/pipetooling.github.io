/**
 * Roster records with no users row (punch list #265): since #260 every person is a users row, and the backfill
 * (v2.6517) linked every People record it could. A record whose name another users row carried was skipped for the
 * desk, and nothing counted them. This is the count and its words; the No login filter shows the rows, and each
 * row's Link account joins it to its login.
 */

export function rosterStrayCount(people: ReadonlyArray<{ account_user_id: string | null; archived_at?: string | null }>): number {
  return people.filter((p) => !p.account_user_id && !p.archived_at).length
}

/** One line over the filters; null when there is nothing to say. */
export function rosterStrayWords(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 roster record has no users row yet. Link account on its row joins it to its login.' : `${count} roster records have no users row yet. Link account on each row joins it to its login.`
}
