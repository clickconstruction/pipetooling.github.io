/**
 * Active roster (journey-map Tier-2 #19, cluster C33).
 *
 * Every roster, picker and lens used to run its own `users` select that
 * honoured `archived_at` sometimes and `is_digital_twin` almost never, so
 * twins ("Twin Estimator 1"), archived debris ("delete", "Merge Test keep")
 * and dev fixtures ("test") leaked into crew pickers, the Review deck, the
 * Person rail and the `/` quick sheet. This is the one predicate they all
 * share now; `fetchActiveUsers` is the matching server-side query.
 *
 * Convention (matches `usePeopleRoster` / the Jobs and Job-form user loaders):
 * - archived accounts are never active;
 * - digital twins are never active on a human surface (their home is
 *   Settings → Digital twins and the Robot Board);
 * - dev accounts are the fixtures lane (`test` is a dev row) — they show only
 *   when the viewer is dev, unless a surface opts in with `includeDev: true`
 *   because it legitimately assigns work to the owner.
 */

export type ActiveRosterRow = {
  archived_at?: string | null
  is_digital_twin?: boolean | null
  role?: string | null
}

export type ActiveRosterOptions = {
  /** Keep `role = 'dev'` rows. Default false: dev rows are dev-viewer-only. */
  includeDev?: boolean
  /** Keep archived rows (the Person rail groups them under its own fold). Default false. */
  includeArchived?: boolean
}

export function isActiveRosterPerson(row: ActiveRosterRow, opts: ActiveRosterOptions = {}): boolean {
  if (row.is_digital_twin === true) return false
  if (!opts.includeArchived && row.archived_at != null) return false
  if (!opts.includeDev && row.role === 'dev') return false
  return true
}

/** Order-preserving filter over rows already in memory. */
export function activeRosterOnly<T extends ActiveRosterRow>(rows: readonly T[], opts: ActiveRosterOptions = {}): T[] {
  return rows.filter((r) => isActiveRosterPerson(r, opts))
}

/** The `people` (external roster) table has no twin flag; archived is the only exclusion. */
export function isActiveRosterExternal(row: { archived_at?: string | null }): boolean {
  return row.archived_at == null
}
