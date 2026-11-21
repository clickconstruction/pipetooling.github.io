/**
 * The read behind the Job Mode card's Materials on site press (`siteBoxCount.ts`): what stands on a job's site.
 *
 * `fetchSiteDoorFacts` asks the database once (`on_site_door_facts`, v2.8103): the live boxes, the ones due a count
 * and the printed stickers on no box yet, each under the reader's own RLS. A database that does not have the function
 * yet answers PGRST202, and the read then falls back to the head count below with nothing due and no stickers, so the
 * client may deploy before the migration is pushed and the press still carries its number.
 *
 * `fetchSiteBoxCount` is that head count: the job's development, the development's jobs, then a head count of their
 * containers, no row sent. A job on no development, or one whose site the reader cannot read beside, counts the one
 * job. Unsorted is not a box and a retired box is not on site, so neither is counted. A throw is the caller's to keep
 * quiet about.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { siteDoorFactsFromCount, siteDoorFactsOf, siteJobIdChunks, type SiteDoorFacts } from './siteBoxCount'

const db = supabase as unknown as SupabaseClient

/** The codes PostgREST and Postgres answer for a function the database does not have. */
const NO_SUCH_FUNCTION = new Set(['PGRST202', '42883'])

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

export async function fetchSiteDoorFacts(jobId: string, client: SupabaseClient = db): Promise<SiteDoorFacts> {
  const { data, error } = await client.rpc('on_site_door_facts', { p_job_id: jobId })
  if (error && !NO_SUCH_FUNCTION.has(String((error as { code?: string }).code ?? ''))) throw error
  const facts = error ? null : siteDoorFactsOf(data)
  return facts ?? siteDoorFactsFromCount(await fetchSiteBoxCount(jobId, client))
}
