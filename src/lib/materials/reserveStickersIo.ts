/**
 * Print future stickers' *Which job?* window (v2.7492): the reads its cards add to what the on-site desk already holds,
 * each under the viewer's own RLS. A read that fails leaves its facts off the cards; the window a card opens reads
 * the same things again for its one job. The words are `reserveStickersJobs.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { mintedStickerOf, stickerRunOf, type StickerRowOfRun, type StickerRun } from './stickerRun'
import { fetchSiteStickerNames, type SiteStickerNames, type StickerRunWithStickers } from './stickerRunsIo'

const db = supabase as unknown as SupabaseClient

type StickerRow = { id: string; run_id: string; number: number; code: string | null; box_name: string | null; container_id: string | null; lost_at: string | null }

/** Every listed job's runs with their stickers, by the job's id: two reads for the whole list, the stickers paged. A job with no run is left out. */
export async function fetchStickerRunsOfJobs(jobIds: ReadonlyArray<string>): Promise<Map<string, StickerRunWithStickers[]>> {
  const ids = [...new Set(jobIds)]
  const out = new Map<string, StickerRunWithStickers[]>()
  if (ids.length === 0) return out
  const runsRead = await db.from('sticker_runs').select('id, job_id, sticker_count, first_number, last_number, copies, names, printed_by, printed_by_name, printed_at').in('job_id', ids).order('first_number', { ascending: false })
  if (runsRead.error) throw runsRead.error
  const runs = ((runsRead.data ?? []) as unknown[]).map(stickerRunOf).filter((r): r is StickerRun => r != null && r.jobId != null)
  if (runs.length === 0) return out
  const rows = (await fetchAllRowsChunkedIn(runs.map((r) => r.id), (chunk, from, to) => db.from('box_stickers').select('id, run_id, number, code, box_name, container_id, lost_at').in('run_id', chunk).order('number').range(from, to), 'the listed jobs’ stickers', { parallel: 4 })) as unknown as StickerRow[]
  const byRun = new Map<string, StickerRowOfRun[]>()
  for (const raw of rows) {
    const minted = mintedStickerOf(raw)
    if (!minted) continue
    const list = byRun.get(raw.run_id) ?? []
    list.push({ ...minted, containerId: raw.container_id, lostAt: raw.lost_at })
    byRun.set(raw.run_id, list)
  }
  for (const run of runs) {
    const list = out.get(run.jobId!) ?? []
    list.push({ run, stickers: (byRun.get(run.id) ?? []).sort((a, b) => a.number - b.number) })
    out.set(run.jobId!, list)
  }
  return out
}

/**
 * Each listed job's site: its name, and the site's boxes and reserved names, for the name a new run opens on. The
 * site's names are read once a site through `fetchSiteStickerNames`, by any one of its jobs, and once for each job on
 * no site; a site whose names did not read keeps its name and hands back null for them.
 */
export async function fetchSitesOfJobs(jobIds: ReadonlyArray<string>, siteNames: (jobId: string) => Promise<SiteStickerNames> = fetchSiteStickerNames): Promise<Map<string, { site: string; names: SiteStickerNames | null }>> {
  const ids = [...new Set(jobIds)]
  const out = new Map<string, { site: string; names: SiteStickerNames | null }>()
  if (ids.length === 0) return out
  const jobs = ((await withSupabaseRetry(() => supabase.from('jobs_ledger').select('id, development_id').in('id', ids), 'load sticker job sites')) ?? []) as Array<{ id: string; development_id: string | null }>
  const siteIds = [...new Set(jobs.map((j) => j.development_id).filter((id): id is string => Boolean(id)))]
  const sites = siteIds.length ? (((await withSupabaseRetry(() => supabase.from('developments').select('id, name').in('id', siteIds), 'load sticker site names')) ?? []) as Array<{ id: string; name: string | null }>) : []
  const nameOf = new Map(sites.map((s) => [s.id, (s.name ?? '').trim()] as const))
  // One read of the site's names a site, keyed by the site, or by the job itself when it is on none.
  const siteKey = (jobId: string) => jobs.find((j) => j.id === jobId)?.development_id ?? `job:${jobId}`
  const firstJobOf = new Map<string, string>()
  for (const id of ids) if (!firstJobOf.has(siteKey(id))) firstJobOf.set(siteKey(id), id)
  const namesOf = new Map<string, SiteStickerNames | null>()
  await Promise.all([...firstJobOf.entries()].map(async ([key, jobId]) => {
    try { namesOf.set(key, await siteNames(jobId)) } catch { namesOf.set(key, null) }
  }))
  for (const id of ids) {
    const dev = jobs.find((j) => j.id === id)?.development_id ?? null
    out.set(id, { site: dev ? nameOf.get(dev) ?? '' : '', names: namesOf.get(siteKey(id)) ?? null })
  }
  return out
}
