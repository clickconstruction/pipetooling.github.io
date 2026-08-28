/**
 * v2.2454 — guard against silent no-op UPDATEs on RLS-fenced tables.
 *
 * Supabase returns success with zero affected rows when row-level security
 * filters the target row out of an UPDATE (e.g. the digital-twin write fence,
 * or a bid deleted by someone else mid-edit). Without checking the returned
 * rows, Edit Bid closed as if the save landed. Found by the twin M3 fence
 * probe (docs/twins/missions/estimator.md results table).
 */

export const BID_UPDATE_NOT_APPLIED_MESSAGE =
  'Save didn’t apply — you don’t have permission to edit this bid, or it no longer exists. Your changes were not saved.'

/** True when an `update(...).select('id')` result actually touched rows. */
export function updateApplied(rows: ReadonlyArray<unknown> | null | undefined): boolean {
  return Array.isArray(rows) && rows.length > 0
}
