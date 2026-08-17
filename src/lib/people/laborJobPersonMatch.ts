/**
 * Sub-sheet → person membership (PERSON_IDENTITY_PLAN C1-7).
 *
 * `people_labor_jobs.assigned_to_name` is a `' | '`-delimited multi-name
 * string, so an exact `.eq('assigned_to_name', personName)` read silently
 * returns zero rows for any sheet with 2+ assignees. Match junction-first
 * (`people_labor_job_assignees`, person_id-keyed) with a name fallback that
 * splits the delimited column — never a bare equality on the raw text.
 * Pure, no I/O.
 */

/** Split the `' | '`-delimited assignees column into trimmed non-empty names. */
export function splitAssignedToNames(assignedToName: string | null | undefined): string[] {
  if (!assignedToName) return []
  return assignedToName
    .split('|')
    .map((n) => n.trim())
    .filter(Boolean)
}

/**
 * Person's even share of a sub sheet: 1/N of the sheet for N distinct
 * assignees when the person is one of them, else 0. Splitting — rather than
 * attributing the full sheet to every assignee — keeps a multi-assignee
 * sheet's hours/cost counted exactly once across a team roll-up.
 * Single-assignee sheets get share 1 (identical to an exact-name match).
 */
export function laborJobShareForPerson(
  assignedToName: string | null | undefined,
  personName: string,
): number {
  const target = personName.trim()
  if (!target) return 0
  const segments = [...new Set(splitAssignedToNames(assignedToName))]
  if (!segments.includes(target)) return 0
  return 1 / segments.length
}

/**
 * True when a sub sheet belongs to the person: the person_id-keyed junction
 * row wins first; otherwise fall back to trimmed-name membership in the
 * delimited `assigned_to_name` list (covers rows the junction backfill
 * missed — degrades to today's exact-name behavior, never worse).
 */
export function laborJobMatchesPerson(
  row: { id: string; assigned_to_name: string | null },
  junctionJobIds: ReadonlySet<string>,
  personName: string,
): boolean {
  if (junctionJobIds.has(row.id)) return true
  const target = personName.trim()
  if (!target) return false
  return splitAssignedToNames(row.assigned_to_name).includes(target)
}
