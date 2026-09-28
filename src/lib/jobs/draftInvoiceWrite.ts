/**
 * The job form's draft-invoice write, one order for its three doors (a picked segment, a typed
 * amount, a hazmat fee billed separately): insert the `ready_to_bill` draft → attach what it
 * bills → on a Ready to Bill job, re-sync the remainder draft. The draft is written before the
 * re-sync runs, so a failed re-sync is reported beside the created invoice, never instead of it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { ensureRemainderResyncOutcome } from './ensureRtbRemainderResult'

export type DraftInvoiceInsert = {
  jobId: string
  amount: number
  /** The draft's place among the job's invoices — the count of them before it. */
  sequenceOrder: number
  /** Only the fee split writes a memo; the other doors leave the column to its default. */
  memo?: string
}

/** The row the draft insert writes. */
export function draftInvoiceInsertRow(args: DraftInvoiceInsert): Record<string, unknown> {
  return {
    job_id: args.jobId,
    amount: args.amount,
    status: 'ready_to_bill',
    sequence_order: args.sequenceOrder,
    estimated_bill_date: null,
    is_primary_rtb_bundle: false,
    ...(args.memo !== undefined ? { stripe_invoice_memo: args.memo } : {}),
  }
}

/** Insert the draft; the new invoice's id. Throws the database's error as it came. */
export async function insertDraftInvoice(supabase: SupabaseClient, args: DraftInvoiceInsert): Promise<string> {
  const { data: created, error } = await supabase.from('jobs_ledger_invoices').insert(draftInvoiceInsertRow(args)).select('id').single()
  if (error) throw error
  return (created as { id: string }).id
}

/**
 * Attach line items to an invoice by their saved positions (the billing flush wrote them). No
 * positions, no write. The error comes back instead of throwing — one door treats it as soft.
 */
export async function linkFixturesToInvoiceByPositions(
  supabase: SupabaseClient,
  args: { jobId: string; invoiceId: string; positions: readonly number[] },
): Promise<{ error: { message?: string; details?: string; hint?: string } | null }> {
  if (args.positions.length === 0) return { error: null }
  const { error } = await supabase
    .from('jobs_ledger_fixtures')
    .update({ invoice_id: args.invoiceId })
    .eq('job_id', args.jobId)
    .in('sequence_order', [...args.positions])
  return { error }
}

/**
 * After a draft is written on a Ready to Bill job, re-sync the remainder draft. Null when there
 * was nothing to do or it went through (a fully allocated job is success); the failure's words
 * otherwise. Any other status runs nothing.
 */
export async function resyncRemainderAfterDraft(
  supabase: SupabaseClient,
  args: { jobId: string; jobStatus: string | null | undefined; label: string },
): Promise<string | null> {
  if (args.jobStatus !== 'ready_to_bill') return null
  const raw = await withSupabaseRetry(
    () =>
      supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
        p_job_id: args.jobId,
      }),
    args.label,
  )
  const outcome = ensureRemainderResyncOutcome(raw)
  return outcome.ok ? null : outcome.error
}

/**
 * The whole write in its one order. `afterInsert` is the door's own attach step (link the line
 * items, repoint the fee's incident) and whatever it mirrors on screen; it runs once the draft
 * exists and before the re-sync, and a throw from it skips the re-sync.
 */
export async function writeDraftInvoice(
  supabase: SupabaseClient,
  args: DraftInvoiceInsert & {
    jobStatus: string | null | undefined
    resyncLabel: string
    afterInsert?: (invoiceId: string) => Promise<void> | void
  },
): Promise<{ invoiceId: string; ensureFailure: string | null }> {
  const invoiceId = await insertDraftInvoice(supabase, args)
  if (args.afterInsert) await args.afterInsert(invoiceId)
  const ensureFailure = await resyncRemainderAfterDraft(supabase, { jobId: args.jobId, jobStatus: args.jobStatus, label: args.resyncLabel })
  return { invoiceId, ensureFailure }
}

/** What the form shows when the write throws: the message, then the details and the hint. */
export function draftInvoiceErrorMessage(e: unknown, fallback: string): string {
  const err = e as { message?: string; details?: string; hint?: string }
  const msg = err?.message || fallback
  const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
  return extra ? `${msg}. ${extra}` : msg
}
