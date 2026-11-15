/**
 * Text it… (punch list #345): the one read the press needs, the map's job as the customer's box
 * names it. Browser io, not pure. RLS decides: a job the person cannot open reads as gone.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { paintedMapTextJob, type PaintedMapTextJob } from './paintedMapText'

/** The job behind a painted map, or null when it cannot be read. */
export async function loadPaintedMapTextJob(jobId: string): Promise<PaintedMapTextJob | null> {
  const res = await supabase.from('jobs_ledger').select('id, job_name, hcp_number, status, customer_id').eq('id', jobId).maybeSingle()
  checkSupabaseError(res, 'read the job')
  return res.data ? paintedMapTextJob(res.data) : null
}
