import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const SELECT =
  'id, amount, status, created_at, billed_at, sent_to_customer_at, external_send_channel, agreed_write_down_at, agreed_write_down_note, agreed_write_down_previous_amount'

export type JobInvoiceActivityRow = {
  id: string
  amount: number | null
  status: string | null
  created_at: string | null
  billed_at: string | null
  sent_to_customer_at: string | null
  external_send_channel: string | null
  agreed_write_down_at: string | null
  agreed_write_down_note: string | null
  agreed_write_down_previous_amount: number | null
}

/**
 * Invoice rows for a job (oldest-first, cap 101). Each row yields multiple
 * timeline milestones (created/billed/sent/write-down) from its dated columns.
 * Financial: RLS limits to dev/master/assistant/primary.
 */
export async function fetchJobInvoicesForActivity(
  jobId: string,
): Promise<{ data: JobInvoiceActivityRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger_invoices')
          .select(SELECT)
          .eq('job_id', jobId)
          .order('created_at', { ascending: true })
          .limit(101),
      'fetchJobInvoicesForActivity',
    )
    return { data: (data ?? []) as JobInvoiceActivityRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}
