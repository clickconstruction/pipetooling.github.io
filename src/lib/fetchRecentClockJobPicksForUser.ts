import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type RecentClockJobPick = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
}

/**
 * Distinct jobs from recent clock_sessions (newest first), for quick context (e.g. pre–clock-out tally).
 */
export async function fetchRecentClockJobPicksForUser(
  userId: string,
  maxJobs = 15,
): Promise<RecentClockJobPick[]> {
  const sessionRows = await withSupabaseRetry(
    async () =>
      supabase
        .from('clock_sessions')
        .select('job_ledger_id')
        .eq('user_id', userId)
        .not('job_ledger_id', 'is', null)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .order('clocked_in_at', { ascending: false })
        .limit(80),
    'recent clock_sessions for job picks',
  )
  const rows = (sessionRows ?? []) as { job_ledger_id: string | null }[]
  const orderedIds: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const jid = r.job_ledger_id
    if (!jid || seen.has(jid)) continue
    seen.add(jid)
    orderedIds.push(jid)
    if (orderedIds.length >= maxJobs) break
  }
  if (orderedIds.length === 0) return []

  const jlRows = await withSupabaseRetry(
    async () =>
      supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address').in('id', orderedIds),
    'jobs_ledger recent clock picks',
  )
  const list = (jlRows ?? []) as RecentClockJobPick[]
  const byId = new Map(list.map((j) => [j.id, j]))
  return orderedIds
    .map((id) => byId.get(id))
    .filter((j): j is RecentClockJobPick => j != null)
}
