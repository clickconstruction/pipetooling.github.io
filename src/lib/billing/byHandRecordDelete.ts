/**
 * Deleting a by-hand record of a test bill (punch list #443, row 4): the take-back of **Record how it went** on
 * Bills sent.
 *
 * A record made by hand is one `sent_documents` row of kind `bill_by_hand`. The table has no update policy, so the
 * record cannot be changed, and nothing deleted one: a test record stood on its bill for good. The table has let a
 * dev delete since it was made (`sent_documents_delete_dev`). This is the rule for the press that does. Pure: the
 * reads and the delete are `byHandRecordDeleteIo.ts`, the press is on a bill's record in
 * `components/billing/BillsSentLedger.tsx`.
 *
 * - The press is drawn for a dev and for nobody else, and on a by-hand record alone. No other send is ever offered.
 * - Only a record of a test bill goes (`isBillsTestRow`): a bill made in Stripe's test mode, or a bill on a ZZ test job.
 * - The row is read again right before the delete, with its bill and its job, and the same rule is run on what the
 *   database holds. The page's own word that a bill is a test is never the only one.
 * - A record that kept a copy stays. A by-hand record keeps none, so one with a copy is not what this deletes.
 *
 * Nothing points at a sent copy, a by-hand record has no file in the bucket, and its kind writes no Activity line,
 * so the delete of the row is the whole take-back.
 */
import { isBillsTestRow, type BillsTestJob } from './billTestRows'

/** The kind of a record made by hand (`BILLS_SENT_BY_HAND_KIND` in `billsSent.ts`, said again here to keep this file free of the page's kernel). */
export const BY_HAND_RECORD_KIND = 'bill_by_hand'

/** The table a bill's record names as its source. */
export const BY_HAND_RECORD_BILL_TABLE = 'jobs_ledger_invoices'

/** What of a line on a bill's record the press reads. */
export interface ByHandRecordLine {
  /** *by_hand* for a record made by hand. */
  route: string
  /** True when the page reads the line's bill as a test. */
  test: boolean
  billId: string | null
}

/** Who is offered the delete, and on which line: a dev, on a record made by hand. Every other role and line draws nothing. */
export function byHandRecordDeleteDrawn(role: string | null | undefined, line: Pick<ByHandRecordLine, 'route'>): boolean {
  return role === 'dev' && line.route === 'by_hand'
}

const NOT_BY_HAND = 'Only a record made by hand can be deleted.'
const NOT_A_TEST = 'Only a record of a test bill can be deleted. This bill is a real one.'

/** Why the record on this line cannot be deleted, from what the page holds; '' when the press may go on to the fresh read. */
export function byHandRecordDeleteProblem(line: ByHandRecordLine): string {
  if (line.route !== 'by_hand') return NOT_BY_HAND
  if (!line.billId) return 'This record names no bill. It stays.'
  if (!line.test) return NOT_A_TEST
  return ''
}

/** The record as the database holds it right before the delete, with its bill and its job. */
export interface ByHandRecordRow {
  kind: string
  /** Where its copy sits in the bucket. Null for a by-hand record, which keeps none. */
  copyPath: string | null
  sourceTable: string
  /** The bill the record names, as read back; null when the bill did not read. */
  bill: { id: string; stripeMode: string | null } | null
  /** The bill's job, as read back; null when the bill has none or it did not read. */
  job: BillsTestJob | null
}

/** Why the record the database holds cannot be deleted; '' when it can. Null is a record that is no longer there. */
export function byHandRowDeleteProblem(row: ByHandRecordRow | null): string {
  if (!row) return 'The record is not there any more. Read the page again.'
  if (row.kind !== BY_HAND_RECORD_KIND) return NOT_BY_HAND
  if (row.copyPath) return 'This record kept a copy. It stays.'
  if (row.sourceTable !== BY_HAND_RECORD_BILL_TABLE || !row.bill) return 'The bill of this record could not be read. Nothing was deleted.'
  if (!isBillsTestRow({ stripeMode: row.bill.stripeMode }, row.job)) return NOT_A_TEST
  return ''
}

/** The confirm window's words. `head` and `when` are the record's own line: *Handed over by Priya*, *Mon, Nov 23*. The button names the act. */
export function byHandRecordDeleteConfirm(head: string, when: string): { title: string; message: string; confirmLabel: string } {
  const said = [head.trim(), when.trim()].filter(Boolean).join(', ')
  return {
    title: 'Delete this record made by hand?',
    message: `${said ? `${said}. ` : ''}It is a record of a test bill. The record leaves the bill, and it cannot be brought back.`,
    confirmLabel: 'Delete the record',
  }
}

/** What the toast says once it is gone. */
export const BY_HAND_RECORD_DELETED = 'The record was deleted.'
