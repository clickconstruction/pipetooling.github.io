import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { FinishCall } from './finishCall'

/**
 * My finish date's reads and its one write (punch list #396, PR 3): `job_finish_calls`, one row a saying.
 *
 * The table's name is cast because the generated types are made after the migration's push. Row-level security
 * decides who reads and who writes: a person writes his own row on a job he can read.
 */

type Row = { user_id: string; finish_on: string; plan_was: string | null; why: string | null; created_at: string; job_id?: string; users?: { name: string | null } | null }

const toCall = (r: Row): FinishCall => ({ userId: r.user_id, userName: r.users?.name ?? null, finishOn: r.finish_on, planWas: r.plan_was, why: r.why, createdAt: r.created_at })

/** What was said on one job, newest first. */
export async function loadFinishCalls(jobId: string): Promise<FinishCall[]> {
  const res = await supabase
    .from('job_finish_calls' as never)
    .select('user_id, finish_on, plan_was, why, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(50)
  checkSupabaseError(res, 'read finish dates')
  return ((res.data ?? []) as unknown as Row[]).map(toCall)
}

/** What was said on a set of jobs, with each person's name, by job: the Projects board's read. */
export async function loadFinishCallsForJobs(jobIds: readonly string[]): Promise<Map<string, FinishCall[]>> {
  const byJob = new Map<string, FinishCall[]>()
  if (jobIds.length === 0) return byJob
  const res = await supabase
    .from('job_finish_calls' as never)
    .select('job_id, user_id, finish_on, plan_was, why, created_at, users(name)')
    .in('job_id', [...jobIds])
    .order('created_at', { ascending: false })
    .limit(500)
  checkSupabaseError(res, 'read finish dates')
  for (const r of (res.data ?? []) as unknown as Row[]) {
    if (!r.job_id) continue
    const list = byJob.get(r.job_id) ?? []
    list.push(toCall(r))
    byJob.set(r.job_id, list)
  }
  return byJob
}

/** One saying, in the caller's own name. Not retried, so it is said once. */
export async function saveFinishCall(input: { jobId: string; finishOn: string; planWas: string | null; why: string | null }): Promise<void> {
  const res = await supabase.from('job_finish_calls' as never).insert({ job_id: input.jobId, finish_on: input.finishOn, plan_was: input.planWas, why: input.why?.trim() || null } as never)
  if (res.error) checkSupabaseError({ data: null, error: res.error, status: res.status }, 'save finish date')
}
