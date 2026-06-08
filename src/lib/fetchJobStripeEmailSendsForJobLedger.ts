import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

export type JobStripeEmailSendRow = {
  id: string
  jobs_ledger_invoice_id: string
  sent_at: string | null
}

/**
 * Stripe "emailed customer" sends for a job. The send-log table carries only
 * `jobs_ledger_invoice_id` (no `job_id`), so we resolve the job's invoice ids
 * first, then fetch sends for those invoices. Financial: gated by invoice RLS.
 */
export async function fetchJobStripeEmailSendsForJobLedger(
  jobId: string,
): Promise<{ data: JobStripeEmailSendRow[]; error: string | null }> {
  try {
    const invoiceRows = await withSupabaseRetry(
      async () => await supabase.from('jobs_ledger_invoices').select('id').eq('job_id', jobId).limit(200),
      'fetchJobStripeEmailSendsForJobLedger invoice ids',
    )
    const invoiceIds = ((invoiceRows ?? []) as Array<{ id: string }>).map((r) => r.id)
    if (invoiceIds.length === 0) return { data: [], error: null }
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger_invoice_stripe_email_sends')
          .select('id, jobs_ledger_invoice_id, sent_at')
          .in('jobs_ledger_invoice_id', invoiceIds)
          .order('sent_at', { ascending: true })
          .limit(101),
      'fetchJobStripeEmailSendsForJobLedger',
    )
    return { data: (data ?? []) as JobStripeEmailSendRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}
