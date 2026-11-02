import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { jobKindPatch, type JobKind } from './jobKind'

/** A press landed: the Needs you line's count reads again (punch list #238, PR 2). */
export const JOB_KIND_CHANGED_EVENT = 'job-kind-changed'

/**
 * Save a job's kind (punch list #238): the office's press on the New Job or Edit Job form, and the
 * Quickfill deck line's press (PR 2). One column, `jobs_ledger.kind`; the explicit kind wins over the
 * signals from then on. Cast until the types chore carries the column.
 */
export async function saveJobKind(jobId: string, kind: JobKind | null): Promise<void> {
  const rows = await withSupabaseRetry(async () => await supabase.from('jobs_ledger').update(jobKindPatch(kind) as never).eq('id', jobId).select('id'), 'save the job kind')
  // An update RLS filters away answers with no error and no rows: say so, or the press reads as saved.
  if (!rows?.length) throw new Error('This account cannot change this job.')
  window.dispatchEvent(new Event(JOB_KIND_CHANGED_EVENT))
}
