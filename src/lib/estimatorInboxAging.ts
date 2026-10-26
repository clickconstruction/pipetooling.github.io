/**
 * Estimator inbox ordering kernel (punch list #184 sweep B). The inbox used to
 * sort its open requests NEWEST first under the customer-waiting tier, so the
 * request an estimator had left 12 days sat at the bottom under this morning's
 * in the same gray. It now reads exactly like the Dispatch inbox
 * (`dispatchInboxAging.ts`): a customer waiting (open + high) first, then open
 * rows OLDEST first, then closed rows newest-closed first (the archive reads
 * like a log). One comparator for both inboxes, so they can never drift; the
 * chip beside the date is `ESTIMATOR_REQUEST_AGE` (3 / 7 days).
 */
import { compareDispatchInboxRows, type DispatchAgingRow } from './dispatchInboxAging'

export type EstimatorAgingRow = DispatchAgingRow

/** Customer waiting first, then open oldest-first, then closed newest-closed-first. */
export function compareEstimatorInboxRows(a: EstimatorAgingRow, b: EstimatorAgingRow): number {
  return compareDispatchInboxRows(a, b)
}

export function sortEstimatorInboxRows<T extends EstimatorAgingRow>(rows: ReadonlyArray<T>): T[] {
  return [...rows].sort(compareEstimatorInboxRows)
}
