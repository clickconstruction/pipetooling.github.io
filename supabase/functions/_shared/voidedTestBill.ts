/**
 * A voided test bill's record (punch list #443, row 7), the pure part: which void keeps a record, and what goes
 * into it from the rows read. One source for `void-stripe-invoice-for-revert`, which writes the record, and for the
 * app, which reads it back under Bill Customer (`src/lib/billing/voidedTestBills.ts`). Tested from
 * `src/lib/billing/voidedTestBill.test.ts`. Pure: no Deno, no DOM, one import.
 *
 * The owner's answer of 2026-11-27 was "A, test bills only". So a record is kept for a bill of a ZZ test job and
 * for no other bill, and the bill's own row is still deleted.
 *
 * What a record's `sends` holds, oldest first:
 *   - `stripe_email`: a row of `jobs_ledger_invoice_stripe_email_sends`. It goes with the bill by its foreign key,
 *     so this copy is the only one left to read in one place.
 *   - `sent_copy`: a row of `sent_documents` that names the bill as its source. That row stays, since it has no key
 *     to the bill. The record keeps who it went to, how and when, so it reads whole without a second look-up.
 * A text that carried the bill's pay link is not copied. It names the bill only inside its words, and it stays in
 * Messages. The bill's id and pay code are in the record's `bill`, which is all that finding the text takes.
 */
import { isZzTestJob } from './zzTestJob.ts'

/** The table the record is written to, by the function alone. */
export const VOIDED_TEST_BILLS_TABLE = 'voided_test_bills'

/** The most sends of one kind a record copies. A test bill has a handful. */
export const VOIDED_TEST_BILL_SENDS_CAP = 200

/** What the function reads of each sent copy that names the bill. No copy body: the row itself stays. */
export const VOIDED_TEST_BILL_SENT_COPY_COLS = 'id, kind, title, how, recipient_name, recipient_emails, subject, sent_at, sent_by_name, copy_path, resend_email_id'

/** What of a job says it is a test: its own name and its stored customer name. */
export type VoidedTestBillJob = { job_name?: string | null; customer_name?: string | null }

/** True when a void of this job's bill keeps a record: a ZZ test job. A job that could not be read keeps none. */
export function voidedTestBillKept(job: VoidedTestBillJob | null | undefined): boolean {
  return !!job && isZzTestJob(job)
}

/** One send in a record's list. */
export type VoidedTestBillSend =
  | {
      source: 'stripe_email'
      id: string
      sent_at: string
      stripe_invoice_id: string | null
      /** The copy addresses the Stripe email also reached. The payer's own address is Stripe's, and is not on the row. */
      copy_emails: string[]
    }
  | {
      source: 'sent_copy'
      id: string
      kind: string
      title: string
      how: string
      recipient_name: string
      recipient_emails: string[]
      subject: string
      sent_at: string
      sent_by_name: string
      copy_path: string | null
      resend_email_id: string | null
    }

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const textOrNull = (v: unknown): string | null => text(v).trim() || null
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter(Boolean) : [])
const rowOf = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

function ms(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

/** The record's list of sends from the rows read, oldest first. A row with no id or no time is left out. */
export function voidedTestBillSends(emailSends: ReadonlyArray<unknown>, sentCopies: ReadonlyArray<unknown>): VoidedTestBillSend[] {
  const out: VoidedTestBillSend[] = []
  for (const raw of emailSends) {
    const r = rowOf(raw)
    if (!r || !text(r.id) || !text(r.sent_at)) continue
    out.push({ source: 'stripe_email', id: text(r.id), sent_at: text(r.sent_at), stripe_invoice_id: textOrNull(r.stripe_invoice_id), copy_emails: texts(r.copy_emails) })
  }
  for (const raw of sentCopies) {
    const r = rowOf(raw)
    if (!r || !text(r.id) || !text(r.sent_at)) continue
    out.push({
      source: 'sent_copy',
      id: text(r.id),
      kind: text(r.kind),
      title: text(r.title),
      how: text(r.how),
      recipient_name: text(r.recipient_name),
      recipient_emails: texts(r.recipient_emails),
      subject: text(r.subject),
      sent_at: text(r.sent_at),
      sent_by_name: text(r.sent_by_name),
      copy_path: textOrNull(r.copy_path),
      resend_email_id: textOrNull(r.resend_email_id),
    })
  }
  return out.sort((a, b) => ms(a.sent_at) - ms(b.sent_at))
}

/** The row the function writes. `voided_at` is the database's clock. */
export type VoidedTestBillRecord = {
  invoice_id: string
  job_id: string
  bill: Record<string, unknown>
  sends: VoidedTestBillSend[]
  stripe_invoice_id: string | null
  stripe_action: string
  voided_by: string | null
  voided_by_name: string | null
}

/**
 * The record of one void, from the bill's whole row and its sends as they stood before the delete. Null when the
 * bill's row carries no id or no job: there is then nothing to file a record under, and the void goes on without one.
 */
export function voidedTestBillRecord(input: {
  bill: unknown
  emailSends: ReadonlyArray<unknown>
  sentCopies: ReadonlyArray<unknown>
  /** What the function did on Stripe's side, the `stripe_action` word of its own answer. */
  stripeAction: string
  voidedBy: string | null
  /** The account's name and email as read. The name wins, the email stands in for an account with no name. */
  actor: { name?: string | null; email?: string | null } | null | undefined
}): VoidedTestBillRecord | null {
  const bill = rowOf(input.bill)
  if (!bill) return null
  const invoiceId = text(bill.id).trim()
  const jobId = text(bill.job_id).trim()
  if (!invoiceId || !jobId) return null
  return {
    invoice_id: invoiceId,
    job_id: jobId,
    bill,
    sends: voidedTestBillSends(input.emailSends, input.sentCopies),
    stripe_invoice_id: textOrNull(bill.stripe_invoice_id),
    stripe_action: input.stripeAction,
    voided_by: textOrNull(input.voidedBy),
    voided_by_name: textOrNull(input.actor?.name) ?? textOrNull(input.actor?.email),
  }
}
