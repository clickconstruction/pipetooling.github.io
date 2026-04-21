import { fetchJobWithDetailsById } from './fetchJobWithDetailsById'
import { jobBillingUnallocatedDollars } from './jobsStagesBoard'
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { JobWithDetails } from '../types/jobWithDetails'

/** Half-cent; matches float noise on dollar amounts from `jobBillingUnallocatedDollars`. */
const FULLY_INVOICED_EPS = 0.005

export function jobIsFullyInvoicedOutForBilledPromotion(job: JobWithDetails): boolean {
  const hasReadyToBill = (job.invoices ?? []).some((i) => i.status === 'ready_to_bill')
  if (hasReadyToBill) return false
  return jobBillingUnallocatedDollars(job) <= FULLY_INVOICED_EPS
}

export type PromoteJobToBilledAfterCustomerInvoiceResult =
  | { ok: true; skipped: true; reason: 'not_found' | 'already_terminal' | 'not_fully_invoiced' }
  | { ok: true; skipped: false }
  | { ok: false; error: string }

/**
 * After an invoice is recorded as billed (Stripe, HCP, or Physical), move `jobs_ledger` to **billed**
 * when no Ready-to-Bill lines remain and gross is fully allocated to invoice lines (same basis as Stages).
 * Chains **working** → **ready_to_bill** → **billed** when required by `update_job_status`.
 */
export async function maybePromoteJobToBilledAfterCustomerInvoice(
  jobId: string,
): Promise<PromoteJobToBilledAfterCustomerInvoiceResult> {
  const job = await fetchJobWithDetailsById(jobId)
  if (!job) {
    return { ok: true, skipped: true, reason: 'not_found' }
  }

  const status = (job.status ?? 'working') as string
  if (status === 'billed' || status === 'paid') {
    return { ok: true, skipped: true, reason: 'already_terminal' }
  }

  if (!jobIsFullyInvoicedOutForBilledPromotion(job)) {
    return { ok: true, skipped: true, reason: 'not_fully_invoiced' }
  }

  try {
    if (status === 'working') {
      const toRtb = await withSupabaseRetry(
        () => supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: 'ready_to_bill' }),
        'update_job_status working to ready_to_bill after full customer invoice',
      )
      const rtbRes = toRtb as { error?: string } | null
      if (rtbRes?.error) {
        return { ok: false, error: rtbRes.error }
      }
    }

    const toBilled = await withSupabaseRetry(
      () => supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: 'billed' }),
      'update_job_status ready_to_bill to billed after full customer invoice',
    )
    const billedRes = toBilled as { error?: string } | null
    if (billedRes?.error) {
      return { ok: false, error: billedRes.error }
    }

    return { ok: true, skipped: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not update job status'
    return { ok: false, error: msg }
  }
}
