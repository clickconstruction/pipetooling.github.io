/**
 * The read behind the Job Mode card's Materials on site press (`siteBoxCount.ts`): how many live cages, boxes and
 * loose piles stand on a job's site. Three small reads under the reader's own RLS, the site `useSiteBoxNames` reads:
 * the job's development, the development's jobs, then a head count of their containers, no row sent. A job on no
 * development, or one whose site the reader cannot read beside, counts the one job. Unsorted is not a box and a
 * retired box is not on site, so neither is counted. A throw is the caller's to keep quiet about.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { siteJobIdChunks } from './siteBoxCount'

const db = supabase as unknown as SupabaseClient

export async function fetchSiteBoxCount(jobId: string, client: SupabaseClient = db): Promise<number> {
  const jobRead = await client.from('jobs_ledger').select('development_id').eq('id', jobId).maybeSingle()
  if (jobRead.error) throw jobRead.error
  const siteId = (jobRead.data as { development_id: string | null } | null)?.development_id ?? null
  let jobIds = [jobId]
  if (siteId) {
    const siblings = await client.from('jobs_ledger').select('id').eq('development_id', siteId)
    if (siblings.error) throw siblings.error
    jobIds = [jobId, ...((siblings.data ?? []) as Array<{ id: string }>).map((j) => j.id)]
  }
  let total = 0
  for (const chunk of siteJobIdChunks(jobIds)) {
    const { count, error } = await client.from('job_containers').select('id', { count: 'exact', head: true }).in('job_id', chunk).is('retired_at', null).neq('kind', 'unsorted')
    if (error) throw error
    total += count ?? 0
  }
  return total
}
