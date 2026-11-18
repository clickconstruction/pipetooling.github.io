/**
 * Papers before a job opens, step 5: the lock asked about a named person, for the functions that read a job with the
 * service role. A job can require papers, and a person who still owes one is locked out of it until they sign. Row
 * security hides the job from that person's own client (migration *_job_papers_lock), but a function that switches to
 * the service role queries as nobody, so the database sees no caller to refuse. Such a function asks here before it
 * hands a job's name, address or files to a person: `job_shut_to_user` and `jobs_shut_to_user` (migration
 * *_job_papers_lists, service role only) answer false and empty for the office roles and primaries, and while no job
 * requires a paper.
 *
 * Every question here fails open: a read that fails (the function is not on the database yet, the network drops) logs
 * one line and reads as not locked. Nothing may change for anyone until a job requires a paper, and the lock must
 * never stop a notice on a job that requires none.
 *
 * It imports nothing, and `admin` is typed by the one call it makes, so a function that imports it takes on no other file.
 */

/** The service-role client, as far as this file reads it: the one `rpc` call. */
export interface PapersLockAdmin {
  // deno-lint-ignore no-explicit-any
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: { message: string } | null }>
}

export const JOB_PAPERS_LOCK_WORDS = 'Sign this job’s papers first. Open the job in the app and press Read and sign.'

function failOpen(fn: string, e: unknown): void {
  const message = e instanceof Error ? e.message : typeof (e as { message?: unknown } | null)?.message === 'string' ? (e as { message: string }).message : String(e)
  console.error(`${fn} failed, read as not locked: ${message}`)
}

/** True when that person is locked out of that job: they owe it a paper. A read that fails reads as not locked. */
export async function jobShutToUser(admin: PapersLockAdmin, jobId: string | null | undefined, userId: string | null | undefined): Promise<boolean> {
  if (!jobId || !userId) return false
  try {
    const { data, error } = await admin.rpc('job_shut_to_user', { p_job_id: jobId, p_user_id: userId })
    if (error) {
      failOpen('job_shut_to_user', error)
      return false
    }
    return data === true
  } catch (e) {
    failOpen('job_shut_to_user', e)
    return false
  }
}

/** The ids of the jobs that person is locked out of. Empty for the office, and when the read fails. */
export async function jobsShutToUser(admin: PapersLockAdmin, userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set()
  try {
    const { data, error } = await admin.rpc('jobs_shut_to_user', { p_user_id: userId })
    if (error) {
      failOpen('jobs_shut_to_user', error)
      return new Set()
    }
    return new Set(Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [])
  } catch (e) {
    failOpen('jobs_shut_to_user', e)
    return new Set()
  }
}

/** The people a notice about that job may name it to: the ids not locked out of it, in the order given. With no job, everyone. */
export async function recipientsNotShut(admin: PapersLockAdmin, jobId: string | null | undefined, userIds: readonly string[]): Promise<string[]> {
  if (!jobId || userIds.length === 0) return [...userIds]
  const shut = await Promise.all(userIds.map((userId) => jobShutToUser(admin, jobId, userId)))
  return userIds.filter((_, i) => !shut[i])
}

/** The 403 to return when the caller is locked out of the job, or null to carry on. `headers` carries the function's CORS headers. */
export async function refuseShutJob(admin: PapersLockAdmin, jobId: string | null | undefined, userId: string | null | undefined, headers: Record<string, string> = {}): Promise<Response | null> {
  if (!(await jobShutToUser(admin, jobId, userId))) return null
  return new Response(JSON.stringify({ error: JOB_PAPERS_LOCK_WORDS }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } })
}
