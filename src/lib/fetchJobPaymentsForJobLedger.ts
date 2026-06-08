import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const SELECT = 'id, amount, created_at, paid_on, note, payment_type, reference_number'

export type JobPaymentRow = {
  id: string
  amount: number | null
  created_at: string | null
  paid_on: string | null
  note: string | null
  payment_type: string | null
  reference_number: string | null
}

/**
 * Recorded payments for a job ledger row (oldest-first, cap 101).
 * Financial: existing RLS limits this to dev/master/assistant/primary, so a
 * non-privileged viewer simply receives zero rows.
 */
export async function fetchJobPaymentsForJobLedger(
  jobId: string,
): Promise<{ data: JobPaymentRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger_payments')
          .select(SELECT)
          .eq('job_id', jobId)
          .order('created_at', { ascending: true })
          .limit(101),
      'fetchJobPaymentsForJobLedger',
    )
    return { data: (data ?? []) as JobPaymentRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}
