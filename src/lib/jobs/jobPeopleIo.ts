/**
 * The read behind the E chip (v2.6694): the signed estimate a job came from and its author's name. Two small reads on
 * the tables' own policies — `estimates` by `job_ledger_id`, then `users` by the author's id — never a function, so the
 * chip works before and after the migration that widens `is_job_people` is pushed. A read that fails gives null: the
 * chip is a glanceable extra and never blocks a screen.
 */
import { supabase } from '../supabase'
import { pickJobEstimateAuthor, type JobEstimateAuthor } from './jobPeople'

export async function loadJobEstimateAuthor(jobId: string, client: unknown = supabase): Promise<JobEstimateAuthor | null> {
  try {
    const db = client as typeof supabase
    const est = await db
      .from('estimates')
      .select('id, estimate_number, created_by, status, doc_kind, created_at')
      .eq('job_ledger_id', jobId)
      .eq('status', 'customer_accepted')
      .neq('doc_kind', 'change_order')
      .order('created_at', { ascending: false })
      .limit(1)
    if (est.error) return null
    const picked = pickJobEstimateAuthor(est.data as unknown, null)
    if (!picked) return null
    const who = await db.from('users').select('id, name').eq('id', picked.userId).maybeSingle()
    const name = !who.error && who.data && typeof (who.data as { name?: unknown }).name === 'string' ? ((who.data as { name: string }).name as string) : null
    return { ...picked, name }
  } catch {
    return null
  }
}
