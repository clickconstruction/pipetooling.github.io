// Job Parts Tally → Transactions → Team (punch list #72, PR 3, its first half): undo a sorted line.
// A charge sorted to jobs goes back to the queue when its splits are cleared through the same staff
// write Sort the day uses, called with no rows: the write deletes the charge's splits and adds none.
// Only a charge that went to jobs and nothing else is undone here. One matched to invoices keeps its
// invoices window, and one marked payroll needs payroll access, which the queue's sorter may not have.
// Pure: the write itself is in `TallyTeamQueue.tsx`.

import type { Json } from '../../types/database'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import { parseSortedInvoiceLinks, parseSortedJobSplits, type SortedTeamPurchaseRow } from '../teamPurchasesSorted'

/** One charge to put back: whose card it is on, for the staff write's holder check. */
export type TallyUndoLine = {
  chargeId: string
  holderId: string
}

/** A day card's sorted line, when it went to jobs and nothing else and this viewer may write its splits. */
export function tallyUndoLineFromWindowRow(row: CardChargeWindowRow): TallyUndoLine | null {
  if (!row.holderUserId || !row.viewerCanSort) return null
  if (row.splits.length === 0 || row.invoiceLinks.length > 0 || row.payrollMarked) return null
  return { chargeId: row.id, holderId: row.holderUserId }
}

/** A row of the Sorted list, when it went to jobs and nothing else. */
export function tallyUndoLineFromSortedRow(row: SortedTeamPurchaseRow): TallyUndoLine | null {
  if (!row.target_user_id) return null
  if (parseSortedJobSplits(row.job_splits).length === 0) return null
  if (parseSortedInvoiceLinks(row.invoice_links).length > 0) return null
  return { chargeId: row.mercury_transaction_id, holderId: row.target_user_id }
}

/** The arguments for `replace_mercury_job_splits_for_linked_card_as_staff` that clear a charge's splits. */
export function tallyUndoRpcArgs(line: TallyUndoLine): {
  p_for_user_id: string
  p_mercury_transaction_id: string
  p_rows: Json
} {
  return { p_for_user_id: line.holderId, p_mercury_transaction_id: line.chargeId, p_rows: [] }
}

/** The message after an undo: how many charges are back to sort, and whether any could not be undone. */
export function tallyUndoToast(done: number, failed: number): { message: string; type: 'success' | 'error' } {
  if (done === 0) return { message: 'Nothing was undone. Try again.', type: 'error' }
  if (failed > 0) return { message: `${done} of ${done + failed} are back to sort. The rest could not be undone.`, type: 'error' }
  return { message: done === 1 ? '1 charge is back to sort.' : `${done} charges are back to sort.`, type: 'success' }
}
