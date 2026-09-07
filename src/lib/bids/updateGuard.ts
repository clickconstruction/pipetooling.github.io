/**
 * v2.2454 — guard against silent no-op UPDATEs on RLS-fenced `bids` rows.
 *
 * Supabase returns success with zero affected rows when row-level security
 * filters the target row out of an UPDATE (e.g. the digital-twin write fence,
 * or a bid deleted by someone else mid-edit). Without checking the returned
 * rows, Edit Bid closed as if the save landed. Found by the twin M3 fence
 * probe (docs/twins/missions/estimator.md results table).
 *
 * The check, the message and the `rls_refused` beacon live in
 * `src/lib/refusedWrite.ts`; this file is the bids-flavoured entry.
 */
import { refusedUpdateMessage, updateRefused } from '../refusedWrite'

export { updateApplied } from '../refusedWrite'

export const BID_UPDATE_NOT_APPLIED_MESSAGE = refusedUpdateMessage('bid')

/** True when a `bids` update touched nothing — and the refusal has been reported. */
export function bidUpdateRefused(rows: ReadonlyArray<unknown> | null | undefined): boolean {
  return updateRefused(rows, 'bids')
}
