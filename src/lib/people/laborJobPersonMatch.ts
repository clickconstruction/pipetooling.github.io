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
