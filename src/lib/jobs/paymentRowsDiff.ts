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
import { isUnfinishedDate } from '../autosaveDateHold'

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

const PAYMENT_DATE_KEYS = ['paid_on', 'sent_on'] as const
type PaymentDateKey = (typeof PAYMENT_DATE_KEYS)[number]

/** A row as one upsert statement writes it: a date still being typed is left out. */
export type PaymentUpsertStatementRow = Omit<PaymentUpsertRow, PaymentDateKey> & Partial<Pick<PaymentUpsertRow, PaymentDateKey>>

function unfinishedDateKeys(row: Pick<PaymentUpsertRow, PaymentDateKey>): PaymentDateKey[] {
  return PAYMENT_DATE_KEYS.filter((k) => isUnfinishedDate(row[k]))
}

/**
 * The upsert as the statements that write it. A payment's Sent or Received date caught half
 * typed (the year "2026" arrives as `0002-…`, `0020-…`, `0202-…`) is left out of its row, so
 * the saved date stays as it is and the amount, type, note and link still save. A bulk upsert
 * writes the union of its rows' columns — a row missing a column there is written as null — so
 * rows that leave a date out go in a statement of their own, one per set of dates left out.
 * With no date half typed this is the one statement it always was.
 */
export function paymentUpsertStatements(upserts: readonly PaymentUpsertRow[]): PaymentUpsertStatementRow[][] {
  const byHeld = new Map<string, PaymentUpsertStatementRow[]>()
  for (const row of upserts) {
    const held = unfinishedDateKeys(row)
    const out: PaymentUpsertStatementRow = { ...row }
    for (const k of held) delete out[k]
    const shape = held.join('+')
    byHeld.set(shape, [...(byHeld.get(shape) ?? []), out])
  }
  // Rows with every date finished first, then each held shape in a fixed order.
  return ['', 'paid_on', 'sent_on', 'paid_on+sent_on'].flatMap((shape) => (byHeld.has(shape) ? [byHeld.get(shape)!] : []))
}

/** The date boxes a save holds back, as `<row id>:<column>` — what the form tells the person about, once each. */
export function unfinishedPaymentDateBoxes(upserts: readonly PaymentUpsertRow[]): string[] {
  return upserts.flatMap((row) => unfinishedDateKeys(row).map((k) => `${row.id}:${k}`))
}
