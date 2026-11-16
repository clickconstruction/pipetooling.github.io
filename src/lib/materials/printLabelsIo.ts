/**
 * Print labels' *Which job?* window (v2.7482): the two small reads its cards add to what the on-site desk already
 * holds, each under the viewer's own RLS. A read that fails leaves its fact off the card; nothing else waits on it.
 * The words are `printLabelsJobs.ts`.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchStickersOnBoxes } from './stickerPlaceIo'

/** Each job's site by the job's id: its development's name. A job on no site is left out. */
export async function fetchJobSiteNames(jobIds: ReadonlyArray<string>): Promise<Map<string, string>> {
  const ids = [...new Set(jobIds)]
  if (ids.length === 0) return new Map()
  const jobs = ((await withSupabaseRetry(() => supabase.from('jobs_ledger').select('id, development_id').in('id', ids), 'load label job sites')) ?? []) as Array<{ id: string; development_id: string | null }>
  const siteIds = [...new Set(jobs.map((j) => j.development_id).filter((id): id is string => Boolean(id)))]
  if (siteIds.length === 0) return new Map()
  const sites = ((await withSupabaseRetry(() => supabase.from('developments').select('id, name').in('id', siteIds), 'load label site names')) ?? []) as Array<{ id: string; name: string | null }>
  const nameOf = new Map(sites.map((s) => [s.id, (s.name ?? '').trim()] as const))
  const out = new Map<string, string>()
  for (const j of jobs) {
    const name = j.development_id ? nameOf.get(j.development_id) : ''
    if (name) out.set(j.id, name)
  }
  return out
}

/** The boxes, of those handed in, that wear a sticker still in use: a box made from a blank sticker already has its code on it. */
export async function fetchStickeredBoxIds(containerIds: ReadonlyArray<string>): Promise<Set<string>> {
  const rows = await fetchStickersOnBoxes(containerIds)
  return new Set(rows.filter((r) => r.containerId && !r.lostAt).map((r) => r.containerId!))
}
