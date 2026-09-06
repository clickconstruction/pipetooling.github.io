/**
 * Undo plan for "Import from /Tooling" (journey-map Tier-2 #42, J11-F3). The
 * import inserts count rows one by one and may overwrite the bid's
 * CountTooling source link; undo must delete exactly the rows it inserted and
 * put the link back only when the import actually changed it.
 */
export type ImportUndoPlan = {
  /** Row ids to delete — the inserted ids, de-duplicated, blanks dropped. */
  deleteRowIds: string[]
  /** Restore `bids.count_tooling_plans_link` to this value; null = the import didn't change it. */
  restoreSourceLink: { to: string | null } | null
}

export function importUndoPlan(args: {
  insertedIds: ReadonlyArray<string | null | undefined>
  /** The bid's link before the import (null/undefined = none). */
  sourceLinkBefore: string | null | undefined
  /** The link the import wrote, or null when it wrote nothing. */
  sourceLinkWritten: string | null
}): ImportUndoPlan {
  const seen = new Set<string>()
  const deleteRowIds: string[] = []
  for (const id of args.insertedIds) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    deleteRowIds.push(id)
  }
  const before = args.sourceLinkBefore ?? null
  const restoreSourceLink = args.sourceLinkWritten != null && args.sourceLinkWritten !== before ? { to: before } : null
  return { deleteRowIds, restoreSourceLink }
}

export function importUndoIsEmpty(plan: ImportUndoPlan): boolean {
  return plan.deleteRowIds.length === 0 && plan.restoreSourceLink == null
}
