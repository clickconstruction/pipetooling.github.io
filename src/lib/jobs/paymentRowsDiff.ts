/**
 * Diff-based payment persistence for the Edit Job billing slice (B5,
 * FRAGILITY_REMEDIATION_PLAN.md).
 *
 * The slice previously deleted ALL of a job's jobs_ledger_payments rows and
 * reinserted the form's rows with fresh UUIDs on every autosave. Two problems:
 * a payment row born AFTER form hydration (e.g. the Stripe webhook recording a
 * payment mid-edit) was silently destroyed by the delete-all, and the new
 * UUIDs made every autosave emit fresh `payment_added` activity events (the
 * job_activity_events source_id dedupe never matched).
 *
 * The diff keeps row identity stable: hydrated rows keep their DB ids and new
 * form rows already carry real client-minted UUIDs (jobFormRows.ts
 * newEmptyPaymentRow), so every persist-worthy row upserts under its own id,
 * removed rows delete by id, and rows the form never knew about are untouched.
 * jobs_ledger.payments_made converges via the B3 trigger either way.
 */
import type { PaymentRow } from './jobFormTypes'

export type PaymentUpsertRow = {
  id: string
  job_id: string
  amount: number
  sequence_order: number
  paid_on: string | null
  sent_on: string | null
  note: string | null
  payment_type: string | null
  reference_number: string | null
  invoice_id: string | null
  mercury_transaction_id: string | null
}

export type PaymentRowsDiff = {
  /** Ids the form previously persisted that are no longer persist-worthy — delete these. */
  deleteIds: string[]
  /** Every persist-worthy form row, keyed by its own id — upsert these (onConflict: id). */
  upserts: PaymentUpsertRow[]
}

/**
 * `persistedIds` = the ids this form last knew to be persisted (hydration ids,
 * then the previous diff's upsert ids). Rows in the DB but NOT in that list
 * (foreign rows born mid-edit) are deliberately invisible to the diff.
 * The `amount > 0` filter mirrors paymentInsertRows: zeroing a persisted row
 * removes it; empty scaffold rows never persist.
 */
export function diffPaymentRows(
  jobId: string,
  persistedIds: readonly string[],
  current: readonly PaymentRow[],
): PaymentRowsDiff {
  const upserts: PaymentUpsertRow[] = current
    .filter((p) => (Number(p.amount) || 0) > 0)
    .map((p, i) => ({
      id: p.id,
      job_id: jobId,
      amount: Number(p.amount) || 0,
      sequence_order: i,
      paid_on: p.paid_on?.trim() ? p.paid_on.trim() : null,
      sent_on: p.sent_on?.trim() ? p.sent_on.trim() : null,
      note: p.note?.trim() ? p.note.trim() : null,
      payment_type: p.payment_type?.trim() ? p.payment_type.trim() : null,
      reference_number: p.reference_number?.trim() ? p.reference_number.trim() : null,
      invoice_id: p.invoice_id,
      mercury_transaction_id: p.mercury_transaction_id,
    }))
  const keep = new Set(upserts.map((u) => u.id))
  const deleteIds = persistedIds.filter((id) => !keep.has(id))
  return { deleteIds, upserts }
}
