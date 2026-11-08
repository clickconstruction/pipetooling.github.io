/**
 * Punch list #125, PR 1 (v2.6683): the board's one read of the customer's conversation, `pipeline_customer_lines`
 * (migration 20261108030000), called once per slice of the board's jobs beside `jobs_ledger_thread_note_stats` and
 * folded by `pipelineCustomerLinesByJob`. The function is SECURITY INVOKER, so anyone outside the office gets no rows
 * and the board draws nothing new. Until the migration is pushed PostgREST does not know the function: that answer
 * reads as no lines, never as a failure, so the board never waits on it.
 */
import type { JobActivityMessage } from '../jobs/jobActivityMessages'
import { PIPELINE_CUSTOMER_LINES_PER_JOB, pipelineCustomerLinesByJob } from '../jobs/pipelineCustomerLines'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

/** Jobs per call: the stats' slice, so the two reads run in step. */
export const PIPELINE_CUSTOMER_LINES_SLICE = 200

/** PostgREST's words for a function the ledger does not hold yet (the client deployed before the push). */
export function isMissingFunctionError(e: unknown): boolean {
  if (e == null || typeof e !== 'object') return false
  const o = e as { code?: unknown; message?: unknown }
  return o.code === 'PGRST202' || /could not find the function|PGRST202/i.test(typeof o.message === 'string' ? o.message : '')
}

/** The newest `perJob` lines of every job given, by job id. A job with none has no entry. */
export async function loadPipelineCustomerLines(
  jobIds: readonly string[],
  perJob: number = PIPELINE_CUSTOMER_LINES_PER_JOB,
): Promise<Map<string, JobActivityMessage[]>> {
  const rows: unknown[] = []
  for (let i = 0; i < jobIds.length; i += PIPELINE_CUSTOMER_LINES_SLICE) {
    const slice = jobIds.slice(i, i + PIPELINE_CUSTOMER_LINES_SLICE)
    let data: unknown
    try {
      data = await withSupabaseRetry(
        async () => supabase.rpc('pipeline_customer_lines' as never, { p_job_ids: slice, p_per_job: perJob } as never),
        'pipeline_customer_lines',
      )
    } catch (e: unknown) {
      if (isMissingFunctionError(e)) return new Map()
      throw e
    }
    if (Array.isArray(data)) rows.push(...data)
  }
  return pipelineCustomerLinesByJob(rows)
}
