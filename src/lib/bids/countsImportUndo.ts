/**
 * Undo plan for "Import from /Tooling" (journey-map Tier-2 #42, J11-F3). The
 * import inserts count rows one by one and may overwrite the bid's
 * CountTooling source link; undo must delete exactly the rows it inserted and
 * put the link back only when the import actually changed it.
 *
 * v2.4699: an import reviewed against the bid's rows also updates and removes
 * rows, so the plan carries each updated row's old values and each removed row
 * whole. A removed row comes back bare — its parts and prices went with it
 * (ON DELETE CASCADE), which is why the review says so before Apply.
 */
export type ImportUndoRestoreRow = { id: string; before: Record<string, unknown> }
export type ImportUndoReinsertRow = {
  id: string
  bid_id: string
  bid_version_id: string | null
  fixture: string
  count: number
  group_tag: string | null
  page: string | null
  unit: string | null
  sequence_order: number | null
}

export type ImportUndoPlan = {
  /** Row ids to delete — the inserted ids, de-duplicated, blanks dropped. */
  deleteRowIds: string[]
  /** Restore `bids.count_tooling_plans_link` to this value; null = the import didn't change it. */
  restoreSourceLink: { to: string | null } | null
  /** Updated rows → their old values (empty patches dropped). */
  restoreRows: ImportUndoRestoreRow[]
  /** Removed rows, whole, re-inserted under their old ids. */
  reinsertRows: ImportUndoReinsertRow[]
}

export function importUndoPlan(args: {
  insertedIds: ReadonlyArray<string | null | undefined>
  /** The bid's link before the import (null/undefined = none). */
  sourceLinkBefore: string | null | undefined
  /** The link the import wrote, or null when it wrote nothing. */
  sourceLinkWritten: string | null
  restoreRows?: ReadonlyArray<ImportUndoRestoreRow>
  reinsertRows?: ReadonlyArray<ImportUndoReinsertRow>
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
  const restoreRows = (args.restoreRows ?? []).filter((r) => r.id && Object.keys(r.before).length > 0)
  const reinsertRows = [...(args.reinsertRows ?? [])]
  return { deleteRowIds, restoreSourceLink, restoreRows, reinsertRows }
}

export function importUndoIsEmpty(plan: ImportUndoPlan): boolean {
  return plan.deleteRowIds.length === 0 && plan.restoreSourceLink == null && plan.restoreRows.length === 0 && plan.reinsertRows.length === 0
}

/** "Import undone — 2 rows removed, 5 put back, 2 restored." */
export function describeImportUndo(plan: ImportUndoPlan): string {
  const parts: string[] = []
  if (plan.deleteRowIds.length) parts.push(`${plan.deleteRowIds.length} row${plan.deleteRowIds.length === 1 ? '' : 's'} removed`)
  if (plan.restoreRows.length) parts.push(`${plan.restoreRows.length} put back`)
  if (plan.reinsertRows.length) parts.push(`${plan.reinsertRows.length} restored`)
  return parts.length ? `Import undone — ${parts.join(', ')}.` : 'Import undone.'
}
